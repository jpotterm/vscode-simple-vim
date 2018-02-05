'use strict';
import * as vscode from 'vscode';

import { createOperatorMotionExactKeys, createOperatorMotionRegex } from '../parseKeys';
import { OperatorMotion } from '../parseKeysTypes';
import { searchForward, searchBackward } from '../searchUtils';
import * as positionUtils from '../positionUtils';

export const operatorMotions: OperatorMotion[] = [
    createOperatorMotionExactKeys(['l'], function(vimState, document, position) {
        return {
            range: new vscode.Range(position, positionUtils.right(document, position)),
            linewise: false,
        };
    }),
    createOperatorMotionExactKeys(['h'], function(vimState, document, position) {
        return {
            range: new vscode.Range(position, positionUtils.left(document, position)),
            linewise: false,
        };
    }),
    createOperatorMotionExactKeys(['k'], function(vimState, document, position) {
        if (position.line === 0) {
            return {
                range: new vscode.Range(position, position),
                linewise: true,
            };
        }

        return {
            range: new vscode.Range(
                new vscode.Position(position.line - 1, 0),
                positionUtils.lineEnd(document, position),
            ),
            linewise: true,
        };
    }),
    createOperatorMotionExactKeys(['j'], function(vimState, document, position) {
        if (position.line === document.lineCount - 1) {
            return {
                range: new vscode.Range(position, position),
                linewise: true,
            };
        }

        return {
            range: new vscode.Range(
                new vscode.Position(position.line, 0),
                positionUtils.lineEnd(document, position.with({ line: position.line + 1 })),
            ),
            linewise: true,
        };
    }),
    createOperatorMotionRegex(/^f(..)$/, /^(f|f.)$/, function(vimState, document, position, match) {
        const fromPosition = position.with({ character: position.character + 1 });
        const result = searchForward(document, match[1], fromPosition);

        if (result) {
            return {
                range: new vscode.Range(position, result),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionRegex(/^F(..)$/, /^(F|F.)$/, function(vimState, document, position, match) {
        const fromPosition = position.with({ character: position.character - 1 });
        const result = searchBackward(document, match[1], fromPosition);

        if (result) {
            return {
                range: new vscode.Range(position, result),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionRegex(/^t(.)$/, /^t$/, function(vimState, document, position, match) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.indexOf(match[1], position.character + 1);

        if (result >= 0) {
            return {
                range: new vscode.Range(position, position.with({ character: result })),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionRegex(/^T(.)$/, /^T$/, function(vimState, document, position, match) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.lastIndexOf(match[1], position.character - 1);

        if (result >= 0) {
            const newPosition = positionUtils.right(document, position.with({ character: result }));
            return {
                range: new vscode.Range(newPosition, position),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionExactKeys(['g', 'g'], function(vimState, document, position) {
        const lineLength = document.lineAt(position.line).text.length;

        return {
            range: new vscode.Range(
                new vscode.Position(0, 0),
                position.with({ character: lineLength }),
            ),
            linewise: true,
        };
    }),
    createOperatorMotionExactKeys(['G'], function(vimState, document, position) {
        const lineLength = document.lineAt(document.lineCount - 1).text.length;

        return {
            range: new vscode.Range(
                position.with({ character: 0 }),
                new vscode.Position(document.lineCount - 1, lineLength),
            ),
            linewise: true,
        };
    }),
];
