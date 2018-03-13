import * as vscode from 'vscode';

import { Mode } from './modes_types';
import * as scrollCommands from './scroll_commands';
import { enterNormalMode, enterVisualMode, setModeCursorStyle } from './modes';
import { typeHandler } from './type_handler';
import { addTypeSubscription, removeTypeSubscription } from './type_subscription';
import { VimState } from './vim_state_types';
import { escapeHandler } from './escape_handler';

const globalVimState: VimState = {
    typeSubscription: undefined,
    mode: Mode.Insert,
    keysPressed: [],
    registers: {
        contentsList: [],
        linewise: true,
    },
    semicolonAction: () => undefined,
    commaAction: () => undefined,
    lastPutRanges: {
        ranges: [],
        linewise: true,
    },
};

function onSelectionChange(vimState: VimState, e: vscode.TextEditorSelectionChangeEvent): void {
    if (vimState.mode === Mode.Insert) return;

    if (e.selections.every(selection => selection.isEmpty)) {
        // It would be nice if we could always go from visual to normal mode when all selections are empty
        // but visual mode on an empty line will yield an empty selection and there's no good way of
        // distinguishing that case from the rest. So we only do it for mouse events.
        if (
            (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) &&
            e.kind === vscode.TextEditorSelectionChangeKind.Mouse
        ) {
            enterNormalMode(vimState);
            setModeCursorStyle(vimState.mode, e.textEditor);
        }
    } else {
        if (vimState.mode === Mode.Normal) {
            enterVisualMode(vimState);
            setModeCursorStyle(vimState.mode, e.textEditor);
        }
    }

    // The following code makes find/replace take extra clicks because after replacing it moves
    // the cursor to the next result with an empty selection which causes us to set editor.selections.
    // So for now we don't need this.

    // if (vimState.mode === Mode.Normal) {
    //     // Prevent cursor from landing on the last character of the line
    //     editor.selections = editor.selections.map((selection, i) => {
    //         const lineLength = editor.document.lineAt(selection.active.line).text.length;

    //         if (lineLength > 0 && selection.active.character === lineLength) {
    //             const newPosition = new vscode.Position(
    //                 selection.active.line,
    //                 lineLength - 1,
    //             );
    //             return new vscode.Selection(newPosition, newPosition);
    //         } else {
    //             return selection;
    //         }
    //     });
    // }
}

function onDidChangeActiveTextEditor(vimState: VimState, editor: vscode.TextEditor | undefined) {
    if (!editor) return;

    if (editor.selections.every(selection => selection.isEmpty)) {
        if (vimState.mode === Mode.Visual || vimState.mode === Mode.VisualLine) {
            enterNormalMode(vimState);
        }
    } else {
        if (vimState.mode === Mode.Normal) {
            enterVisualMode(vimState);
        }
    }

    setModeCursorStyle(vimState.mode, editor);

    vimState.keysPressed = [];
}

export function activate(context: vscode.ExtensionContext): void {
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

    enterNormalMode(globalVimState);
    addTypeSubscription(globalVimState, typeHandler);

    if (vscode.window.activeTextEditor) {
        onDidChangeActiveTextEditor(globalVimState, vscode.window.activeTextEditor);
    }
}

export function deactivate(): void {
    removeTypeSubscription(globalVimState);
}
