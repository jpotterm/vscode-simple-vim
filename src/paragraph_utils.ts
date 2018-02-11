'use strict';
import * as vscode from 'vscode';

export function paragraphForward(document: vscode.TextDocument, line: number): number {
    let visitedNonEmptyLine = false;

    for (let i = line; i < document.lineCount; ++i) {
        if (visitedNonEmptyLine) {
            if (document.lineAt(i).isEmptyOrWhitespace) {
                return i;
            }
        } else {
            if (!document.lineAt(i).isEmptyOrWhitespace) {
                visitedNonEmptyLine = true;
            }
        }
    }

    return document.lineCount - 1;
}

export function paragraphBackward(document: vscode.TextDocument, line: number): number {
    let visitedNonEmptyLine = false;

    for (let i = line; i >= 0; --i) {
        if (visitedNonEmptyLine) {
            if (document.lineAt(i).isEmptyOrWhitespace) {
                return i;
            }
        } else {
            if (!document.lineAt(i).isEmptyOrWhitespace) {
                visitedNonEmptyLine = true;
            }
        }
    }

    return 0;
}
