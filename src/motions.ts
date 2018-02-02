'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';
import * as positionUtils from './positionUtils';
import { searchForward, searchBackward } from './searchUtils';

export type MotionArgs = {
    document: vscode.TextDocument,
    position: vscode.Position,
    selectionIndex: number,
    vimState: VimState,
};

export type RegexMotionArgs = {
    document: vscode.TextDocument,
    position: vscode.Position,
    selectionIndex: number,
    vimState: VimState,
    match: RegExpMatchArray,
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

const NON_WORD_CHARACTERS = '/\\()"\':,.;<>~!@#$%^&*|+=[]{}`?-';

function wordRanges(text: string): { start: number, end: number }[] {
    enum State {
        Whitespace,
        Word,
        NonWord,
    }

    let state = State.Whitespace;
    let startIndex = 0;
    const ranges = [];

    for (let i = 0; i < text.length; ++i) {
        const char = text[i];

        if (state === State.Whitespace) {
            if (!isWhitespaceCharacter(char)) {
                startIndex = i;
                state = isWordCharacter(char) ? State.Word : State.NonWord;
            }
        } else if (state === State.Word) {
            if (!isWordCharacter(char)) {
                ranges.push({
                    start: startIndex,
                    end: i - 1,
                });

                if (isWhitespaceCharacter(char)) {
                    state = State.Whitespace;
                } else {
                    state = State.NonWord;
                    startIndex = i;
                }
            }
        } else {
            if (!isNonWordCharacter(char)) {
                ranges.push({
                    start: startIndex,
                    end: i - 1,
                });

                if (isWhitespaceCharacter(char)) {
                    state = State.Whitespace;
                } else {
                    state = State.Word;
                    startIndex = i;
                }
            }
        }
    }

    if (state !== State.Whitespace) {
        ranges.push({
            start: startIndex,
            end: text.length - 1,
        });
    }

    return ranges;
}

function isNonWordCharacter(char: string): boolean {
    return NON_WORD_CHARACTERS.indexOf(char) >= 0;
}

function isWhitespaceCharacter(char: string): boolean {
    return char === ' ' || char === '\t';
}

function isWordCharacter(char: string): boolean {
    return !isWhitespaceCharacter(char) && !isNonWordCharacter(char);
}

export function wordForward({ document, position }: MotionArgs): vscode.Position {
    const lineText = document.lineAt(position.line).text;
    const ranges = wordRanges(lineText);

    const result = ranges.find(x => x.start > position.character);

    if (result) {
        return position.with({ character: result.start })
    } else {
        return position;
    }
}

export function wordBackward({ document, position }: MotionArgs): vscode.Position {
    const lineText = document.lineAt(position.line).text;
    const ranges = wordRanges(lineText);

    const result = ranges.reverse().find(x => x.start < position.character);

    if (result) {
        return position.with({ character: result.start })
    } else {
        return position;
    }
}

export function wordEnd({ document, position }: MotionArgs): vscode.Position {
    const lineText = document.lineAt(position.line).text;
    const ranges = wordRanges(lineText);

    const result = ranges.find(x => x.end > position.character);

    if (result) {
        return position.with({ character: result.end });
    } else {
        return position;
    }
}

export function findForward({ document, position, match }: RegexMotionArgs): vscode.Position {
    const fromPosition = position.with({ character: position.character + 1 });
    const result = searchForward(document, match[1], fromPosition);

    if (result) {
        return result;
    } else {
        return position;
    }
}

export function findBackward({ document, position, match }: RegexMotionArgs): vscode.Position {
    const fromPosition = position.with({ character: position.character - 1 });
    const result = searchBackward(document, match[1], fromPosition);

    if (result) {
        return result;
    } else {
        return position;
    }
}

export function tillForward({ document, position, match }: RegexMotionArgs): vscode.Position {
    const lineText = document.lineAt(position.line).text;
    const result = lineText.indexOf(match[1], position.character + 1);

    if (result >= 0) {
        return position.with({ character: result });
    } else {
        return position;
    }
}

export function tillBackward({ document, position, match }: RegexMotionArgs): vscode.Position {
    const lineText = document.lineAt(position.line).text;
    const result = lineText.lastIndexOf(match[1], position.character - 1);

    if (result >= 0) {
        return position.with({ character: result });
    } else {
        return position;
    }
}
