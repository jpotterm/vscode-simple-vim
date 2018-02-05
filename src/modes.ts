'use strict';
import * as vscode from 'vscode';

import { Mode } from './modesTypes';
import { vimState } from './vimState';

export function enterInsertMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Insert;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;

    setModeContext('extension.simpleVim.insertMode');
}

export function enterNormalMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Normal;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.Underline;

    setModeContext('extension.simpleVim.normalMode');
}

export function enterVisualMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.Visual;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;

    setModeContext('extension.simpleVim.visualMode');
}

export function enterVisualLineMode(): void {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    vimState.mode = Mode.VisualLine;
    editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;

    setModeContext('extension.simpleVim.visualLineMode');
}

function setModeContext(key: string) {
    const modeKeys = [
        'extension.simpleVim.insertMode',
        'extension.simpleVim.normalMode',
        'extension.simpleVim.visualMode',
        'extension.simpleVim.visualLineMode',
    ];

    modeKeys.forEach(function(modeKey) {
        vscode.commands.executeCommand('setContext', modeKey, key === modeKey);
    });
}
