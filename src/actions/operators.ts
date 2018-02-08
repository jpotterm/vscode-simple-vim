'use strict';
import * as vscode from 'vscode';

import { Action } from '../actionTypes';
import { operatorMotions } from './operatorMotions';
import { parseKeysOperator } from '../parseKeys';
import { enterInsertMode, enterNormalMode } from '../modes';
import { removeTypeSubscription } from '../typeSubscription';
import { VimState } from '../vimStateTypes';
import { Mode } from '../modesTypes';
import { VimRange } from '../vimRangeTypes';

export const operators: Action[] = [
    parseKeysOperator(['d'], operatorMotions, function(vimState, editor, register, count, ranges) {
        cursorsToRangesStart(editor, ranges);

        delete_(editor, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            enterNormalMode(vimState);
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
        }
    }),
    parseKeysOperator(['y', 'd'], operatorMotions, function(vimState, editor, register, count, ranges) {
        cursorsToRangesStart(editor, ranges);

        yank(vimState, editor, register, ranges);
        delete_(editor, ranges);

        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            enterNormalMode(vimState);
        }

        vimState.desiredColumns = [];
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
