'use strict';
import * as vscode from 'vscode';

import { Mode } from './modesTypes';
import * as positionUtils from './positionUtils';
import * as scrollCommands from './scrollCommands';
import { enterNormalMode, enterVisualMode } from './modes';
import { typeHandler } from './typeHandler';
import { addTypeSubscription, removeTypeSubscription } from './typeSubscription';
import { VimState } from './vimStateTypes';

const globalVimState: VimState = {
    typeSubscription: undefined,
    mode: Mode.Insert,
    desiredColumns: [],
    keysPressed: [],
    registers: {},
    semicolonAction: () => undefined,
    commaAction: () => undefined,
};

function escapeHandler(vimState: VimState): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    const document = editor.document;

    if (vimState.mode === Mode.Insert) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = positionUtils.left(document, selection.active);
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode(vimState);
        addTypeSubscription(vimState, typeHandler);
    } else if (vimState.mode === Mode.Normal) {
        // Clear multiple cursors
        if (editor.selections.length > 1) {
            editor.selections = [editor.selections[0]];
        }
    } else if (vimState.mode === Mode.Visual) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = new vscode.Position(selection.active.line, Math.max(selection.active.character - 1, 0));
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode(vimState);
    }  else if (vimState.mode === Mode.VisualLine) {
        editor.selections = editor.selections.map(function(selection) {
            const newPosition = selection.active.with({
                character: Math.max(selection.active.character - 1, 0),
            });
            return new vscode.Selection(newPosition, newPosition);
        });

        enterNormalMode(vimState);
    }
}

function onSelectionChange(vimState: VimState, e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.kind === vscode.TextEditorSelectionChangeKind.Command || vimState.mode === Mode.Insert) {
        return;
    }

    console.log('Selection changed:', e.kind);

    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.desiredColumns = [];

    if (editor.selections.some(selection => !selection.isEmpty)) {
        enterVisualMode(vimState);
    } else {
        // Prevent cursor from landing on the last character of the line
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
}

function onDidChangeActiveTextEditor(vimState: VimState, editor: vscode.TextEditor | undefined) {
    if (!editor) return;

    if (vimState.mode === Mode.Insert) {
        enterNormalMode(vimState);
        addTypeSubscription(vimState, typeHandler);
    } else if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
        // If there's a non-empty selection we'll go back to visual mode in onSelectionChange
        enterNormalMode(vimState);
    }

    vimState.desiredColumns = [];
    vimState.keysPressed = [];
}

export function activate(context: vscode.ExtensionContext): void {
    console.log('Simple Vim is active!');

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => onDidChangeActiveTextEditor(globalVimState, editor)),
        vscode.window.onDidChangeTextEditorSelection((e) => onSelectionChange(globalVimState, e)),
        vscode.commands.registerCommand(
            'extension.simpleVim.escapeKey',
            () => escapeHandler(globalVimState),
        ),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollDownHalfPage',
            scrollCommands.scrollDownHalfPage,
        ),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollUpHalfPage',
            scrollCommands.scrollUpHalfPage,
        ),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollDownPage',
            scrollCommands.scrollDownPage,
        ),
        vscode.commands.registerCommand(
            'extension.simpleVim.scrollUpPage',
            scrollCommands.scrollUpPage,
        ),
    );

    if (vscode.window.activeTextEditor) {
        onDidChangeActiveTextEditor(globalVimState, vscode.window.activeTextEditor);
    }
}

export function deactivate(): void {
    removeTypeSubscription(globalVimState);
}
