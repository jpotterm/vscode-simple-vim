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
    } else if (char === 'I') {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({ character: 0 });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeSubscriptions();
    } else if (char === 'a') {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.right(document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeSubscriptions();
    } else if (char === 'A') {
        editor.selections = editor.selections.map(function(selection) {
            const lineLength = document.lineAt(selection.active.line).text.length;
            const newPosition = selection.active.with({ character: lineLength });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterInsertMode();
        removeSubscriptions();
    } else if (char === 'l') {
        execMotion(motions.right);
        vimState.desiredColumns = [];
    } else if (char === 'h') {
        execMotion(motions.left);
        vimState.desiredColumns = [];
    } else if (char === 'k') {
        setDesiredColumns(editor, vimState);
        execMotion(motions.up);
    } else if (char === 'j') {
        setDesiredColumns(editor, vimState);
        execMotion(motions.down);
    } else if (char === 'w') {
        execMotion(motions.wordForward);
    } else if (char === 'b') {
        execMotion(motions.wordBackward);
    } else if (char === 'e') {
        execMotion(motions.wordEnd);
    } else if (char === 'v') {
        if (vimState.mode === Mode.Visual) return;

        enterVisualMode();

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            return new vscode.Selection(selection.active, positionUtils.right(document, selection.active));
        });
    } else if (char === 'V') {
        if (vimState.mode === Mode.VisualLine) return;

        enterVisualLineMode();

        editor.selections = editor.selections.map(function(selection) {
            const lineLength = editor.document.lineAt(selection.active.line).text.length;

            if (lineLength === 0) return selection;

            return new vscode.Selection(
                selection.active.with({ character: 0 }),
                selection.active.with({ character: lineLength })
            );
        });
    }
}

function setDesiredColumns(editor: vscode.TextEditor, vimState: VimState): void {
    if (vimState.desiredColumns.length !== 0) return;

    const document = editor.document;

    if (vimState.mode === Mode.Normal) {
        vimState.desiredColumns = editor.selections.map(x => x.active.character);
    } else {
        vimState.desiredColumns = editor.selections.map(function(selection) {
            return vscodeToVimVisualSelection(document, selection).active.character;
        });
    }
}

function vscodeToVimVisualSelection(document: vscode.TextDocument, vscodeSelection: vscode.Selection): vscode.Selection {
    if (vscodeSelection.active.isBefore(vscodeSelection.anchor)) {
        return new vscode.Selection(
            positionUtils.left(document, vscodeSelection.anchor),
            vscodeSelection.active
        );
    } else {
        return new vscode.Selection(
            vscodeSelection.anchor,
            positionUtils.left(document, vscodeSelection.active)
        );
    }
}

function vimToVscodeVisualSelection(document: vscode.TextDocument, vimSelection: vscode.Selection): vscode.Selection {
    if (vimSelection.active.isBefore(vimSelection.anchor)) {
        return new vscode.Selection(
            positionUtils.right(document, vimSelection.anchor),
            vimSelection.active
        );
    } else {
        return new vscode.Selection(
            vimSelection.anchor,
            positionUtils.right(document, vimSelection.active)
        );
    }
}

function vscodeToVimVisualLineSelection(document: vscode.TextDocument, vscodeSelection: vscode.Selection): vscode.Selection {
    return new vscode.Selection(
        vscodeSelection.anchor.with({ character: 0 }),
        vscodeSelection.active.with({ character: 0 }),
    );
}

function vimToVscodeVisualLineSelection(document: vscode.TextDocument, vimSelection: vscode.Selection): vscode.Selection {
    const anchorLineLength = document.lineAt(vimSelection.anchor.line).text.length;
    const activeLineLength = document.lineAt(vimSelection.active.line).text.length;

    if (vimSelection.active.isBefore(vimSelection.anchor)) {
        return new vscode.Selection(
            vimSelection.anchor.with({ character: anchorLineLength }),
            vimSelection.active.with({ character: 0 })
        );
    } else {
        return new vscode.Selection(
            vimSelection.anchor.with({ character: 0 }),
            vimSelection.active.with({ character: activeLineLength })
        );
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
            const vimSelection = vscodeToVimVisualSelection(document, selection);
            const motionPosition = motion({
                document: document,
                position: vimSelection.active,
                selectionIndex: i,
                vimState: vimState,
            });

            return vimToVscodeVisualSelection(document, new vscode.Selection(vimSelection.anchor, motionPosition));
        } else if (vimState.mode === Mode.VisualLine) {
            const vimSelection = vscodeToVimVisualLineSelection(document, selection);
            const motionPosition = motion({
                document: document,
                position: vimSelection.active,
                selectionIndex: i,
                vimState: vimState,
            });

            return vimToVscodeVisualLineSelection(document, new vscode.Selection(vimSelection.anchor, motionPosition));
        }
    });
}

function escapeHandler(): void {
    const editor = vscode.window.activeTextEditor;
    const document = editor.document;

    if (vimState.mode === Mode.Insert) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.left(document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode();
        addSubscriptions();
    } else if (vimState.mode === Mode.Visual) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = new vscode.Position(selection.active.line, Math.max(selection.active.character - 1, 0));
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode();
    }  else if (vimState.mode === Mode.VisualLine) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({
                character: Math.max(selection.active.character - 1, 0)
            });
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

function enterVisualLineMode(): void {
    vimState.mode = Mode.VisualLine;
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
