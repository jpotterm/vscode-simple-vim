'use strict';
import * as vscode from 'vscode';

enum Mode {
    Insert,
    Normal,
    Visual,
}

class VimState {
    typeSubscription: vscode.Disposable;
    selectionSubscription: vscode.Disposable;
    mode: Mode;
    desiredColumns: number[] = [];
}

const vimState = new VimState();

async function typeHandler(x) {
    const char = x.text;
    const editor = vscode.window.activeTextEditor;

    if (char === 'i') {
        enterInsertMode();
        removeSubscriptions();
    } else if (char === 'l') {
        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            const newPosition = new vscode.Position(
                selection.active.line,
                Math.min(selection.active.character + 1, lineLength - 1)
            );
            return new vscode.Selection(newPosition, newPosition);
        });

        vimState.desiredColumns = [];
    } else if (char === 'h') {
        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;
            const newPosition = new vscode.Position(
                selection.active.line,
                Math.max(selection.active.character - 1, 0)
            );
            return new vscode.Selection(newPosition, newPosition);
        });

        vimState.desiredColumns = [];
    } else if (char === 'k') {
        if (vimState.desiredColumns.length === 0) {
            vimState.desiredColumns = editor.selections.map(x => x.active.character);
        }

        editor.selections = editor.selections.map(function(selection, i) {
            if (selection.active.line === 0) {
                return selection;
            }

            const newLineNumber = selection.active.line - 1;
            const newLineLength = editor.document.lineAt(newLineNumber).text.length;
            const newPosition = new vscode.Position(
                newLineNumber,
                Math.min(vimState.desiredColumns[i], Math.max(newLineLength - 1, 0)),
            );
            return new vscode.Selection(newPosition, newPosition);
        });
    } else if (char === 'j') {
        if (vimState.desiredColumns.length === 0) {
            vimState.desiredColumns = editor.selections.map(x => x.active.character);
        }

        editor.selections = editor.selections.map(function(selection, i) {
            if (selection.active.line === editor.document.lineCount - 1) {
                return selection;
            }

            const newLineNumber = selection.active.line + 1;
            const newLineLength = editor.document.lineAt(newLineNumber).text.length;
            const newPosition = new vscode.Position(
                newLineNumber,
                Math.min(vimState.desiredColumns[i], Math.max(newLineLength - 1, 0)),
            );
            return new vscode.Selection(newPosition, newPosition);
        });
    } else if (char === 'v') {
        if (vimState.mode === Mode.Visual) return;

        enterVisualMode();

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            const anchorPosition = new vscode.Position(selection.active.line, selection.active.character);
            const activePosition = new vscode.Position(selection.active.line, selection.active.character + 1);
            return new vscode.Selection(anchorPosition, activePosition);
        });
    }
}

function escapeHandler() {
    const editor = vscode.window.activeTextEditor;

    if (vimState.mode === Mode.Insert) {
        enterNormalMode();
        addSubscriptions();
    } else if (vimState.mode === Mode.Visual) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = new vscode.Position(selection.active.line, Math.max(selection.active.character - 1, 0));
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode();
    }
}

function enterInsertMode() {
    vimState.mode = Mode.Insert;
    vscode.window.activeTextEditor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
    vimState.typeSubscription.dispose();
    vimState.selectionSubscription.dispose();
}

function enterNormalMode() {
    vimState.mode = Mode.Normal;
    vscode.window.activeTextEditor.options.cursorStyle = vscode.TextEditorCursorStyle.Underline;
}

function enterVisualMode() {
    vimState.mode = Mode.Visual;
    vscode.window.activeTextEditor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
}

function addSubscriptions() {
    vimState.typeSubscription = vscode.commands.registerCommand('type', typeHandler);
    vimState.selectionSubscription = vscode.window.onDidChangeTextEditorSelection(onSelectionChange);
}

function removeSubscriptions() {
    vimState.typeSubscription.dispose();
    vimState.selectionSubscription.dispose();
}

function onSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
    if (e.kind === undefined || e.kind === vscode.TextEditorSelectionChangeKind.Command) return;

    console.log('Selection changed');

    const editor = vscode.window.activeTextEditor;

    vimState.desiredColumns = [];

    editor.selections = editor.selections.map(function(selection, i) {
        const lineLength = editor.document.lineAt(selection.active.line).text.length;

        if (lineLength > 0 && selection.active.character === lineLength) {
            const newPosition = new vscode.Position(
                selection.active.line,
                lineLength - 1,
            );
            return new vscode.Selection(newPosition, newPosition);
        } else {
            return selection;
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Simple Vim is active!');

    enterNormalMode();
    addSubscriptions();
    context.subscriptions.push(vscode.commands.registerCommand('extension.simpleVim.escapeKey', escapeHandler));
}

export function deactivate() {
    removeSubscriptions();
}

// await vscode.commands.executeCommand('cursorMove', {
//     to: 'right',
//     by: 'character',
// });
