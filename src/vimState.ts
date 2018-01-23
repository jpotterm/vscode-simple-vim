'use strict';
import * as vscode from 'vscode';

import { Mode } from './modes';

export class VimState {
    typeSubscription: vscode.Disposable;
    selectionSubscription: vscode.Disposable;
    mode: Mode;
    desiredColumns: number[] = [];
    keysPressed: string[] = [];
}
