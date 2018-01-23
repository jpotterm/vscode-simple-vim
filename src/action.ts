'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';

export interface Action {
    couldApply: (vimState: VimState, keysPressed: string[]) => boolean;
    doesApply: (vimState: VimState, keysPressed: string[]) => boolean;
    exec: (vimState: VimState, keysPressed: string[], editor: vscode.TextEditor) => void;
}
