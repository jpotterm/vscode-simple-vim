import * as vscode from 'vscode';

import * as positionUtils from '../position_utils';
import { VimState } from '../vim_state_types';
import { Mode } from '../modes_types';
import { enterNormalMode, setModeCursorStyle } from '../modes';
import { getRegisterContentsList } from './common';

export function putAfter(vimState: VimState, editor: vscode.TextEditor) {
    const registerContentsList = getRegisterContentsList(vimState, editor);
    if (registerContentsList === undefined) return;

    lastPutRanges(vimState, editor, registerContentsList);

    if (vimState.mode === Mode.Normal) {
        if (vimState.registers.linewise) {
            normalModeLinewise(vimState, editor, registerContentsList);
        } else {
            normalModeCharacterwise(vimState, editor, registerContentsList);
        }
    } else if (vimState.mode === Mode.Visual) {
        visualMode(vimState, editor, registerContentsList);
    } else {
        visualLineMode(vimState, editor, registerContentsList);
    }
}

function lastPutRanges(vimState: VimState, editor: vscode.TextEditor, registerContentsList: (string | undefined)[]) {
    if (vimState.mode === Mode.Normal) {
        vimState.lastPutRanges = {
            ranges: editor.selections.map((selection, i) => {
                const registerContents = registerContentsList[i];
                if (!registerContents) return undefined;

                const registerLines = registerContents.split(/\r?\n/);
                const lastLineLength = registerLines[registerLines.length - 1].length;

                if (vimState.registers.linewise) {
                    return new vscode.Range(
                        new vscode.Position(selection.start.line + 1, 0),
                        new vscode.Position(selection.start.line + registerLines.length, lastLineLength),
                    );
                } else {
                    const endCharacter = registerLines.length === 1 ?
                        selection.start.character + 1 + lastLineLength :
                        lastLineLength;

                    return new vscode.Range(
                        selection.start.with({ character: selection.start.character + 1 }),
                        new vscode.Position(selection.start.line + (registerLines.length - 1), endCharacter),
                    );
                }
            }),
            linewise: vimState.registers.linewise,
        };
    } else {
        vimState.lastPutRanges = {
            ranges: editor.selections.map((selection, i) => {
                const registerContents = registerContentsList[i];
                if (!registerContents) return undefined;

                const registerLines = registerContents.split(/\r?\n/);

                const lastLineLength = registerLines[registerLines.length - 1].length;
                const endCharacter = registerLines.length === 1 ?
                    selection.start.character + lastLineLength :
                    lastLineLength;

                return new vscode.Range(
                    selection.start,
                    new vscode.Position(
                        selection.start.line + (registerLines.length - 1),
                        endCharacter,
                    ),
                );
            }),
            linewise: vimState.registers.linewise,
        };
    }
}

function normalModeLinewise(vimState: VimState, editor: vscode.TextEditor, registerContentsList: (string | undefined)[]) {
    const document = editor.document;

    editor.edit(editBuilder => {
        editor.selections.forEach((selection, i) => {
            const registerContents = registerContentsList[i];
            if (registerContents === undefined) return;

            if (selection.active.line === document.lineCount - 1) {
                const lineLength = document.lineAt(selection.active.line).text.length;
                const insertPosition = new vscode.Position(selection.active.line, lineLength);
                editBuilder.insert(insertPosition, '\n' + registerContents);
            } else {
                const insertPosition = new vscode.Position(selection.active.line + 1, 0);
                editBuilder.insert(insertPosition, registerContents + '\n');
            }
        });
    }).then(() => {
        const newSelections = editor.selections.map((selection, i) => {
            if (selection.active.line === document.lineCount - 1) {
                // Putting on an empty last line will leave the cursor at the end of the inserted
                // text so we have to compensate for that

                const registerContents = registerContentsList[i];
                if (registerContents === undefined) return selection;

                const registerLines = registerContents.split(/\r?\n/);

                const newPosition = new vscode.Position(selection.active.line - registerLines.length - 1, 0);
                return new vscode.Selection(newPosition, newPosition);
            } else {
                const newPosition = new vscode.Position(selection.active.line + 1, 0);
                return new vscode.Selection(newPosition, newPosition);
            }
        });

        editor.selections = newSelections;

        vimState.lastPutRanges = {
            ranges: newSelections.map((selection, i) => {
                const registerContents = registerContentsList[i];
                if (!registerContents) return undefined;

                const registerLines = registerContents.split(/\r?\n/);
                const lastLineLength = registerLines[registerLines.length - 1].length;

                return new vscode.Range(
                    new vscode.Position(selection.start.line, 0),
                    new vscode.Position(selection.start.line + registerLines.length - 1, lastLineLength),
                );
            }),
            linewise: true,
        };
    });
}

function normalModeCharacterwise(vimState: VimState, editor: vscode.TextEditor, registerContentsList: (string | undefined)[]) {
    const insertPositions = editor.selections.map(selection => {
        return positionUtils.right(editor.document, selection.active);
    });

    // Move cursor to the insert position so it will end up at the end of the inserted text
    editor.selections = insertPositions.map(x => new vscode.Selection(x, x));

    editor.edit(editBuilder => {
        insertPositions.forEach((insertPosition, i) => {
            const registerContents = registerContentsList[i];
            if (registerContents === undefined) return;

            editBuilder.insert(insertPosition, registerContents);
        });
    }).then(() => {
        vimState.lastPutRanges = {
            ranges: editor.selections.map((selection, i) => {
                const registerContents = registerContentsList[i];
                if (!registerContents) return undefined;

                const putBeginning = getPutBeginning(editor.document, selection.active, registerContents);
                return new vscode.Range(putBeginning, selection.active);
            }),
            linewise: false,
        };

        // Cursor ends up after the insertion so move it one to
        // the left so it's under the last inserted character
        editor.selections = editor.selections.map(selection => {
            const newPosition = positionUtils.left(selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });
    });
}

function visualMode(vimState: VimState, editor: vscode.TextEditor, registerContentsList: (string | undefined)[]) {
    editor.edit(editBuilder => {
        editor.selections.forEach((selection, i) => {
            const registerContents = registerContentsList[i];
            if (registerContents === undefined) return;

            const contents = vimState.registers.linewise ? '\n' + registerContents + '\n' : registerContents;

            editBuilder.delete(selection);
            editBuilder.insert(selection.start, contents);
        });
    }).then(() => {
        editor.selections = editor.selections.map(selection => {
            const newPosition = positionUtils.left(selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });
    });

    enterNormalMode(vimState);
    setModeCursorStyle(vimState.mode, editor);
}

function visualLineMode(vimState: VimState, editor: vscode.TextEditor, registerContentsList: (string | undefined)[]) {
    editor.edit(editBuilder => {
        editor.selections.forEach((selection, i) => {
            const registerContents = registerContentsList[i];
            if (registerContents === undefined) return;

            editBuilder.replace(selection, registerContents);
        });
    }).then(() => {
        editor.selections = editor.selections.map(selection => {
            return new vscode.Selection(selection.start, selection.start);
        });

        enterNormalMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
    });
}

function getPutBeginning(document: vscode.TextDocument, endPosition: vscode.Position, registerContents: string) {
    const registerLines = registerContents.split(/\r?\n/);

    if (registerLines.length > 1) {
        const beginningLine = endPosition.line - (registerLines.length - 1);
        const beginningCharacter = document.lineAt(beginningLine).text.length - registerLines[0].length;

        return new vscode.Position(beginningLine, beginningCharacter);
    } else {
        return endPosition.with({ character: endPosition.character - registerLines[0].length });
    }
}
