'use strict';
import * as vscode from 'vscode';
import { VimState } from './vimState';

export type MotionArgs = {
    document: vscode.TextDocument,
    position: vscode.Position,
    selectionIndex: number,
    vimState: VimState,
};

export function left({ document, position }: MotionArgs): vscode.Position {
    const lineLength = document.lineAt(position.line).text.length;
    return position.with({
        character: Math.max(position.character - 1, 0),
    });
}

export function right({ document, position }: MotionArgs): vscode.Position {
    const lineLength = document.lineAt(position.line).text.length;
    return position.with({
        character: Math.min(position.character + 1, lineLength - 1),
    });
}

export function up({ document, position, selectionIndex, vimState }: MotionArgs): vscode.Position {
    if (position.line === 0) {
        return position;
    }

    const newLineNumber = position.line - 1;
    const newLineLength = document.lineAt(newLineNumber).text.length;
    return new vscode.Position(
        newLineNumber,
        Math.min(vimState.desiredColumns[selectionIndex], Math.max(newLineLength - 1, 0)),
    );
}

export function down({ document, position, selectionIndex, vimState }: MotionArgs): vscode.Position {
    if (position.line === document.lineCount - 1) {
        return position;
    }

    const newLineNumber = position.line + 1;
    const newLineLength = document.lineAt(newLineNumber).text.length;
    return new vscode.Position(
        newLineNumber,
        Math.min(vimState.desiredColumns[selectionIndex], Math.max(newLineLength - 1, 0)),
    );
}
