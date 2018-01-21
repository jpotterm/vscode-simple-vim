'use strict';
import * as vscode from 'vscode';

import { Mode } from './modes';
import { VimState } from './vimState';
import * as motions from './motions';
import * as positionUtils from './positionUtils';

const vimState = new VimState();

async function typeHandler(e: {text: string}): Promise<void> {
    const char = e.text;
    const editor = vscode.window.activeTextEditor;
    const document = editor.document;

    if (char === 'i') {
        enterInsertMode();
        removeSubscriptions();
    } else if (char === 'l') {
        execMotion(motions.right);
        vimState.desiredColumns = [];
    } else if (char === 'h') {
        execMotion(motions.left);
        vimState.desiredColumns = [];
    } else if (char === 'k') {
        if (vimState.desiredColumns.length === 0) {
            vimState.desiredColumns = editor.selections.map(x => x.active.character);
        }

        execMotion(motions.up);
    } else if (char === 'j') {
        if (vimState.desiredColumns.length === 0) {
            vimState.desiredColumns = editor.selections.map(x => x.active.character);
        }

        execMotion(motions.down);
    } else if (char === 'v') {
        if (vimState.mode === Mode.Visual) return;

        enterVisualMode();

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            return new vscode.Selection(selection.active, positionUtils.right(document, selection.active));
        });
    }
}

function execMotion(motion: (args: motions.MotionArgs) => vscode.Position) {
    const editor = vscode.window.activeTextEditor;
    const document = editor.document;

    editor.selections = editor.selections.map(function(selection, i) {
        if (vimState.mode === Mode.Normal) {
            const newPosition = motion({
                document: document,
                position: selection.active,
                selectionIndex: i,
                vimState: vimState,
            });
            return new vscode.Selection(newPosition, newPosition);
        } else if (vimState.mode === Mode.Visual) {
            let newPosition;
            if (selection.active.isBefore(selection.anchor)) {
                const currentPosition = positionUtils.rightNormal(document, selection.active);
                const motionPosition = motion({
                    document: document,
                    position: currentPosition,
                    selectionIndex: i,
                    vimState: vimState,
                });
                newPosition = positionUtils.left(document, motionPosition);
            } else {
                const currentPosition = positionUtils.left(document, selection.active);
                const motionPosition = motion({
                    document: document,
                    position: currentPosition,
                    selectionIndex: i,
                    vimState: vimState,
                });
                newPosition = positionUtils.right(document, motionPosition);
            }

            if (selection.active.isAfter(selection.anchor) && newPosition.isBeforeOrEqual(selection.anchor)) {
                return new vscode.Selection(
                    positionUtils.right(document, selection.anchor),
                    newPosition
                );
            } else if (selection.active.isBefore(selection.anchor) && newPosition.isAfterOrEqual(selection.anchor)) {
                return new vscode.Selection(
                    positionUtils.left(document, selection.anchor),
                    newPosition
                );
            } else {
                return new vscode.Selection(selection.anchor, newPosition);
            }
        }
    });
}

function escapeHandler(): void {
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

function enterInsertMode(): void {
    vimState.mode = Mode.Insert;
    vscode.window.activeTextEditor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
    vimState.typeSubscription.dispose();
    vimState.selectionSubscription.dispose();
}

function enterNormalMode(): void {
    vimState.mode = Mode.Normal;
    vscode.window.activeTextEditor.options.cursorStyle = vscode.TextEditorCursorStyle.Underline;
}

function enterVisualMode(): void {
    vimState.mode = Mode.Visual;
    vscode.window.activeTextEditor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
}

function addSubscriptions(): void {
    vimState.typeSubscription = vscode.commands.registerCommand('type', typeHandler);
    vimState.selectionSubscription = vscode.window.onDidChangeTextEditorSelection(onSelectionChange);
}

function removeSubscriptions(): void {
    vimState.typeSubscription.dispose();
    vimState.selectionSubscription.dispose();
}

function onSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
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

export function activate(context: vscode.ExtensionContext): void {
    console.log('Simple Vim is active!');

    enterNormalMode();
    addSubscriptions();
    context.subscriptions.push(vscode.commands.registerCommand('extension.simpleVim.escapeKey', escapeHandler));
}

export function deactivate(): void {
    removeSubscriptions();
}

// await vscode.commands.executeCommand('cursorMove', {
//     to: 'right',
//     by: 'character',
// });
