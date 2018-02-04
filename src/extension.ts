'use strict';
import * as vscode from 'vscode';

import { Mode } from './modes';
import { VimState } from './vimState';
import { Action } from './actionTypes';
import { parseKeysExact, parseKeysOperator, createOperatorMotionExactKeys, parseKeysRegex, createOperatorMotionRegex } from './parseKeys';
import { ParseKeysStatus, OperatorMotion } from './parseKeysTypes';
import * as motions from './motions';
import * as operators from './operators';
import * as positionUtils from './positionUtils';
import * as scrollCommands from './scrollCommands';
import { arraySet } from './arrayUtils';
import { searchForward, searchBackward } from './searchUtils';

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
    createOperatorMotionRegex(/^f(..)$/, /^(f|f.)$/, function(vimState, document, position, match) {
        const fromPosition = position.with({ character: position.character + 1 });
        const result = searchForward(document, match[1], fromPosition);

        if (result) {
            return {
                range: new vscode.Range(position, result),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionRegex(/^F(..)$/, /^(F|F.)$/, function(vimState, document, position, match) {
        const fromPosition = position.with({ character: position.character - 1 });
        const result = searchBackward(document, match[1], fromPosition);

        if (result) {
            return {
                range: new vscode.Range(position, result),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionRegex(/^t(.)$/, /^t$/, function(vimState, document, position, match) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.indexOf(match[1], position.character + 1);

        if (result >= 0) {
            return {
                range: new vscode.Range(position, position.with({ character: result })),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionRegex(/^T(.)$/, /^T$/, function(vimState, document, position, match) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.lastIndexOf(match[1], position.character - 1);

        if (result >= 0) {
            const newPosition = positionUtils.right(document, position.with({ character: result }));
            return {
                range: new vscode.Range(newPosition, position),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),
    createOperatorMotionExactKeys(['g', 'g'], function(vimState, document, position) {
        const lineLength = document.lineAt(position.line).text.length;

        return {
            range: new vscode.Range(
                new vscode.Position(0, 0),
                position.with({ character: lineLength })
            ),
            linewise: true,
        };
    }),
    createOperatorMotionExactKeys(['G'], function(vimState, document, position) {
        const lineLength = document.lineAt(document.lineCount - 1).text.length;

        return {
            range: new vscode.Range(
                position.with({ character: 0 }),
                new vscode.Position(document.lineCount - 1, lineLength),
            ),
            linewise: true,
        };
    }),
];

const actions: Action[] = [
    // Actions
    parseKeysExact(['i'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        enterInsertMode();
        removeTypeSubscription();
    }),
    parseKeysExact(['I'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({ character: 0 });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeTypeSubscription();
    }),
    parseKeysExact(['a'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.right(editor.document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeTypeSubscription();
    }),
    parseKeysExact(['A'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            const newPosition = selection.active.with({ character: lineLength });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeTypeSubscription();
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
            editor.edit(function(editBuilder) {
                editor.selections.forEach(function(selection, i) {
                    const registerArray = vimState.registers['"'];
                    if (registerArray === undefined || registerArray[i] === undefined) return;
                    const register = registerArray[i];

                    if (register.linewise) {
                        const insertPosition = new vscode.Position(selection.active.line + 1, 0);
                        editBuilder.insert(insertPosition, register.contents + '\n');
                    } else {
                        const insertPosition = positionUtils.right(document, selection.active);

                        // Move cursor to the insert position so it will end up at the end of the inserted text
                        editor.selections = arraySet(editor.selections, i, new vscode.Selection(insertPosition, insertPosition));

                        // Insert text
                        editBuilder.insert(insertPosition, register.contents);
                    }
                });
            }).then(function() {
                editor.selections = editor.selections.map(function(selection, i) {
                    const registerArray = vimState.registers['"'];
                    if (registerArray === undefined || registerArray[i] === undefined) return selection;
                    const register = registerArray[i];

                    if (register.linewise) {
                        const newPosition = new vscode.Position(selection.active.line + 1, 0);
                        return new vscode.Selection(newPosition, newPosition);
                    } else {
                        // Cursor ends up after the insertion so move it one to
                        // the left so it's under the last inserted character
                        const newPosition = positionUtils.left(document, selection.active);
                        return new vscode.Selection(newPosition, newPosition);
                    }
                });
            });
        } else if (vimState.mode === Mode.Visual) {
            editor.edit(function(editBuilder) {
                editor.selections.forEach(function(selection, i) {
                    const registerArray = vimState.registers['"'];
                    if (registerArray === undefined || registerArray[i] === undefined) return;
                    const register = registerArray[i];

                    const contents = register.linewise ? '\n' + register.contents + '\n' : register.contents;

                    editBuilder.delete(selection);
                    editBuilder.insert(selection.start, contents);
                });
            }).then(function() {
                editor.selections = editor.selections.map(function(selection) {
                    const newPosition = positionUtils.left(document, selection.active);
                    return new vscode.Selection(newPosition, newPosition);
                });
            });

            enterNormalMode();
        } else {
            editor.edit(function(editBuilder) {
                editor.selections.forEach(function(selection, i) {
                    const registerArray = vimState.registers['"'];
                    if (registerArray === undefined || registerArray[i] === undefined) return;
                    const register = registerArray[i];

                    editBuilder.replace(selection, register.contents);
                });
            }).then(function() {
                editor.selections = editor.selections.map(function(selection) {
                    return new vscode.Selection(selection.start, selection.start);
                });
            });

            enterNormalMode();
        }
    }),
    parseKeysExact(['P'], [Mode.Normal],  function(vimState, editor) {
        const document = editor.document;

        editor.edit(function(editBuilder) {
            editor.selections.forEach(function(selection, i) {
                const registerArray = vimState.registers['"'];
                if (registerArray === undefined || registerArray[i] === undefined) return;
                const register = registerArray[i];

                if (register.linewise) {
                    const insertPosition = new vscode.Position(selection.active.line, 0);
                    editBuilder.insert(insertPosition, register.contents + '\n');
                } else {
                    editBuilder.insert(selection.active, register.contents);
                }
            });
        }).then(function() {
            editor.selections = editor.selections.map(function(selection, i) {
                const registerArray = vimState.registers['"'];
                if (registerArray === undefined || registerArray[i] === undefined) return selection;
                const register = registerArray[i];

                if (register.linewise) {
                    const newPosition = new vscode.Position(selection.active.line, 0);
                    return new vscode.Selection(newPosition, newPosition);
                } else {
                    // Cursor ends up after the insertion so move it one to
                    // the left so it's under the last inserted character
                    const newPosition = positionUtils.left(document, selection.active);
                    return new vscode.Selection(newPosition, newPosition);
                }
            });
        });
    }),
    parseKeysExact(['u'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        vscode.commands.executeCommand('undo');
    }),
    parseKeysExact(['d', 'd'], [Mode.Normal],  function(vimState, editor) {
        const document = editor.document;

        vscode.commands.executeCommand('editor.action.deleteLines').then(function() {
            editor.selections = editor.selections.map(function(selection) {
                const character = document.lineAt(selection.active.line).firstNonWhitespaceCharacterIndex;
                const newPosition = selection.active.with({ character: character });
                return new vscode.Selection(newPosition, newPosition);
            });
        });
    }),
    parseKeysExact(['o'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('editor.action.insertLineAfter');
        enterInsertMode();
        removeTypeSubscription();
    }),
    parseKeysExact(['O'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('editor.action.insertLineBefore');
        enterInsertMode();
        removeTypeSubscription();
    }),
    parseKeysExact(['H'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('cursorMove', { to: 'viewPortTop', by: 'line' });
    }),
    parseKeysExact(['M'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('cursorMove', { to: 'viewPortCenter', by: 'line' });
    }),
    parseKeysExact(['L'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('cursorMove', { to: 'viewPortBottom', by: 'line' });
    }),
    parseKeysExact(['z', 't'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'top',
        });
    }),
    parseKeysExact(['z', 'z'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'center',
        });
    }),
    parseKeysExact(['z', 'b'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'bottom',
        });
    }),

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
    parseKeysRegex(/^f(..)$/, /^(f|f.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.findForward);
    }),
    parseKeysRegex(/^F(..)$/, /^(F|F.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.findBackward);
    }),
    parseKeysRegex(/^t(.)$/, /^t$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.tillForward);
    }),
    parseKeysRegex(/^T(.)$/, /^T$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.tillBackward);
    }),
    parseKeysExact(['g', 'g'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(motions.fileBeginning);
    }),
    parseKeysExact(['G'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(motions.fileEnd);
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
        removeTypeSubscription();
    }),
    parseKeysOperator(['y'], operatorMotions, function(vimState, editor, register, count, ranges) {
        vimState.registers[register] = ranges.map(function(range) {
            return {
                contents: editor.document.getText(range.range),
                linewise: range.linewise,
            };
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

function execRegexMotion(match: RegExpMatchArray, regexMotion: (args: motions.RegexMotionArgs) => vscode.Position) {
    return execMotion(function(motionArgs) {
        return regexMotion({
            ...motionArgs,
            match: match,
        });
    });
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

    editor.revealRange(new vscode.Range(editor.selection.active, editor.selection.active));
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
        addTypeSubscription();
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

    setModeContext('extension.simpleVim.insertMode');
}

function enterNormalMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Normal;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.Underline;

    setModeContext('extension.simpleVim.normalMode');
}

function enterVisualMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Visual;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;

    setModeContext('extension.simpleVim.visualMode');
}

function enterVisualLineMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.VisualLine;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;

    setModeContext('extension.simpleVim.visualLineMode');
}

function setModeContext(key: string) {
    const modeKeys = [
        'extension.simpleVim.insertMode',
        'extension.simpleVim.normalMode',
        'extension.simpleVim.visualMode',
        'extension.simpleVim.visualLineMode',
    ];

    modeKeys.forEach(function(modeKey) {
        vscode.commands.executeCommand('setContext', modeKey, key === modeKey);
    });
}

function addTypeSubscription(): void {
    vimState.typeSubscription = vscode.commands.registerCommand('type', typeHandler);
}

function removeTypeSubscription(): void {
    vimState.typeSubscription.dispose();
}

function onSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.kind === undefined ||
        e.kind === vscode.TextEditorSelectionChangeKind.Command ||
        vimState.mode === Mode.Insert
    ) {
        return;
    }

    console.log('Selection changed:', e.kind);

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

function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
    if (!editor) return;

    if (vimState.mode === Mode.Insert) {
        enterNormalMode();
        addTypeSubscription();
    } else {
        if (editor.selections.every(selection => selection.isEmpty)) {
            enterNormalMode();
        } else {
            enterVisualMode();
        }
    }

    vimState.desiredColumns = [];
    vimState.keysPressed = [];
}

export function activate(context: vscode.ExtensionContext): void {
    console.log('Simple Vim is active!');

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),
        vscode.window.onDidChangeTextEditorSelection(onSelectionChange),
        vscode.commands.registerCommand('extension.simpleVim.escapeKey', escapeHandler),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollDownHalfPage',
            scrollCommands.scrollDownHalfPage
        ),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollUpHalfPage',
            scrollCommands.scrollUpHalfPage
        ),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollDownPage',
            scrollCommands.scrollDownPage
        ),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollUpPage',
            scrollCommands.scrollUpPage
        )
    );

    if (vscode.window.activeTextEditor) {
        onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
    }
}

export function deactivate(): void {
    removeTypeSubscription();
}
