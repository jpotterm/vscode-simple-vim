import * as vscode from 'vscode';

import { VimState } from './vim_state_types';
import { Mode } from './modes_types';
import {
    ParseKeysStatus,
    OperatorMotion,
    ParseFailure,
    ParseRegisterPartSuccess,
    ParseCountPartSuccess,
    ParseOperatorPartSuccess,
    ParseOperatorMotionSuccess,
} from './parse_keys_types';
import { Action } from './action_types';
import { VimRange } from './vim_range_types';

export function arrayStartsWith<T>(prefix: T[], xs: T[]) {
    if (xs.length < prefix.length) {
        return false;
    }

    for (let i = 0; i < prefix.length; ++i) {
        if (prefix[i] !== xs[i]) {
            return false;
        }
    }

    return true;
}

export function arrayEquals<T>(xs: T[], ys: T[]) {
    if (xs.length !== ys.length) {
        return false;
    }

    for (let i = 0; i < xs.length; ++i) {
        if (xs[i] !== ys[i]) {
            return false;
        }
    }

    return true;
}

export function parseKeysExact(
    matchKeys: string[],
    modes: Mode[],
    action: (vimState: VimState, editor: vscode.TextEditor) => void,
): Action {
    return (vimState, keys, editor) => {
        if (modes && modes.indexOf(vimState.mode) < 0) {
            return ParseKeysStatus.NO;
        }

        if (arrayEquals(keys, matchKeys)) {
            action(vimState, editor);
            return ParseKeysStatus.YES;
        } else if (arrayStartsWith(keys, matchKeys)) {
            return ParseKeysStatus.MORE_INPUT;
        } else {
            return ParseKeysStatus.NO;
        }
    };
}

export function parseKeysRegex(
    doesPattern: RegExp,
    couldPattern: RegExp,
    modes: Mode[],
    action: (vimState: VimState, editor: vscode.TextEditor, match: RegExpMatchArray) => void,
): Action {
    return (vimState, keys, editor) => {
        if (modes && modes.indexOf(vimState.mode) < 0) {
            return ParseKeysStatus.NO;
        }

        const keysStr = keys.join('');
        const doesMatch = keysStr.match(doesPattern);

        if (doesMatch) {
            action(vimState, editor, doesMatch);
            return ParseKeysStatus.YES;
        } else if (keysStr.match(couldPattern)) {
            return ParseKeysStatus.MORE_INPUT;
        } else {
            return ParseKeysStatus.NO;
        }
    };
}

function parseRegisterPart(keys: string[]): ParseFailure | ParseRegisterPartSuccess {
    if (keys[0] === '"') {
        if (keys.length < 2) {
            return {
                kind: 'failure',
                status: ParseKeysStatus.MORE_INPUT,
            };
        } else {
            return {
                kind: 'success',
                register: keys[1],
                rest: keys.slice(2),
            };
        }
    }

    return {
        kind: 'success',
        register: '"',
        rest: keys,
    };
}

function parseCountPart(keys: string[]): ParseCountPartSuccess {
    const match = keys.join('').match(/^\d+/);

    if (match) {
        return {
            kind: 'success',
            count: parseInt(match[0], 10),
            rest: keys.slice(match[0].length),
        };
    } else {
        return {
            kind: 'success',
            count: 1,
            rest: keys,
        };
    }
}

function parseOperatorPart(keys: string[], operatorKeys: string[]): ParseFailure | ParseOperatorPartSuccess {
    if (arrayStartsWith(operatorKeys, keys)) {
        return {
            kind: 'success',
            rest: keys.slice(operatorKeys.length),
        };
    } else if (arrayStartsWith(keys, operatorKeys)) {
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

function parseOperatorMotionPart(
    vimState: VimState,
    keys: string[],
    editor: vscode.TextEditor,
    motions: OperatorMotion[],
): ParseFailure | ParseOperatorMotionSuccess {
    let could = false;
    for (const motion of motions) {
        const result = motion(vimState, keys, editor);

        if (result.kind === 'success') {
            return result;
        } else if (result.status === ParseKeysStatus.MORE_INPUT) {
            could = true;
        }
    }

    if (could) {
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

export function parseKeysOperator(
    operatorKeys: string[],
    motions: OperatorMotion[],
    operator: (
        vimState: VimState,
        editor: vscode.TextEditor,
        register: string,
        count: number,
        ranges: (VimRange | undefined)[],
    ) => void,
): Action {
    return (vimState, keys, editor) => {
        const registerResult = parseRegisterPart(keys);
        if (registerResult.kind === 'failure') {
            return registerResult.status;
        }

        if (registerResult.rest.length === 0) {
            return ParseKeysStatus.MORE_INPUT;
        }

        const countResult = parseCountPart(registerResult.rest);

        if (countResult.rest.length === 0) {
            return ParseKeysStatus.MORE_INPUT;
        }

        const operatorResult = parseOperatorPart(countResult.rest, operatorKeys);
        if (operatorResult.kind === 'failure') {
            return operatorResult.status;
        }

        let ranges: (VimRange | undefined)[];
        if (vimState.mode === Mode.Normal) {
            if (operatorResult.rest.length === 0) {
                return ParseKeysStatus.MORE_INPUT;
            }

            const motionResult = parseOperatorMotionPart(vimState, operatorResult.rest, editor, motions);
            if (motionResult.kind === 'failure') {
                return motionResult.status;
            }

            ranges = motionResult.ranges;
        } else if (vimState.mode === Mode.VisualLine) {
            ranges = editor.selections.map(selection => {
                return { range: selection, linewise: true };
            });
        } else {
            ranges = editor.selections.map(selection => {
                return { range: selection, linewise: false };
            });
        }

        operator(vimState, editor, registerResult.register, countResult.count, ranges);
        return ParseKeysStatus.YES;
    };
}

export function createOperatorMotionExactKeys(
    matchKeys: string[],
    f: (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange | undefined,
): OperatorMotion {
    return (vimState, keys, editor) => {
        if (arrayEquals(keys, matchKeys)) {
            const ranges = editor.selections.map(selection => {
                return f(vimState, editor.document, selection.active);
            });
            return {
                kind: 'success',
                ranges: ranges,
            };
        } else if (arrayStartsWith(keys, matchKeys)) {
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
    };
}

export function createOperatorMotionRegex(
    doesPattern: RegExp,
    couldPattern: RegExp,
    f: (
        vimState: VimState,
        document: vscode.TextDocument,
        position: vscode.Position,
        match: RegExpMatchArray,
    ) => VimRange | undefined,
): OperatorMotion {
    return (vimState, keys, editor) => {
        const keysStr = keys.join('');
        const doesMatch = keysStr.match(doesPattern);

        if (doesMatch) {
            const ranges = editor.selections.map(selection => {
                return f(vimState, editor.document, selection.active, doesMatch);
            });
            return {
                kind: 'success',
                ranges: ranges,
            };
        } else if (keysStr.match(couldPattern)) {
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
    };
}
