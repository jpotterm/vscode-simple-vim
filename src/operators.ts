'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';
import { ParseKeysResult, ParseKeysStatus, parseKeysWithRest, ParseKeys, parseKeysExact } from './parseKeys';
import * as positionUtils from './positionUtils';
import { Mode } from './modes';

export interface OperatorMotion {
    exec: (vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position) => vscode.Range;
}

export interface Operator {
    exec: (vimState: VimState, keys: string[], editor: vscode.TextEditor, range: vscode.Range) => void;
}

type ParseOperatorResult = ParseOperatorResultSuccess | ParseOperatorResultFailure;

type ParseOperatorResultSuccess = {
    kind: 'success',
    register: string,
    count: number,
    operator: Operator,
    motion: OperatorMotion | undefined,
};

type ParseOperatorResultFailure = {
    kind: 'failure',
    status: ParseKeysStatus,
};

export function parseOperator(vimState: VimState, keys: string[]): ParseOperatorResult {
    let rest = keys;

    // Parse register
    let register = '"';
    if (rest[0] === '"') {
        if (rest.length < 2) {
            return {
                kind: 'failure',
                status: ParseKeysStatus.MORE_INPUT,
            };
        } else {
            register = rest[1];
            rest = rest.slice(2);
        }
    }

    // Parse count
    let count = 1;
    const match = rest.join('').match(/^\d+/);
    if (match) {
        count = parseInt(match[0]);
        rest = rest.slice(match[0].length);
    }

    if (rest.length === 0) {
        return {
            kind: 'failure',
            status: ParseKeysStatus.MORE_INPUT,
        };
    }

    // Parse operator
    const operator = operators.find(
        x => x.parseKeys(vimState, rest).status === ParseKeysStatus.YES
    );

    if (!operator) {
        const operatorCould = operators.find(
            x => x.parseKeys(vimState, rest).status === ParseKeysStatus.MORE_INPUT
        );

        if (operatorCould) {
            return {
                kind: 'failure',
                status: ParseKeysStatus.MORE_INPUT,
            };
        } else {
            return {
                kind: 'failure',
                status: ParseKeysStatus.NO,
            };
        }
    }

    let motion;
    if (vimState.mode === Mode.Normal) {
        rest = operator.parseKeys(vimState, rest).rest;

        if (rest.length === 0) {
            return {
                kind: 'failure',
                status: ParseKeysStatus.MORE_INPUT,
            };
        }

        // Parse motion
        motion = operatorMotions.find(
            x => x.parseKeys(vimState, rest).status === ParseKeysStatus.YES
        );

        if (!motion) {
            const motionCould = operatorMotions.find(
                x => x.parseKeys(vimState, rest).status === ParseKeysStatus.MORE_INPUT
            );

            if (motionCould) {
                return {
                    kind: 'failure',
                    status: ParseKeysStatus.MORE_INPUT,
                };
            } else {
                return {
                    kind: 'failure',
                    status: ParseKeysStatus.NO,
                };
            }
        }
    }

    return {
        kind: 'success',
        register: register,
        count: count,
        operator: operator,
        motion: motion,
    };
}

const operators: (Operator & ParseKeys)[] = [
    {
        parseKeys: parseKeysWithRest(['d']),
        exec: async function(vimState, keys, editor, range) {
            await editor.edit(function(editBuilder) {
                editBuilder.delete(range);
            });
        },
    },
    {
        parseKeys: parseKeysWithRest(['c']),
        exec: function(vimState, keys, editor, range) {
            console.log('Exec operator c');
        },
    },
];

const operatorMotions: (OperatorMotion & ParseKeys)[] = [
    {
        parseKeys: parseKeysExact(['l']),
        exec: function(vimState, keys, document, position) {
            return new vscode.Range(position, positionUtils.right(document, position));
        },
    },
    {
        parseKeys: parseKeysExact(['h']),
        exec: function(vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position): vscode.Range {
            return new vscode.Range(position, positionUtils.left(document, position));
        },
    },
    {
        parseKeys: parseKeysExact(['k']),
        exec: function(vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position): vscode.Range {
            if (position.line === 0) {
                return new vscode.Range(position, position);
            }

            return new vscode.Range(
                new vscode.Position(position.line - 1, 0),
                positionUtils.lineEnd(document, position)
            );
        },
    },
    {
        parseKeys: parseKeysExact(['j']),
        exec: function(vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position): vscode.Range {
            if (position.line === document.lineCount - 1) {
                return new vscode.Range(position, position);
            }

            return new vscode.Range(
                new vscode.Position(position.line, 0),
                positionUtils.lineEnd(document, position.with({ line: position.line + 1 }))
            );
        },
    },
];
