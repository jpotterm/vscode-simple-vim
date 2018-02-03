'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';
import { VimRange } from './vimRangeTypes';

export function delete_(vimState: VimState, editor: vscode.TextEditor, register: string, count: number, range: VimRange) {
    editor.edit(function(editBuilder) {
        let vscodeRange = range.range;

        if (range.linewise) {
            const end = range.range.end;
            vscodeRange = new vscode.Range(
                range.range.start,
                new vscode.Position(end.line + 1, 0)
            );
        }

        editBuilder.delete(vscodeRange);
    });
}

export function change(vimState: VimState, editor: vscode.TextEditor, register: string, count: number, range: VimRange) {
    editor.edit(function(editBuilder) {
        editBuilder.delete(range.range);
    });
}
