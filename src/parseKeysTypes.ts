'use strict';
import * as vscode from 'vscode';
import { VimState } from './vimState';

export enum ParseKeysStatus {
    YES,
    NO,
    MORE_INPUT,
}

export type ParseFailure = {
    kind: 'failure';
    status: ParseKeysStatus;
};

export type ParseRegisterPartSuccess = {
    kind: 'success';
    register: string;
    rest: string[];
};

export type ParseCountPartSuccess = {
    kind: 'success';
    count: number;
    rest: string[];
};

export type ParseOperatorPartSuccess = {
    kind: 'success';
    rest: string[];
};

// export type ParseOperatorMotionPartSuccess = {
//     kind: 'success';
//     motion: OperatorMotion;
// };

export type ParseOperatorMotionSuccess = {
    kind: 'success';
    ranges: vscode.Range[];
};

export type ParseOperatorSuccess = {
    kind: 'success';
    register: string;
    count: number;
    motion: OperatorMotion | undefined;
};

export type OperatorMotion = (
    vimState: VimState,
    keys: string[],
    editor: vscode.TextEditor
) => ParseFailure | ParseOperatorMotionSuccess;
