'use strict';
import * as vscode from 'vscode';

export function left(position: vscode.Position, count: number = 1): vscode.Position {
    return position.with({
        character: Math.max(position.character - count, 0),
    });
}

export function right(document: vscode.TextDocument, position: vscode.Position, count: number = 1): vscode.Position {
    const lineLength = document.lineAt(position.line).text.length;
    return position.with({
        character: Math.min(position.character + count, lineLength),
    });
}

export function rightNormal(
    document: vscode.TextDocument,
    position: vscode.Position,
    count: number = 1,
): vscode.Position {
    const lineLength = document.lineAt(position.line).text.length;
    return position.with({
        character: Math.min(position.character + count, lineLength - 1),
    });
}

export function lineEnd(document: vscode.TextDocument, position: vscode.Position): vscode.Position {
    const lineLength = document.lineAt(position.line).text.length;
    return position.with({
        character: lineLength,
    });
}
