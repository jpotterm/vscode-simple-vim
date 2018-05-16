import * as vscode from 'vscode';

import { VimState } from '../vim_state_types';

export function getRegisterContentsList(vimState: VimState, editor: vscode.TextEditor) {
    if (vimState.registers.contentsList.length === 0) return undefined;

    let registerContentsList = vimState.registers.contentsList;

    // Handle putting with a different number of cursors than when you yanked
    if (vimState.registers.contentsList.length !== editor.selections.length) {
        const combinedContents = vimState.registers.contentsList.join('\n');
        registerContentsList = editor.selections.map(selection => combinedContents);
    }

    return registerContentsList;
}
