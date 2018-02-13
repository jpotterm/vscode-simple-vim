'use strict';
import * as vscode from 'vscode';

import { Action } from '../action_types';
import { operatorMotions } from './operator_motions';
import { parseKeysOperator } from '../parse_keys';
import { enterInsertMode, enterNormalMode, setModeCursorStyle, enterVisualLineMode, enterVisualMode } from '../modes';
import { removeTypeSubscription } from '../type_subscription';
import { VimState } from '../vim_state_types';
import { Mode } from '../modes_types';
import { VimRange } from '../vim_range_types';

export const operators: Action[] = [
    parseKeysOperator(['d'], operatorMotions, function(vimState, editor, register, count, ranges) {
        cursorsToRangesStart(editor, ranges);

        delete_(editor, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            enterNormalMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        }

        vimState.desiredColumns = [];
    }),
    parseKeysOperator(['c'], operatorMotions, function(vimState, editor, register, count, ranges) {
        cursorsToRangesStart(editor, ranges);

        editor.edit(function(editBuilder) {
            ranges.forEach(function(range) {
                editBuilder.delete(range.range);
            });

        });

        enterInsertMode(vimState);
        setModeCursorStyle(vimState.mode, editor);
        removeTypeSubscription(vimState);
        vimState.desiredColumns = [];
    }),
    parseKeysOperator(['y'], operatorMotions, function(vimState, editor, register, count, ranges) {
        yank(vimState, editor, register, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            // Move cursor to start of yanked text
            editor.selections = editor.selections.map(function(selection) {
                return new vscode.Selection(selection.start, selection.start);
            });

            enterNormalMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        }
    }),
    parseKeysOperator(['r'], operatorMotions, function(vimState, editor, register, count, ranges) {
        cursorsToRangesStart(editor, ranges);

        yank(vimState, editor, register, ranges);
        delete_(editor, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            enterNormalMode(vimState);
            setModeCursorStyle(vimState.mode, editor);
        }

        vimState.desiredColumns = [];
    }),
    parseKeysOperator(['s'], operatorMotions, function(vimState, editor, register, count, ranges) {
        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) return;

        editor.selections = ranges.map(function(range) {
            const start = range.range.start;
            const end = range.range.end;
            return new vscode.Selection(start, end);
        });

        if (ranges[0].linewise) {
            enterVisualLineMode(vimState);
        } else {
            enterVisualMode(vimState);
        }

        setModeCursorStyle(vimState.mode, editor);
    }),
];

function cursorsToRangesStart(editor: vscode.TextEditor, ranges: VimRange[]) {
    editor.selections = editor.selections.map(function(selection, i) {
        const newPosition = ranges[i].range.start;
        return new vscode.Selection(newPosition, newPosition);
    });
}

function delete_(editor: vscode.TextEditor, ranges: VimRange[]) {
    editor.edit(function(editBuilder) {
        ranges.forEach(function(range) {
            let vscodeRange = range.range;

            if (range.linewise) {
                const end = range.range.end;
                vscodeRange = new vscode.Range(
                    range.range.start,
                    new vscode.Position(end.line + 1, 0),
                );
            }

            editBuilder.delete(vscodeRange);
        });
    });
}

function yank(vimState: VimState, editor: vscode.TextEditor, register: string, ranges: VimRange[]) {
    vimState.registers[register] = ranges.map(function(range) {
        return {
            contents: editor.document.getText(range.range),
            linewise: range.linewise,
        };
    });
}
