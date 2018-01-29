'use strict';
import * as vscode from 'vscode';

import { Mode } from './modes';
import { VimState } from './vimState';
import { Action } from './actionTypes';
import { parseKeysExact, parseKeysOperator, createOperatorMotionExactKeys } from './parseKeys';
import { ParseKeysStatus, OperatorMotion } from './parseKeysTypes';
import * as motions from './motions';
import * as operators from './operators';
import * as positionUtils from './positionUtils';

const vimState = new VimState();

const operatorMotions: OperatorMotion[] = [
    createOperatorMotionExactKeys(['l'], function(vimState, document, position) {
        return {
            range: new vscode.Range(position, positionUtils.right(document, position)),
            linewise: false,
        };
    }),
    createOperatorMotionExactKeys(['h'], function(vimState, document, position) {
        return {
            range: new vscode.Range(position, positionUtils.left(document, position)),
            linewise: false,
        };
    }),
    createOperatorMotionExactKeys(['k'], function(vimState, document, position) {
        if (position.line === 0) {
            return {
                range: new vscode.Range(position, position),
                linewise: true,
            }
        }

        return {
            range: new vscode.Range(
                new vscode.Position(position.line - 1, 0),
                positionUtils.lineEnd(document, position)
            ),
            linewise: true,
        };
    }),
    createOperatorMotionExactKeys(['j'], function(vimState, document, position) {
        if (position.line === document.lineCount - 1) {
            return {
                range: new vscode.Range(position, position),
                linewise: true,
            };
        }

        return {
            range: new vscode.Range(
                new vscode.Position(position.line, 0),
                positionUtils.lineEnd(document, position.with({ line: position.line + 1 }))
            ),
            linewise: true,
        };
    }),
];

const actions: Action[] = [
    // Actions
    parseKeysExact(['i'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        enterInsertMode();
        removeSubscriptions();
    }),
    parseKeysExact(['I'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({ character: 0 });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeSubscriptions();
    }),
    parseKeysExact(['a'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.right(editor.document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeSubscriptions();
    }),
    parseKeysExact(['A'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            const newPosition = selection.active.with({ character: lineLength });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeSubscriptions();
    }),
    parseKeysExact(['v'], [Mode.Normal, Mode.VisualLine],  function(vimState, editor) {
        enterVisualMode();

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            return new vscode.Selection(selection.active, positionUtils.right(editor.document, selection.active));
        });
    }),
    parseKeysExact(['V'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        enterVisualLineMode();

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            return new vscode.Selection(
                selection.active.with({ character: 0 }),
                selection.active.with({ character: lineLength })
            );
        });
    }),
    parseKeysExact(['p'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        const document = editor.document;

        if (vimState.mode === Mode.Normal) {
            editor.selections.forEach(function(selection, i) {
                editor.edit(function(editBuilder) {
                    const register = vimState.registers[i + '"'];

                    if (register.linewise) {
                        editBuilder.insert(
                            new vscode.Position(selection.active.line + 1, 0),
                            register.contents + eolString(document.eol)
                        );
                    } else {
                        editBuilder.insert(positionUtils.right(document, selection.active), register.contents);
                    }
                });
            });
        } else if (vimState.mode === Mode.Visual) {
            const finalCursorPositions: vscode.Position[] = [];
            const editPromises: Thenable<boolean>[] = [];

            editor.selections.forEach(function(selection, i) {
                const register = vimState.registers[i + '"'];

                if (!register) return;

                const contents = register.linewise ? '\n' + register.contents + '\n' : register.contents;
                const contentsLines = contents.split(/\r?\n/);
                const contentsLastLine = contentsLines[contentsLines.length - 1];

                const character = (contentsLines.length === 1 ?
                    selection.start.character + (contents.length - 1) :
                    contentsLastLine.length - 1
                );

                finalCursorPositions.push(new vscode.Position(
                    selection.start.line + (contentsLines.length - 1),
                    character
                ));

                editPromises.push(
                    editor.edit(function(editBuilder) {
                        editBuilder.replace(selection, contents);
                    })
                );
            });

            Promise.all(editPromises).then(function() {
                editor.selections = editor.selections.map(function(selection, i) {
                    return new vscode.Selection(finalCursorPositions[i], finalCursorPositions[i]);
                });
            });
        } else {
            editor.selections.forEach(function(selection, i) {
                editor.edit(function(editBuilder) {
                    const register = vimState.registers[i + '"'];
                    editBuilder.replace(selection, register.contents);
                });
            });
        }

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            // editor.selections = editor.selections.map(function(selection) {
            //     return new vscode.Selection(selection.active, selection.active);
            // });

            enterNormalMode();
        }
    }),
    // parseKeysExact(['z'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
    //     const document = editor.document;

    //     console.log('First line before:', document.lineAt(0));

    //     // const newPosition = new vscode.Position(0, 20);
    //     // editor.selections[0] = new vscode.Selection(newPosition, newPosition);

    //     editor.edit(function(editBuilder) {
    //         // editBuilder.replace(
    //         //     new vscode.Range(
    //         //         new vscode.Position(0, 4),
    //         //         new vscode.Position(0, 7)
    //         //     ),
    //         //     'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
    //         // );
    //         editBuilder.delete(
    //             new vscode.Range(
    //                 new vscode.Position(0, 4),
    //                 new vscode.Position(0, 7)
    //             )
    //         );
    //         editBuilder.insert(
    //             new vscode.Position(0, 4),
    //             'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
    //         );
    //     }).then(function() {
    //         console.log('First line after:', document.lineAt(0));

    //         editor.selections = editor.selections.map(function(selection) {
    //             const newPosition = selection.active.with({ character: selection.active.character - 1 });
    //             return new vscode.Selection(newPosition, newPosition);
    //         });

    //         enterNormalMode();
    //     });
    // }),

    // Motions
    parseKeysExact(['l'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.right);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['h'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.left);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['k'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        setDesiredColumns(editor, vimState);
        execMotion(motions.up);
    }),
    parseKeysExact(['j'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        setDesiredColumns(editor, vimState);
        execMotion(motions.down);
    }),
    parseKeysExact(['w'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.wordForward);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['b'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.wordBackward);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['e'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.wordEnd);
        vimState.desiredColumns = [];
    }),

    // Operators
    parseKeysOperator(['d'], operatorMotions, function(vimState, editor, register, count, ranges) {
        ranges.forEach(function(range, i) {
            operators.delete_(vimState, editor, i + register, count, range);
        });
    }),
    parseKeysOperator(['c'], operatorMotions, function(vimState, editor, register, count, ranges) {
        ranges.forEach(function(range, i) {
            operators.change(vimState, editor, i + register, count, range);
        });

        enterInsertMode();
    }),
    parseKeysOperator(['y'], operatorMotions, function(vimState, editor, register, count, ranges) {
        ranges.forEach(function(range, i) {
            operators.yank(vimState, editor, i + register, count, range);
        });

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            // Move cursor to start of yanked text
            editor.selections = editor.selections.map(function(selection) {
                return new vscode.Selection(selection.start, selection.start);
            });

            enterNormalMode();
        }
    }),
];

function typeHandler(e: { text: string }): void {
    const char = e.text;
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.keysPressed.push(char);

    try {
        let could = false;
        for (let action of actions) {
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
    } catch(error) {
        console.error(error);
    }
}

function eolString(eol: vscode.EndOfLine) {
    if (eol === vscode.EndOfLine.CRLF) {
        return '\r\n';
    } else {
        return '\n';
    }
}

function setDesiredColumns(editor: vscode.TextEditor, vimState: VimState): void {
    if (vimState.desiredColumns.length !== 0) return;

    const document = editor.document;

    if (vimState.mode === Mode.Normal) {
        vimState.desiredColumns = editor.selections.map(x => x.active.character);
    } else {
        vimState.desiredColumns = editor.selections.map(function(selection) {
            return vscodeToVimVisualSelection(document, selection).active.character;
        });
    }
}

function vscodeToVimVisualSelection(document: vscode.TextDocument, vscodeSelection: vscode.Selection): vscode.Selection {
    if (vscodeSelection.active.isBefore(vscodeSelection.anchor)) {
        return new vscode.Selection(
            positionUtils.left(document, vscodeSelection.anchor),
            vscodeSelection.active
        );
    } else {
        return new vscode.Selection(
            vscodeSelection.anchor,
            positionUtils.left(document, vscodeSelection.active)
        );
    }
}

function vimToVscodeVisualSelection(document: vscode.TextDocument, vimSelection: vscode.Selection): vscode.Selection {
    if (vimSelection.active.isBefore(vimSelection.anchor)) {
        return new vscode.Selection(
            positionUtils.right(document, vimSelection.anchor),
            vimSelection.active
        );
    } else {
        return new vscode.Selection(
            vimSelection.anchor,
            positionUtils.right(document, vimSelection.active)
        );
    }
}

function vscodeToVimVisualLineSelection(document: vscode.TextDocument, vscodeSelection: vscode.Selection): vscode.Selection {
    return new vscode.Selection(
        vscodeSelection.anchor.with({ character: 0 }),
        vscodeSelection.active.with({ character: 0 }),
    );
}

function vimToVscodeVisualLineSelection(document: vscode.TextDocument, vimSelection: vscode.Selection): vscode.Selection {
    const anchorLineLength = document.lineAt(vimSelection.anchor.line).text.length;
    const activeLineLength = document.lineAt(vimSelection.active.line).text.length;

    if (vimSelection.active.isBefore(vimSelection.anchor)) {
        return new vscode.Selection(
            vimSelection.anchor.with({ character: anchorLineLength }),
            vimSelection.active.with({ character: 0 })
        );
    } else {
        return new vscode.Selection(
            vimSelection.anchor.with({ character: 0 }),
            vimSelection.active.with({ character: activeLineLength })
        );
    }
}

function execMotion(motion: (args: motions.MotionArgs) => vscode.Position) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    const document = editor.document;

    editor.selections = editor.selections.map(x => x);

    editor.selections = editor.selections.map(function(selection, i) {
        if (vimState.mode === Mode.Normal) {
            const newPosition = motion({
                document: document,
                position: selection.active,
                selectionIndex: i,
                vimState: vimState,
            });
            return new vscode.Selection(newPosition, newPosition);
        } else if (vimState.mode === Mode.Visual) {
            const vimSelection = vscodeToVimVisualSelection(document, selection);
            const motionPosition = motion({
                document: document,
                position: vimSelection.active,
                selectionIndex: i,
                vimState: vimState,
            });

            return vimToVscodeVisualSelection(document, new vscode.Selection(vimSelection.anchor, motionPosition));
        } else if (vimState.mode === Mode.VisualLine) {
            const vimSelection = vscodeToVimVisualLineSelection(document, selection);
            const motionPosition = motion({
                document: document,
                position: vimSelection.active,
                selectionIndex: i,
                vimState: vimState,
            });

            return vimToVscodeVisualLineSelection(document, new vscode.Selection(vimSelection.anchor, motionPosition));
        } else {
            return selection;
        }
    });
}

function escapeHandler(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    const document = editor.document;

    if (vimState.mode === Mode.Insert) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.left(document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode();
        addSubscriptions();
    } else if (vimState.mode === Mode.Visual) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = new vscode.Position(selection.active.line, Math.max(selection.active.character - 1, 0));
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode();
    }  else if (vimState.mode === Mode.VisualLine) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({
                character: Math.max(selection.active.character - 1, 0)
            });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode();
    }
}

function enterInsertMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Insert;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
    vimState.typeSubscription.dispose();
    vimState.selectionSubscription.dispose();
}

function enterNormalMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Normal;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.Underline;
}

function enterVisualMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Visual;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
}

function enterVisualLineMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.VisualLine;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
}

function addSubscriptions(): void {
    vimState.typeSubscription = vscode.commands.registerCommand('type', typeHandler);
    vimState.selectionSubscription = vscode.window.onDidChangeTextEditorSelection(onSelectionChange);
}

function removeSubscriptions(): void {
    vimState.typeSubscription.dispose();
    vimState.selectionSubscription.dispose();
}

function onSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.kind === undefined || e.kind === vscode.TextEditorSelectionChangeKind.Command) return;

    console.log('Selection changed');

    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.desiredColumns = [];

    editor.selections = editor.selections.map(function(selection, i) {
        const lineLength = editor.document.lineAt(selection.active.line).text.length;

        if (lineLength > 0 && selection.active.character === lineLength) {
            const newPosition = new vscode.Position(
                selection.active.line,
                lineLength - 1,
            );
            return new vscode.Selection(newPosition, newPosition);
        } else {
            return selection;
        }
    });
}

export function activate(context: vscode.ExtensionContext): void {
    console.log('Simple Vim is active!');

    enterNormalMode();
    addSubscriptions();
    context.subscriptions.push(vscode.commands.registerCommand('extension.simpleVim.escapeKey', escapeHandler));
}

export function deactivate(): void {
    removeSubscriptions();
}
