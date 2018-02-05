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
        ranges.forEach(function(range, i) {
            delete_(vimState, editor, i + register, count, range);
        });
    }),
    parseKeysOperator(['c'], operatorMotions, function(vimState, editor, register, count, ranges) {
        ranges.forEach(function(range, i) {
            change(vimState, editor, i + register, count, range);
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

function delete_(vimState: VimState, editor: vscode.TextEditor, register: string, count: number, range: VimRange) {
    editor.edit(function(editBuilder) {
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
}

function change(vimState: VimState, editor: vscode.TextEditor, register: string, count: number, range: VimRange) {
    editor.edit(function(editBuilder) {
        editBuilder.delete(range.range);
    });
}
