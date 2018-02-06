'use strict';
import * as vscode from 'vscode';

import { Mode } from '../modesTypes';
import { Action } from '../actionTypes';
import {
    parseKeysExact,
    parseKeysOperator,
    createOperatorMotionExactKeys,
    parseKeysRegex,
    createOperatorMotionRegex,
} from '../parseKeys';
import { enterInsertMode, enterVisualMode, enterVisualLineMode, enterNormalMode } from '../modes';
import {
    vscodeToVimVisualSelection,
    vimToVscodeVisualLineSelection,
    vimToVscodeVisualSelection,
    vscodeToVimVisualLineSelection,
} from '../selectionUtils';
import * as positionUtils from '../positionUtils';
import { VimState } from '../vimStateTypes';
import { wordRanges } from '../wordUtils';
import { searchForward, searchBackward } from '../searchUtils';
import { paragraphForward, paragraphBackward } from '../paragraphUtils';

export const motions: Action[] = [
    parseKeysExact(['l'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            const lineLength = document.lineAt(position.line).text.length;
            return position.with({
                character: Math.min(position.character + 1, lineLength - 1),
            });
        });

        vimState.desiredColumns = [];
    }),
    parseKeysExact(['h'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            const lineLength = document.lineAt(position.line).text.length;
            return position.with({
                character: Math.max(position.character - 1, 0),
            });
        });

        vimState.desiredColumns = [];
    }),
    parseKeysExact(['k'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        setDesiredColumns(editor, vimState);

        execMotion(vimState, function({ document, position, selectionIndex, vimState }) {
            if (position.line === 0) {
                return position;
            }

            const newLineNumber = position.line - 1;
            const newLineLength = document.lineAt(newLineNumber).text.length;
            return new vscode.Position(
                newLineNumber,
                Math.min(vimState.desiredColumns[selectionIndex], Math.max(newLineLength - 1, 0)),
            );
        });
    }),
    parseKeysExact(['j'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        setDesiredColumns(editor, vimState);

        execMotion(vimState, function({ document, position, selectionIndex, vimState }) {
            if (position.line === document.lineCount - 1) {
                return position;
            }

            const newLineNumber = position.line + 1;
            const newLineLength = document.lineAt(newLineNumber).text.length;
            return new vscode.Position(
                newLineNumber,
                Math.min(vimState.desiredColumns[selectionIndex], Math.max(newLineLength - 1, 0)),
            );
        });
    }),
    parseKeysExact(['w'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            const lineText = document.lineAt(position.line).text;
            const ranges = wordRanges(lineText);

            const result = ranges.find(x => x.start > position.character);

            if (result) {
                return position.with({ character: result.start });
            } else {
                return position;
            }
        });

        vimState.desiredColumns = [];
    }),
    parseKeysExact(['b'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            const lineText = document.lineAt(position.line).text;
            const ranges = wordRanges(lineText);

            const result = ranges.reverse().find(x => x.start < position.character);

            if (result) {
                return position.with({ character: result.start });
            } else {
                return position;
            }
        });

        vimState.desiredColumns = [];
    }),
    parseKeysExact(['e'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            const lineText = document.lineAt(position.line).text;
            const ranges = wordRanges(lineText);

            const result = ranges.find(x => x.end > position.character);

            if (result) {
                return position.with({ character: result.end });
            } else {
                return position;
            }
        });

        vimState.desiredColumns = [];
    }),
    parseKeysRegex(/^f(..)$/, /^(f|f.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(vimState, match, function({ document, position, match }) {
            const fromPosition = position.with({ character: position.character + 1 });
            const result = searchForward(document, match[1], fromPosition);

            if (result) {
                return result;
            } else {
                return position;
            }
        });
    }),
    parseKeysRegex(/^F(..)$/, /^(F|F.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(vimState, match, function({ document, position, match }) {
            const fromPosition = position.with({ character: position.character - 1 });
            const result = searchBackward(document, match[1], fromPosition);

            if (result) {
                return result;
            } else {
                return position;
            }
        });
    }),
    parseKeysRegex(/^t(.)$/, /^t$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(vimState, match, function({ document, position, match }) {
            const lineText = document.lineAt(position.line).text;
            const result = lineText.indexOf(match[1], position.character + 1);

            if (result >= 0) {
                return position.with({ character: result });
            } else {
                return position;
            }
        });
    }),
    parseKeysRegex(/^T(.)$/, /^T$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(vimState, match, function({ document, position, match }) {
            const lineText = document.lineAt(position.line).text;
            const result = lineText.lastIndexOf(match[1], position.character - 1);

            if (result >= 0) {
                return position.with({ character: result });
            } else {
                return position;
            }
        });
    }),
    parseKeysExact(['g', 'g'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            return new vscode.Position(0, 0);
        });
    }),
    parseKeysExact(['G'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            return new vscode.Position(document.lineCount - 1, 0);
        });
    }),
    parseKeysExact(['}'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            return new vscode.Position(paragraphForward(document, position.line), 0);
        });
    }),
    parseKeysExact(['{'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, function({ document, position }) {
            return new vscode.Position(paragraphBackward(document, position.line), 0);
        });
    }),
];

type MotionArgs = {
    document: vscode.TextDocument,
    position: vscode.Position,
    selectionIndex: number,
    vimState: VimState,
};

type RegexMotionArgs = {
    document: vscode.TextDocument,
    position: vscode.Position,
    selectionIndex: number,
    vimState: VimState,
    match: RegExpMatchArray,
};

function execRegexMotion(
    vimState: VimState,
    match: RegExpMatchArray,
    regexMotion: (args: RegexMotionArgs) => vscode.Position,
) {
    return execMotion(vimState, function(motionArgs) {
        return regexMotion({
            ...motionArgs,
            match: match,
        });
    });
}

function execMotion(vimState: VimState, motion: (args: MotionArgs) => vscode.Position) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    const document = editor.document;

    editor.selections = editor.selections.map(x => x);

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
        } else {
            return selection;
        }
    });

    editor.revealRange(new vscode.Range(editor.selection.active, editor.selection.active));
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
