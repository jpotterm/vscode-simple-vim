'use strict';
import * as vscode from 'vscode';

import { Mode } from '../modes_types';
import { Action } from '../action_types';
import {
    parseKeysExact,
    parseKeysOperator,
    createOperatorMotionExactKeys,
    parseKeysRegex,
    createOperatorMotionRegex,
} from '../parse_keys';
import {
    vscodeToVimVisualSelection,
    vimToVscodeVisualLineSelection,
    vimToVscodeVisualSelection,
    vscodeToVimVisualLineSelection,
} from '../selection_utils';
import * as positionUtils from '../position_utils';
import { VimState } from '../vim_state_types';
import { wordRanges, whitespaceWordRanges } from '../word_utils';
import { searchForward, searchBackward } from '../search_utils';
import { paragraphForward, paragraphBackward } from '../paragraph_utils';
import { VimRange } from '../vim_range_types';
import { setVisualLineSelections } from '../visual_line_utils';

export const motions: Action[] = [
    parseKeysExact(['l'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            return positionUtils.rightNormal(document, position);
        });

        vimState.desiredColumns = [];
    }),

    parseKeysExact(['h'], [Mode.Normal, Mode.Visual],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            return positionUtils.left(position);
        });

        vimState.desiredColumns = [];
    }),

    parseKeysExact(['k'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(outerVimState, editor) {
        const isVisual = outerVimState.mode === Mode.Visual || outerVimState.mode === Mode.VisualLine;
        vscode.commands.executeCommand('cursorMove', { to: 'up', by: 'line', select: isVisual }).then(function() {
            if (outerVimState.mode === Mode.VisualLine) {
                setVisualLineSelections(editor);
            }
        });

        // Experiment with having VSCode manage the desired columns for us. The advantage is that it's
        // easier and it correctly handles the case when selection is changed by non-simple-vim commands
        // or mouse. The disadvantage is that in normal mode, the cursor can land on the last character
        // of the line which doesn't make sense in the vim worldview.

        // setDesiredColumns(editor, outerVimState);

        // execMotion(outerVimState, editor, function({ document, position, selectionIndex, vimState }) {
        //     if (position.line === 0) {
        //         return position;
        //     }

        //     const newLineNumber = position.line - 1;
        //     const newLineLength = document.lineAt(newLineNumber).text.length;
        //     return new vscode.Position(
        //         newLineNumber,
        //         Math.min(vimState.desiredColumns[selectionIndex], Math.max(newLineLength - 1, 0)),
        //     );
        // });
    }),

    parseKeysExact(['j'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(outerVimState, editor) {
        const isVisual = outerVimState.mode === Mode.Visual || outerVimState.mode === Mode.VisualLine;
        vscode.commands.executeCommand('cursorMove', { to: 'down', by: 'line', select: isVisual }).then(function() {
            if (outerVimState.mode === Mode.VisualLine) {
                setVisualLineSelections(editor);
            }
        });

        // Experiment with having VSCode manage the desired columns for us. The advantage is that it's
        // easier and it correctly handles the case when selection is changed by non-simple-vim commands
        // or mouse. The disadvantage is that in normal mode, the cursor can land on the last character
        // of the line which doesn't make sense in the vim worldview.

        // setDesiredColumns(editor, outerVimState);

        // execMotion(outerVimState, editor, function({ document, position, selectionIndex, vimState }) {
        //     if (position.line === document.lineCount - 1) {
        //         return position;
        //     }

        //     const newLineNumber = position.line + 1;
        //     const newLineLength = document.lineAt(newLineNumber).text.length;
        //     return new vscode.Position(
        //         newLineNumber,
        //         Math.min(vimState.desiredColumns[selectionIndex], Math.max(newLineLength - 1, 0)),
        //     );
        // });
    }),

    parseKeysExact(['w'], [Mode.Normal, Mode.Visual], createWordForwardHandler(wordRanges)),
    parseKeysExact(['W'], [Mode.Normal, Mode.Visual], createWordForwardHandler(whitespaceWordRanges)),

    parseKeysExact(['b'], [Mode.Normal, Mode.Visual], createWordBackwardHandler(wordRanges)),
    parseKeysExact(['B'], [Mode.Normal, Mode.Visual], createWordBackwardHandler(whitespaceWordRanges)),

    parseKeysExact(['e'], [Mode.Normal, Mode.Visual], createWordEndHandler(wordRanges)),
    parseKeysExact(['E'], [Mode.Normal, Mode.Visual], createWordEndHandler(whitespaceWordRanges)),

    parseKeysRegex(/^f(..)$/, /^(f|f.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        findForward(vimState, editor, match);

        vimState.semicolonAction = function(innerVimState, innerEditor) {
            findForward(innerVimState, innerEditor, match);
        };

        vimState.commaAction = function(innerVimState, innerEditor) {
            findBackward(innerVimState, innerEditor, match);
        };
    }),

    parseKeysRegex(/^F(..)$/, /^(F|F.)$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        findBackward(vimState, editor, match);

        vimState.semicolonAction = function(innerVimState, innerEditor) {
            findBackward(innerVimState, innerEditor, match);
        };

        vimState.commaAction = function(innerVimState, innerEditor) {
            findForward(innerVimState, innerEditor, match);
        };
    }),

    parseKeysRegex(/^t(.)$/, /^t$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        tillForward(vimState, editor, match);

        vimState.semicolonAction = function(innerVimState, innerEditor) {
            tillForward(innerVimState, innerEditor, match);
        };

        vimState.commaAction = function(innerVimState, innerEditor) {
            tillBackward(innerVimState, innerEditor, match);
        };
    }),

    parseKeysRegex(/^T(.)$/, /^T$/, [Mode.Normal, Mode.Visual],  function(vimState, editor, match) {
        tillBackward(vimState, editor, match);

        vimState.semicolonAction = function(innerVimState, innerEditor) {
            tillBackward(innerVimState, innerEditor, match);
        };

        vimState.commaAction = function(innerVimState, innerEditor) {
            tillForward(innerVimState, innerEditor, match);
        };
    }),

    parseKeysExact(['g', 'g'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            return new vscode.Position(0, 0);
        });

        vimState.desiredColumns = [];
    }),

    parseKeysExact(['G'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            return new vscode.Position(document.lineCount - 1, 0);
        });

        vimState.desiredColumns = [];
    }),

    parseKeysExact(['}'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            return new vscode.Position(paragraphForward(document, position.line), 0);
        });
    }),

    parseKeysExact(['{'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            return new vscode.Position(paragraphBackward(document, position.line), 0);
        });

        vimState.desiredColumns = [];
    }),

    parseKeysExact(['$'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            const lineLength = document.lineAt(position.line).text.length;
            return position.with({ character: Math.max(lineLength - 1, 0) });
        });

        vimState.desiredColumns = editor.selections.map(() => Infinity);
    }),

    parseKeysExact(['_'], [Mode.Normal, Mode.Visual, Mode.VisualLine],  function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            const line = document.lineAt(position.line);
            return position.with({ character: line.firstNonWhitespaceCharacterIndex });
        });

        vimState.desiredColumns = [];
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
    editor: vscode.TextEditor,
    match: RegExpMatchArray,
    regexMotion: (args: RegexMotionArgs) => vscode.Position,
) {
    return execMotion(vimState, editor, function(motionArgs) {
        return regexMotion({
            ...motionArgs,
            match: match,
        });
    });
}

function execMotion(vimState: VimState, editor: vscode.TextEditor, motion: (args: MotionArgs) => vscode.Position) {
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

    editor.revealRange(
        new vscode.Range(editor.selection.active, editor.selection.active),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
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

function findForward(vimState: VimState, editor: vscode.TextEditor, outerMatch: RegExpMatchArray): void {
    execRegexMotion(vimState, editor, outerMatch, function({ document, position, match }) {
        const fromPosition = position.with({ character: position.character + 1 });
        const result = searchForward(document, match[1], fromPosition);

        if (result) {
            return result;
        } else {
            return position;
        }
    });

    vimState.desiredColumns = [];
}

function findBackward(vimState: VimState, editor: vscode.TextEditor, outerMatch: RegExpMatchArray): void {
    execRegexMotion(vimState, editor, outerMatch, function({ document, position, match }) {
        const fromPosition = positionLeftWrap(document, position);
        const result = searchBackward(document, match[1], fromPosition);

        if (result) {
            return result;
        } else {
            return position;
        }
    });

    vimState.desiredColumns = [];
}

function tillForward(vimState: VimState, editor: vscode.TextEditor, outerMatch: RegExpMatchArray): void {
    execRegexMotion(vimState, editor, outerMatch, function({ document, position, match }) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.indexOf(match[1], position.character + 1);

        if (result >= 0) {
            return position.with({ character: result });
        } else {
            return position;
        }
    });

    vimState.desiredColumns = [];
}

function tillBackward(vimState: VimState, editor: vscode.TextEditor, outerMatch: RegExpMatchArray): void {
    execRegexMotion(vimState, editor, outerMatch, function({ document, position, match }) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.lastIndexOf(match[1], position.character - 1);

        if (result >= 0) {
            return position.with({ character: result });
        } else {
            return position;
        }
    });

    vimState.desiredColumns = [];
}

function positionLeftWrap(document: vscode.TextDocument, position: vscode.Position): vscode.Position {
    if (position.character === 0) {
        if (position.line === 0) {
            return position;
        } else {
            const lineLength = document.lineAt(position.line - 1).text.length;
            return new vscode.Position(position.line - 1, lineLength);
        }
    } else {
        return position.with({ character: position.character - 1 });
    }
}

function createWordForwardHandler(
    wordRangesFunction: (text: string) => { start: number; end: number }[],
): (vimState: VimState, editor: vscode.TextEditor) => void {
    return function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            const lineText = document.lineAt(position.line).text;
            const ranges = wordRangesFunction(lineText);

            const result = ranges.find(x => x.start > position.character);

            if (result) {
                return position.with({ character: result.start });
            } else {
                return position;
            }
        });

        vimState.desiredColumns = [];
    };
}

function createWordBackwardHandler(
    wordRangesFunction: (text: string) => { start: number; end: number }[],
): (vimState: VimState, editor: vscode.TextEditor) => void {
    return function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            const lineText = document.lineAt(position.line).text;
            const ranges = wordRangesFunction(lineText);

            const result = ranges.reverse().find(x => x.start < position.character);

            if (result) {
                return position.with({ character: result.start });
            } else {
                return position;
            }
        });

        vimState.desiredColumns = [];
    };
}

function createWordEndHandler(
    wordRangesFunction: (text: string) => { start: number; end: number }[],
): (vimState: VimState, editor: vscode.TextEditor) => void {
    return function(vimState, editor) {
        execMotion(vimState, editor, function({ document, position }) {
            const lineText = document.lineAt(position.line).text;
            const ranges = wordRangesFunction(lineText);

            const result = ranges.find(x => x.end > position.character);

            if (result) {
                return position.with({ character: result.end });
            } else {
                return position;
            }
        });

        vimState.desiredColumns = [];
    };
}
