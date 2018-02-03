'use strict';
import * as vscode from 'vscode';

import { Mode } from './modes';

type Regsiter = {
    contents: string;
    linewise: boolean;
};

export class VimState {
    typeSubscription: vscode.Disposable;
    selectionSubscription: vscode.Disposable;
    mode: Mode;
    desiredColumns: number[] = [];
    keysPressed: string[] = [];
    registers: { [index: string]: Regsiter[] } = {};
}
