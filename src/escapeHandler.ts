'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimStateTypes';
import { enterNormalMode } from './modes';
import { addTypeSubscription } from './typeSubscription';
import { typeHandler } from './typeHandler';
import * as positionUtils from './positionUtils';
import { Mode } from './modesTypes';

export function escapeHandler(vimState: VimState): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    const document = editor.document;

    if (vimState.mode === Mode.Insert) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.left(selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode(vimState);
        addTypeSubscription(vimState, typeHandler);
    } else if (vimState.mode === Mode.Normal) {
        // Clear multiple cursors
        if (editor.selections.length > 1) {
            editor.selections = [editor.selections[0]];
        }
    } else if (vimState.mode === Mode.Visual) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = new vscode.Position(selection.active.line, Math.max(selection.active.character - 1, 0));
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode(vimState);
    }  else if (vimState.mode === Mode.VisualLine) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({
                character: Math.max(selection.active.character - 1, 0),
            });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode(vimState);
    }

    vimState.keysPressed = [];
}
