import * as vscode from 'vscode';

function executeMoveCommand(
    command: 'editorScroll' | 'cursorMove',
    options: { to: string, by: string },
) {
    vscode.commands.executeCommand(command, options);
}

function editorScroll(to: string, by: string) {
    executeMoveCommand('editorScroll', {
        to,
        by,
    });

    executeMoveCommand('cursorMove', {
        to: 'viewPortCenter',
        by: 'line',
    });
}

export function scrollDownHalfPage(): void {
    editorScroll('down', 'halfPage');
}

export function scrollUpHalfPage(): void {
    editorScroll('up', 'halfPage');
}

export function scrollDownPage(): void {
    editorScroll('down', 'page');
}

export function scrollUpPage(): void {
    editorScroll('up', 'page');
}
