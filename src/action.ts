'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';

export interface Action {
    exec: (vimState: VimState, keys: string[], editor: vscode.TextEditor) => void;
}
