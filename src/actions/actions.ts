import * as vscode from 'vscode';

import { Mode } from '../modes_types';
import { Action } from '../action_types';
import { parseKeysExact } from '../parse_keys';
import { enterInsertMode, enterVisualMode, enterVisualLineMode, setModeCursorStyle } from '../modes';
import * as positionUtils from '../position_utils';
import { removeTypeSubscription } from '../type_subscription';
import { VimState } from '../vim_state_types';
import { setVisualLineSelections } from '../visual_line_utils';
import { flashYankHighlight } from '../yank_highlight';
import { putAfter } from '../put_utils/put_after';
import { putBefore } from '../put_utils/put_before';

export const actions: Action[] = [
    parseKeysExact(['i'], [Mode.Normal, Mode.Visual, Mode.VisualLine], (vimState, editor) => {
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['I'], [Mode.Normal], (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            const character = editor.document.lineAt(selection.active.line).firstNonWhitespaceCharacterIndex;
            const newPosition = selection.active.with({ character: character });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['a'], [Mode.Normal], (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            const newPosition = positionUtils.right(editor.document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['A'], [Mode.Normal], (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            const newPosition = selection.active.with({ character: lineLength });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['v'], [Mode.Normal, Mode.VisualLine], (vimState, editor) => {
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

    parseKeysExact(['V'], [Mode.Normal, Mode.Visual], (vimState, editor) => {
        enterVisualLineMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        setVisualLineSelections(editor);
    }),

    parseKeysExact(['o'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('editor.action.insertLineAfter');
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['O'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('editor.action.insertLineBefore');
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['p'], [Mode.Normal, Mode.Visual, Mode.VisualLine], putAfter),
    parseKeysExact(['P'], [Mode.Normal], putBefore),

    parseKeysExact(['g', 'p'], [Mode.Normal], (vimState, editor) => {
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

    parseKeysExact(['u'], [Mode.Normal, Mode.Visual, Mode.VisualLine], (vimState, editor) => {
        vscode.commands.executeCommand('undo');
    }),

    parseKeysExact(['d', 'd'], [Mode.Normal], (vimState, editor) => {
        deleteLine(vimState, editor);
    }),

    parseKeysExact(['D'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('deleteAllRight');
    }),

    parseKeysExact(['c', 'c'], [Mode.Normal], (vimState, editor) => {
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

    parseKeysExact(['C'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('deleteAllRight');
        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
    }),

    parseKeysExact(['y', 'y'], [Mode.Normal], (vimState, editor) => {
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

    parseKeysExact(['Y'], [Mode.Normal], (vimState, editor) => {
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

    parseKeysExact(['r', 'r'], [Mode.Normal], (vimState, editor) => {
        yankLine(vimState, editor);
        deleteLine(vimState, editor);
    }),

    parseKeysExact(['R'], [Mode.Normal], (vimState, editor) => {
        yankToEndOfLine(vimState, editor);
        vscode.commands.executeCommand('deleteAllRight');
    }),

    parseKeysExact(['s', 's'], [Mode.Normal], (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            return new vscode.Selection(
                selection.active.with({ character: 0 }),
                positionUtils.lineEnd(editor.document, selection.active),
            );
        });

        enterVisualLineMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
    }),

    parseKeysExact(['S'], [Mode.Normal], (vimState, editor) => {
        editor.selections = editor.selections.map(selection => {
            return new vscode.Selection(
                selection.active,
                positionUtils.lineEnd(editor.document, selection.active),
            );
        });

        enterVisualMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
    }),

    parseKeysExact(['x'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('deleteRight');
    }),

    parseKeysExact(['z', 't'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'top',
        });
    }),

    parseKeysExact(['z', 'z'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'center',
        });
    }),

    parseKeysExact(['z', 'b'], [Mode.Normal], (vimState, editor) => {
        vscode.commands.executeCommand('revealLine', {
            lineNumber: editor.selection.active.line,
            at: 'bottom',
        });
    }),

    parseKeysExact([';'], [Mode.Normal], (vimState, editor) => {
        vimState.semicolonAction(vimState, editor);
    }),

    parseKeysExact([','], [Mode.Normal], (vimState, editor) => {
        vimState.commaAction(vimState, editor);
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
