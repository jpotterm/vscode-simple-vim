'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';

export interface Action {
    exec: (vimState: VimState, keysPressed: string[], editor: vscode.TextEditor) => void;
}

export interface OperatorMotion {
    exec: (vimState: VimState, keysPressed: string[], document: vscode.TextDocument, position: vscode.Position) => vscode.Range;
}
