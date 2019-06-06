import * as vscode from 'vscode';

import { Mode, CursorConfigurationStyle } from './modes_types';
import { VimState } from './vim_state_types';

export function enterInsertMode(vimState: VimState): void {
    vimState.mode = Mode.Insert;
    setModeContext('extension.simpleVim.insertMode');
}

export function enterNormalMode(vimState: VimState): void {
    vimState.mode = Mode.Normal;
    setModeContext('extension.simpleVim.normalMode');
}

export function enterVisualMode(vimState: VimState): void {
    vimState.mode = Mode.Visual;
    setModeContext('extension.simpleVim.visualMode');
}

export function enterVisualLineMode(vimState: VimState): void {
    vimState.mode = Mode.VisualLine;
    setModeContext('extension.simpleVim.visualLineMode');
}

function setModeContext(key: string) {
    const modeKeys = [
        'extension.simpleVim.insertMode',
        'extension.simpleVim.normalMode',
        'extension.simpleVim.visualMode',
        'extension.simpleVim.visualLineMode',
    ];

    modeKeys.forEach(modeKey => {
        vscode.commands.executeCommand('setContext', modeKey, key === modeKey);
    });
}

const configToStyleMapping: { [key in CursorConfigurationStyle]: vscode.TextEditorCursorStyle } = {
    line: vscode.TextEditorCursorStyle.Line,
    block: vscode.TextEditorCursorStyle.Block,
    underline: vscode.TextEditorCursorStyle.Underline,
    lineThin: vscode.TextEditorCursorStyle.LineThin,
    blockOutline: vscode.TextEditorCursorStyle.BlockOutline,
    underlineThin: vscode.TextEditorCursorStyle.UnderlineThin,
};

function isValidCursorConfigStyle(input: any): input is CursorConfigurationStyle {
    return typeof input === 'string' && Object.keys(configToStyleMapping).indexOf(input) !== -1;
}

function getCursorConfigStyle(mode: Mode) {
    const simpleVimConfig = vscode.workspace.getConfiguration('simpleVim');

    switch (mode) {
        case Mode.Insert:
            return simpleVimConfig.get('insertModeCursorStyle');
        case Mode.Normal:
            return simpleVimConfig.get('normalModeCursorStyle');
        case Mode.Visual:
            return simpleVimConfig.get('visualModeCursorStyle');
        case Mode.VisualLine:
            return simpleVimConfig.get('visualLineModeCursorStyle');
    }
}

export function setModeCursorStyle(mode: Mode, editor: vscode.TextEditor): void {
    const cursorConfigStyle = getCursorConfigStyle(mode);
    if (isValidCursorConfigStyle(cursorConfigStyle)) {
        editor.options.cursorStyle = configToStyleMapping[cursorConfigStyle];
        return;
    }

    if (mode === Mode.Insert) {
        editor.options.cursorStyle = vscode.TextEditorCursorStyle.Line;
    } else if (mode === Mode.Normal) {
        editor.options.cursorStyle = vscode.TextEditorCursorStyle.Underline;
    } else if (mode === Mode.Visual || mode === Mode.VisualLine) {
        editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
    }
}
