'use strict';
import * as vscode from 'vscode';

function right(editor, position) {
    const lineLength = editor.document.lineAt(position.line).text.length;
    return new vscode.Position(
        position.line,
        Math.min(position.character + 1, lineLength - 1)
    );
}
