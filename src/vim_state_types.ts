'use strict';
import * as vscode from 'vscode';

import { Mode } from './modes_types';

type Regsiter = {
    contents: string;
    linewise: boolean;
};

export type VimState = {
    typeSubscription: vscode.Disposable | undefined;
    mode: Mode;
    desiredColumns: number[];
    keysPressed: string[];
    registers: { [index: string]: Regsiter[] };
    semicolonAction: (vimState: VimState, editor: vscode.TextEditor) => void;
    commaAction: (vimState: VimState, editor: vscode.TextEditor) => void;
};
