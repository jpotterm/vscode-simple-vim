'use strict';
import * as vscode from 'vscode';

export function flashYankHighlight(editor: vscode.TextEditor, ranges: vscode.Range[]) {
    const decoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: '#F8F3AB',
    });

    editor.setDecorations(decoration, ranges);
    setTimeout(() => decoration.dispose(), 200);
}
