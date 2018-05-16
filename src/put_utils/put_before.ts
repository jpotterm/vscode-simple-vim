import * as vscode from 'vscode';

import * as positionUtils from '../position_utils';
import { VimState } from '../vim_state_types';
import { getRegisterContentsList } from './common';

export function putBefore(vimState: VimState, editor: vscode.TextEditor) {
    const registerContentsList = getRegisterContentsList(vimState, editor);
    if (registerContentsList === undefined) return;

    lastPutRanges(vimState, editor, registerContentsList);
    allModes(vimState, editor, registerContentsList);
}

function lastPutRanges(vimState: VimState, editor: vscode.TextEditor, registerContentsList: (string | undefined)[]) {
    vimState.lastPutRanges = {
        ranges: editor.selections.map((selection, i) => {
            const registerContents = registerContentsList[i];
            if (!registerContents) return undefined;

            const registerLines = registerContents.split(/\r?\n/);
            const lastLineLength = registerLines[registerLines.length - 1].length;

            if (vimState.registers.linewise) {
                return new vscode.Range(
                    new vscode.Position(selection.start.line, 0),
                    new vscode.Position(selection.start.line + (registerLines.length - 1), lastLineLength),
                );
            } else {
                const endCharacter = registerLines.length === 1 ?
                    selection.start.character + lastLineLength :
                    lastLineLength;

                return new vscode.Range(
                    selection.start.with({ character: selection.start.character }),
                    new vscode.Position(selection.start.line + (registerLines.length - 1), endCharacter),
                );
            }
        }),
        linewise: vimState.registers.linewise,
    };
}

function allModes(vimState: VimState, editor: vscode.TextEditor, registerContentsList: (string | undefined)[]) {
    editor.edit(editBuilder => {
        editor.selections.forEach((selection, i) => {
            const registerContents = registerContentsList[i];
            if (registerContents === undefined) return;

            if (vimState.registers.linewise) {
                const insertPosition = new vscode.Position(selection.active.line, 0);
                editBuilder.insert(insertPosition, registerContents + '\n');
            } else {
                editBuilder.insert(selection.active, registerContents);
            }
        });
    }).then(() => {
        editor.selections = editor.selections.map((selection, i) => {
            const registerContents = registerContentsList[i];
            if (registerContents === undefined) return selection;

            if (vimState.registers.linewise) {
                const newPosition = new vscode.Position(selection.active.line, 0);
                return new vscode.Selection(newPosition, newPosition);
            } else {
                // Cursor ends up after the insertion so move it one to
                // the left so it's under the last inserted character
                const newPosition = positionUtils.left(selection.active);
                return new vscode.Selection(newPosition, newPosition);
            }
        });
    });
}
