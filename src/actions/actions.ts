'use strict';
import * as vscode from 'vscode';

import { Mode } from '../modesTypes';
import { Action } from '../actionTypes';
import {
    parseKeysExact,
    parseKeysOperator,
    createOperatorMotionExactKeys,
    parseKeysRegex,
    createOperatorMotionRegex,
} from '../parseKeys';
import { enterInsertMode, enterVisualMode, enterVisualLineMode, enterNormalMode } from '../modes';
import * as positionUtils from '../positionUtils';
import { removeTypeSubscription } from '../typeSubscription';
import { arraySet } from '../arrayUtils';

export const actions: Action[] = [
    parseKeysExact(['i'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        enterInsertMode(vimState);
        removeTypeSubscription(vimState);
    }),
    parseKeysExact(['I'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({ character: 0 });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        removeTypeSubscription(vimState);
    }),
    parseKeysExact(['a'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.right(editor.document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        removeTypeSubscription(vimState);
    }),
    parseKeysExact(['A'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            const newPosition = selection.active.with({ character: lineLength });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        removeTypeSubscription(vimState);
    }),
    parseKeysExact(['v'], [Mode.Normal, Mode.VisualLine],  function(vimState, editor) {
        enterVisualMode(vimState);

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            return new vscode.Selection(selection.active, positionUtils.right(editor.document, selection.active));
        });
    }),
    parseKeysExact(['V'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        enterVisualLineMode(vimState);

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            return new vscode.Selection(
                selection.active.with({ character: 0 }),
                selection.active.with({ character: lineLength }),
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
                        editor.selections = arraySet(
                            editor.selections,
                            i,
                            new vscode.Selection(insertPosition, insertPosition),
                        );

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

            enterNormalMode(vimState);
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

            enterNormalMode(vimState);
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
        enterInsertMode(vimState);
        removeTypeSubscription(vimState);
    }),
    parseKeysExact(['O'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('editor.action.insertLineBefore');
        enterInsertMode(vimState);
        removeTypeSubscription(vimState);
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
    parseKeysExact(['y', 'y'], [Mode.Normal],  function(vimState, editor) {
        const document = editor.document;
        const register = '"';

        vimState.registers[register] = editor.selections.map(function(selection) {
            return {
                contents: document.lineAt(selection.active).text,
                linewise: true,
            };
        });
    }),
    parseKeysExact(['Y'], [Mode.Normal],  function(vimState, editor) {
        const document = editor.document;
        const register = '"';

        vimState.registers[register] = editor.selections.map(function(selection) {
            return {
                contents: document.lineAt(selection.active).text.substring(selection.active.character),
                linewise: false,
            };
        });
    }),
    parseKeysExact(['x'], [Mode.Normal],  function(vimState, editor) {
        vscode.commands.executeCommand('deleteRight');
    }),
    parseKeysExact([';'], [Mode.Normal],  function(vimState, editor) {
        vimState.semicolonAction(vimState, editor);
    }),
    parseKeysExact([','], [Mode.Normal],  function(vimState, editor) {
        vimState.commaAction(vimState, editor);
    }),
];
