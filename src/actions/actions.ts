import * as vscode from 'vscode';

import { Mode } from '../modes_types';
import { Action } from '../action_types';
import { parseKeysExact } from '../parse_keys';
import { enterInsertMode, enterVisualMode, enterVisualLineMode, enterNormalMode, setModeCursorStyle } from '../modes';
import * as positionUtils from '../position_utils';
import { removeTypeSubscription } from '../type_subscription';
import { arraySet } from '../array_utils';
import { VimState } from '../vim_state_types';
import { setVisualLineSelections } from '../visual_line_utils';
import { flashYankHighlight } from '../yank_highlight';

export const actions: Action[] = [
    parseKeysExact(['i'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  (vimState, editor) => {
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['I'], [Mode.Normal],  (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            const character = editor.document.lineAt(selection.active.line).firstNonWhitespaceCharacterIndex;
            const newPosition = selection.active.with({ character: character });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['a'], [Mode.Normal],  (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            const newPosition = positionUtils.right(editor.document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['A'], [Mode.Normal],  (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            const newPosition = selection.active.with({ character: lineLength });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['v'], [Mode.Normal, Mode.VisualLine],  (vimState, editor) => {
        if (vimState.mode === Mode.Normal) {
            editor.selections = editor.selections.map(selection => {
                const lineLength = editor.document.lineAt(selection.active.line).text.length;

                if (lineLength === 0) return selection;

                return new vscode.Selection(selection.active, positionUtils.right(editor.document, selection.active));
            });
        }

        enterVisualMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
    }),

    parseKeysExact(['V'], [Mode.Normal, Mode.Visual],  (vimState, editor) => {
        enterVisualLineMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        setVisualLineSelections(editor);
    }),

    parseKeysExact(['p'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  (vimState, editor) => {
        // Last put ranges
        if (vimState.mode === Mode.Normal) {
            vimState.lastPutRanges = {
                ranges: editor.selections.map((selection, i) => {
                    const registerContents = vimState.registers.contentsList[i];
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
                    const registerContents = vimState.registers.contentsList[i];
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

        const document = editor.document;

        if (vimState.mode === Mode.Normal) {
            const originalSelections = editor.selections;

            editor.edit(editBuilder => {
                editor.selections.forEach((selection, i) => {
                    const registerContents = vimState.registers.contentsList[i];
                    if (registerContents === undefined) return;

                    if (vimState.registers.linewise) {
                        const lineLength = document.lineAt(selection.active.line).text.length;
                        const insertPosition = new vscode.Position(selection.active.line, lineLength);
                        editBuilder.insert(insertPosition, '\n' + registerContents);
                    } else {
                        const insertPosition = positionUtils.right(document, selection.active);

                        // Move cursor to the insert position so it will end up at the end of the inserted text
                        editor.selections = arraySet(
                            editor.selections,
                            i,
                            new vscode.Selection(insertPosition, insertPosition),
                        );

                        // Insert text
                        editBuilder.insert(insertPosition, registerContents);
                    }
                });
            }).then(() => {
                editor.selections = editor.selections.map((selection, i) => {
                    const registerContents = vimState.registers.contentsList[i];
                    if (registerContents === undefined) return selection;

                    if (vimState.registers.linewise) {
                        const newPosition = new vscode.Position(originalSelections[i].active.line + 1, 0);
                        return new vscode.Selection(newPosition, newPosition);
                    } else {
                        // Cursor ends up after the insertion so move it one to
                        // the left so it's under the last inserted character
                        const newPosition = positionUtils.left(selection.active);
                        return new vscode.Selection(newPosition, newPosition);
                    }
                });
            });
        } else if (vimState.mode === Mode.Visual) {
            editor.edit(editBuilder => {
                editor.selections.forEach((selection, i) => {
                    const registerContents = vimState.registers.contentsList[i];
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
        } else {
            editor.edit(editBuilder => {
                editor.selections.forEach((selection, i) => {
                    const registerContents = vimState.registers.contentsList[i];
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
    }),

    parseKeysExact(['P'], [Mode.Normal],  (vimState, editor) => {
        // Last put ranges
        vimState.lastPutRanges = {
            ranges: editor.selections.map((selection, i) => {
                const registerContents = vimState.registers.contentsList[i];
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

        editor.edit(editBuilder => {
            editor.selections.forEach((selection, i) => {
                const registerContents = vimState.registers.contentsList[i];
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
                const registerContents = vimState.registers.contentsList[i];
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
    }),

    parseKeysExact(['u'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  (vimState, editor) => {
        vscode.commands.executeCommand('undo');
    }),

    parseKeysExact(['d', 'd'], [Mode.Normal],  (vimState, editor) => {
        deleteLine(vimState, editor);
    }),

    parseKeysExact(['D'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('deleteAllRight');
    }),

    parseKeysExact(['c', 'c'], [Mode.Normal],  (vimState, editor) => {
        editor.edit(editBuilder => {
            editor.selections.forEach(selection => {
                const line = editor.document.lineAt(selection.active.line);
                editBuilder.delete(new vscode.Range(
                    selection.active.with({ character: line.firstNonWhitespaceCharacterIndex }),
                    selection.active.with({ character: line.text.length }),
                ));
            });
        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['C'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('deleteAllRight');
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['o'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('editor.action.insertLineAfter');
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['O'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('editor.action.insertLineBefore');
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['H'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('cursorMove', { to: 'viewPortTop', by: 'line' });
    }),

    parseKeysExact(['M'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('cursorMove', { to: 'viewPortCenter', by: 'line' });
    }),

    parseKeysExact(['L'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('cursorMove', { to: 'viewPortBottom', by: 'line' });
    }),

    parseKeysExact(['z', 't'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'top',
        });
    }),

    parseKeysExact(['z', 'z'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'center',
        });
    }),

    parseKeysExact(['z', 'b'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'bottom',
        });
    }),

    parseKeysExact(['y', 'y'], [Mode.Normal],  (vimState, editor) => {
        yankLine(vimState, editor);

        // Yank highlight
        const highlightRanges = editor.selections.map(selection => {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            return new vscode.Range(
                selection.active.with({ character: 0 }),
                selection.active.with({ character: lineLength }),
            );
        });
        flashYankHighlight(editor, highlightRanges);
    }),

    parseKeysExact(['Y'], [Mode.Normal],  (vimState, editor) => {
        yankToEndOfLine(vimState, editor);

        // Yank highlight
        const highlightRanges = editor.selections.map(selection => {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            return new vscode.Range(
                selection.active,
                selection.active.with({ character: lineLength }),
            );
        });
        flashYankHighlight(editor, highlightRanges);
    }),

    parseKeysExact(['r', 'r'], [Mode.Normal],  (vimState, editor) => {
        yankLine(vimState, editor);
        deleteLine(vimState, editor);
    }),

    parseKeysExact(['R'], [Mode.Normal],  (vimState, editor) => {
        yankToEndOfLine(vimState, editor);
        vscode.commands.executeCommand('deleteAllRight');
    }),

    parseKeysExact(['x'], [Mode.Normal],  (vimState, editor) => {
        vscode.commands.executeCommand('deleteRight');
    }),

    parseKeysExact([';'], [Mode.Normal],  (vimState, editor) => {
        vimState.semicolonAction(vimState, editor);
    }),

    parseKeysExact([','], [Mode.Normal],  (vimState, editor) => {
        vimState.commaAction(vimState, editor);
    }),

    parseKeysExact(['g', 'p'], [Mode.Normal],  (vimState, editor) => {
        editor.selections = editor.selections.map((selection, i) => {
            const putRange = vimState.lastPutRanges.ranges[i];

            if (putRange) {
                return new vscode.Selection(putRange.start, putRange.end);
            } else {
                return selection;
            }
        });

        if (vimState.lastPutRanges.linewise) {
            enterVisualLineMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        } else {
            enterVisualMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        }
    }),
];

function deleteLine(vimState: VimState, editor: vscode.TextEditor): void {
    vscode.commands.executeCommand('editor.action.deleteLines').then(() => {
        editor.selections = editor.selections.map(selection => {
            const character = editor.document.lineAt(selection.active.line).firstNonWhitespaceCharacterIndex;
            const newPosition = selection.active.with({ character: character });
            return new vscode.Selection(newPosition, newPosition);
        });
    });
}

function yankLine(vimState: VimState, editor: vscode.TextEditor): void {
    vimState.registers = {
        contentsList: editor.selections.map(selection => {
            return editor.document.lineAt(selection.active.line).text;
        }),
        linewise: true,
    };
}

function yankToEndOfLine(vimState: VimState, editor: vscode.TextEditor): void {
    vimState.registers = {
        contentsList: editor.selections.map(selection => {
            return editor.document.lineAt(selection.active.line).text.substring(selection.active.character);
        }),
        linewise: false,
    };
}
