'use strict';
import * as vscode from 'vscode';

export function searchForward(
    document: vscode.TextDocument,
    needle: string,
    fromPosition: vscode.Position
): vscode.Position | undefined {
    for (let i = fromPosition.line; i < document.lineCount; ++i) {
        const lineText = document.lineAt(i).text;
        const fromIndex = i === fromPosition.line ? fromPosition.character : 0;
        const matchIndex = lineText.indexOf(needle, fromIndex);

        if (matchIndex >= 0) {
            return new vscode.Position(i, matchIndex);
        }
    }

    return undefined;
}

export function searchBackward(
    document: vscode.TextDocument,
    needle: string,
    fromPosition: vscode.Position
): vscode.Position | undefined {
    for (let i = fromPosition.line; i >= 0; --i) {
        const lineText = document.lineAt(i).text;
        const fromIndex = i === fromPosition.line ? fromPosition.character : +Infinity;
        const matchIndex = lineText.lastIndexOf(needle, fromIndex);

        if (matchIndex >= 0) {
            return new vscode.Position(i, matchIndex);
        }
    }

    return undefined;
}
