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
import { vscodeToVimVisualSelection } from '../selectionUtils';
import * as positionUtils from '../positionUtils';
import * as motions from './motions';

export const motions: Action[] = [
    parseKeysExact(['l'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.right);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['h'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.left);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['k'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        setDesiredColumns(editor, vimState);
        execMotion(motions.up);
    }),
    parseKeysExact(['j'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        setDesiredColumns(editor, vimState);
        execMotion(motions.down);
    }),
    parseKeysExact(['w'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.wordForward);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['b'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.wordBackward);
        vimState.desiredColumns = [];
    }),
    parseKeysExact(['e'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(motions.wordEnd);
        vimState.desiredColumns = [];
    }),
    parseKeysRegex(/^f(..)$/, /^(f|f.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.findForward);
    }),
    parseKeysRegex(/^F(..)$/, /^(F|F.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.findBackward);
    }),
    parseKeysRegex(/^t(.)$/, /^t$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.tillForward);
    }),
    parseKeysRegex(/^T(.)$/, /^T$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        execRegexMotion(match, motions.tillBackward);
    }),
    parseKeysExact(['g', 'g'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(motions.fileBeginning);
    }),
    parseKeysExact(['G'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(motions.fileEnd);
    }),
];

function execRegexMotion(match: RegExpMatchArray, regexMotion: (args: motions.RegexMotionArgs) => vscode.Position) {
    return execMotion(function(motionArgs) {
        return regexMotion({
            ...motionArgs,
            match: match,
        });
    });
}

function execMotion(motion: (args: motions.MotionArgs) => vscode.Position) {
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
