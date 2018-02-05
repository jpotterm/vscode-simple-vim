'use strict';
import * as vscode from 'vscode';

import { ParseKeysStatus } from './parseKeysTypes';
import { actions } from './actions';
import { VimState } from './vimStateTypes';

export function typeHandler(vimState: VimState, char: string): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.keysPressed.push(char);

    try {
        let could = false;
        for (const action of actions) {
            const result = action(vimState, vimState.keysPressed, editor);

            if (result === ParseKeysStatus.YES) {
                vimState.keysPressed = [];
                break;
            } else if (result === ParseKeysStatus.MORE_INPUT) {
                could = true;
            }
        }

        if (!could) {
            vimState.keysPressed = [];
        }
    } catch (error) {
        console.error(error);
    }
}
