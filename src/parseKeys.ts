'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';
import { Mode } from './modes';
import { ParseKeysStatus, OperatorMotion, ParseFailure, ParseRegisterPartSuccess, ParseCountPartSuccess, ParseOperatorPartSuccess, ParseOperatorMotionPartSuccess, ParseOperatorMotionSuccess } from './parseKeysTypes';
import { Action } from './actionTypes';


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
    return function(vimState, keys, editor) {
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
            count: parseInt(match[0]),
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
    motions: OperatorMotion[]
): ParseFailure | ParseOperatorMotionSuccess {
    let could = false;
    for (let motion of motions) {
        const result = motion(vimState, vimState.keysPressed, editor);

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

// export function parseOperatorAll(
//     vimState: VimState,
//     keys: string[],
//     operatorKeys: string[],
//     motions: (OperatorMotion & ParseKeys)[]
// ): ParseFailure | ParseOperatorAllSuccess {
//     const registerResult = parseRegister(keys);
//     if (registerResult.kind === 'failure') {
//         return {
//             kind: 'failure',
//             status: registerResult.status,
//         };
//     }

//     if (registerResult.rest.length === 0) {
//         return {
//             kind: 'failure',
//             status: ParseKeysStatus.MORE_INPUT,
//         };
//     }

//     const countResult = parseCount(registerResult.rest);

//     if (countResult.rest.length === 0) {
//         return {
//             kind: 'failure',
//             status: ParseKeysStatus.MORE_INPUT,
//         };
//     }

//     const operatorResult = parseOperator(countResult.rest, operatorKeys);
//     if (operatorResult.kind === 'failure') {
//         return {
//             kind: 'failure',
//             status: operatorResult.status,
//         };
//     }

//     let motion;
//     if (vimState.mode === Mode.Normal) {
//         if (operatorResult.rest.length === 0) {
//             return {
//                 kind: 'failure',
//                 status: ParseKeysStatus.MORE_INPUT,
//             };
//         }

//         const motionResult = parseOperatorMotion(vimState, operatorResult.rest, motions);
//         if (motionResult.kind === 'failure') {
//             return {
//                 kind: 'failure',
//                 status: motionResult.status,
//             };
//         }

//         motion = motionResult.motion;
//     }

//     return {
//         kind: 'success',
//         register: registerResult.register,
//         count: countResult.count,
//         motion: motion,
//     };
// }

export function parseKeysOperator(
    operatorKeys: string[],
    motions: OperatorMotion[],
    operator: (vimState: VimState, editor: vscode.TextEditor, register: string, count: number, ranges: vscode.Range[]) => void
): Action {
    return function(vimState, keys, editor) {
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

        let ranges;
        if (vimState.mode === Mode.Normal) {
            if (operatorResult.rest.length === 0) {
                return ParseKeysStatus.MORE_INPUT;
            }

            const motionResult = parseOperatorMotionPart(vimState, operatorResult.rest, editor, motions);
            if (motionResult.kind === 'failure') {
                return motionResult.status;
            }

            ranges = editor.selections.map(function(selection) {
                return motionResult.motion.exec(vimState, keys, editor.document, selection.active);
            });
        } else {
            ranges = editor.selections;
        }

        operator(vimState, editor, registerResult.register, countResult.count, ranges);
        return ParseKeysStatus.YES;
    };
}
