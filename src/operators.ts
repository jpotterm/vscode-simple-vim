'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';
import { ParseKeysStatus, ParseKeys, parseKeysExact, ParseOperatorAllSuccess } from './parseKeys';
import * as positionUtils from './positionUtils';
import { Mode } from './modes';

export interface OperatorMotion {
    exec: (vimState: VimState, keys: string[], document: vscode.TextDocument, position: vscode.Position) => vscode.Range;
}

export async function delete_(vimState: VimState, editor: vscode.TextEditor, range: vscode.Range) {
    await editor.edit(function(editBuilder) {
        editBuilder.delete(range);
    });
}

export async function change(vimState: VimState, editor: vscode.TextEditor, range: vscode.Range) {
    await editor.edit(function(editBuilder) {
        editBuilder.delete(range);
    });
}
