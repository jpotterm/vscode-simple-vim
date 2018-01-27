'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';

export async function delete_(vimState: VimState, editor: vscode.TextEditor, range: vscode.Range) {
    await editor.edit(function(editBuilder) {
        editBuilder.delete(range);
    });
}

export async function change(vimState: VimState, editor: vscode.TextEditor, range: vscode.Range) {
    await editor.edit(function(editBuilder) {
        editBuilder.delete(range);
    });
}
