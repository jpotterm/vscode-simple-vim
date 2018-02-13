'use strict';
import * as vscode from 'vscode';
import { VimState } from './vim_state_types';

export function addTypeSubscription(
    vimState: VimState,
    typeHandler: (vimState: VimState, editor: vscode.TextEditor, char: string) => void,
): void {
    vimState.typeSubscription = vscode.commands.registerTextEditorCommand('type', function(editor, edit, e) {
        typeHandler(vimState, editor, e.text);
    });
}

export function removeTypeSubscription(vimState: VimState): void {
    if (vimState.typeSubscription) {
        vimState.typeSubscription.dispose();
    }
}
