'use strict';
import * as vscode from 'vscode';

import { Mode } from './modes';
import { VimState } from './vimState';
import { Action } from './action';
import { ParseKeys, parseKeysExact, ParseKeysStatus, parseKeysOperator, parseOperatorAll } from './parseKeys';
import * as motions from './motions';
import * as operators from './operators';
import * as positionUtils from './positionUtils';
import { OperatorMotion } from './operators';

const vimState = new VimState();

const operatorMotions: (OperatorMotion & ParseKeys)[] = [
    {
        parseKeys: parseKeysExact(['l']),
        exec: function(vimState, keys, document, position) {
            return new vscode.Range(position, positionUtils.right(document, position));
        },
    },
    {
        parseKeys: parseKeysExact(['h']),
        exec: function(vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position): vscode.Range {
            return new vscode.Range(position, positionUtils.left(document, position));
        },
    },
    {
        parseKeys: parseKeysExact(['k']),
        exec: function(vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position): vscode.Range {
            if (position.line === 0) {
                return new vscode.Range(position, position);
            }

            return new vscode.Range(
                new vscode.Position(position.line - 1, 0),
                positionUtils.lineEnd(document, position)
            );
        },
    },
    {
        parseKeys: parseKeysExact(['j']),
        exec: function(vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position): vscode.Range {
            if (position.line === document.lineCount - 1) {
                return new vscode.Range(position, position);
            }

            return new vscode.Range(
                new vscode.Position(position.line, 0),
                positionUtils.lineEnd(document, position.with({ line: position.line + 1 }))
            );
        },
    },
];

const actions: (Action & ParseKeys)[] = [
    // Actions
    {
        parseKeys: parseKeysExact(['i']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            enterInsertMode();
            removeSubscriptions();
        },
    },
    {
        parseKeys: parseKeysExact(['I']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            editor.selections = editor.selections.map(function(selection) {
                const newPosition = selection.active.with({ character: 0 });
                return new vscode.Selection(newPosition, newPosition);
            });

            enterInsertMode();
            removeSubscriptions();
        },
    },
    {
        parseKeys: parseKeysExact(['a']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            editor.selections = editor.selections.map(function(selection) {
                const newPosition = positionUtils.right(editor.document, selection.active);
                return new vscode.Selection(newPosition, newPosition);
            });

            enterInsertMode();
            removeSubscriptions();
        },
    },
    {
        parseKeys: parseKeysExact(['A']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            editor.selections = editor.selections.map(function(selection) {
                const lineLength = editor.document.lineAt(selection.active.line).text.length;
                const newPosition = selection.active.with({ character: lineLength });
                return new vscode.Selection(newPosition, newPosition);
            });

            enterInsertMode();
            removeSubscriptions();
        },
    },
    {
        parseKeys: parseKeysExact(['v'], [Mode.Normal, Mode.VisualLine]),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            enterVisualMode();

            editor.selections = editor.selections.map(function(selection) {
                const lineLength = editor.document.lineAt(selection.active.line).text.length;

                if (lineLength === 0) return selection;

                return new vscode.Selection(selection.active, positionUtils.right(editor.document, selection.active));
            });
        },
    },
    {
        parseKeys: parseKeysExact(['V'], [Mode.Normal, Mode.Visual]),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            enterVisualLineMode();

            editor.selections = editor.selections.map(function(selection) {
                const lineLength = editor.document.lineAt(selection.active.line).text.length;

                if (lineLength === 0) return selection;

                return new vscode.Selection(
                    selection.active.with({ character: 0 }),
                    selection.active.with({ character: lineLength })
                );
            });
        },
    },

    // Motions
    {
        parseKeys: parseKeysExact(['l']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            execMotion(motions.right);
            vimState.desiredColumns = [];
        },
    },
    {
        parseKeys: parseKeysExact(['h']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            execMotion(motions.left);
            vimState.desiredColumns = [];
        },
    },
    {
        parseKeys: parseKeysExact(['k']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            setDesiredColumns(editor, vimState);
            execMotion(motions.up);
        },
    },
    {
        parseKeys: parseKeysExact(['j']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            setDesiredColumns(editor, vimState);
            execMotion(motions.down);
        },
    },
    {
        parseKeys: parseKeysExact(['w']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            execMotion(motions.wordForward);
        },
    },
    {
        parseKeys: parseKeysExact(['b']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            execMotion(motions.wordBackward);
        },
    },
    {
        parseKeys: parseKeysExact(['e']),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            execMotion(motions.wordEnd);
        },
    },

    // Operators
    {
        parseKeys: parseKeysOperator(['d'], operatorMotions),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            const result = parseOperatorAll(vimState, keys, ['d'], operatorMotions);

            if (result.kind === 'failure') {
                return;
            }

            editor.selections.forEach(function(selection) {
                let range;
                if (vimState.mode === Mode.Normal && result.motion) {
                    range = result.motion.exec(vimState, keys, editor.document, selection.active);
                } else {
                    range = selection;
                }

                operators.delete_(vimState, editor, range);
            });
        },
    },
    {
        parseKeys: parseKeysOperator(['c'], operatorMotions),
        exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
            const result = parseOperatorAll(vimState, keys, ['c'], operatorMotions);

            if (result.kind === 'failure') {
                return;
            }

            editor.selections.forEach(function(selection) {
                let range;
                if (vimState.mode === Mode.Normal && result.motion) {
                    range = result.motion.exec(vimState, keys, editor.document, selection.active);
                } else {
                    range = selection;
                }

                operators.change(vimState, editor, range);
            });

            enterInsertMode();
        },
    },

    // {
    //     parseKeys: function(vimState: VimState, keys: string[]): ParseKeysResult {
    //         const result = parseOperator(vimState, keys);

    //         if (result.kind === 'success') {
    //             return {
    //                 status: ParseKeysStatus.YES,
    //                 rest: [],
    //             };
    //         } else {
    //             return {
    //                 status: result.status,
    //                 rest: [],
    //             };
    //         }
    //     },
    //     exec: function(vimState: VimState, keys: string[], editor: vscode.TextEditor): void {
    //         const result = parseOperator(vimState, keys);

    //         if (result.kind === 'failure') {
    //             return;
    //         }

    //         editor.selections.forEach(function(selection) {
    //             let range;
    //             if (vimState.mode === Mode.Normal && result.motion) {
    //                 range = result.motion.exec(vimState, keys, editor.document, selection.active);
    //             } else {
    //                 range = selection;
    //             }

    //             result.operator.exec(vimState, keys, editor, range);
    //         });
    //     },
    // },
];

async function typeHandler(e: { text: string }): Promise<void> {
    const char = e.text;
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.keysPressed.push(char);

    const actionDoes = actions.find(
        x => x.parseKeys(vimState, vimState.keysPressed) === ParseKeysStatus.YES
    );

    const actionCould = actions.find(
        x => x.parseKeys(vimState, vimState.keysPressed) === ParseKeysStatus.MORE_INPUT
    );

    if (actionDoes) {
        actionDoes.exec(vimState, vimState.keysPressed, editor);
        vimState.keysPressed = [];
    } else if (!actionCould) {
        vimState.keysPressed = [];
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
