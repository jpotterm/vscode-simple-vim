'use strict';
import * as vscode from 'vscode';

import { createOperatorMotionExactKeys, createOperatorMotionRegex } from '../parseKeys';
import { OperatorMotion } from '../parseKeysTypes';
import { searchForward, searchBackward } from '../searchUtils';
import * as positionUtils from '../positionUtils';
import { wordRanges, whitespaceWordRanges } from '../wordUtils';
import { paragraphForward, paragraphBackward } from '../paragraphUtils';
import { VimRange } from '../vimRangeTypes';
import { VimState } from '../vimStateTypes';
import { quoteRanges, findQuoteRange } from '../quoteUtils';
import { indentLevelRange } from '../indentUtils';

export const operatorMotions: OperatorMotion[] = [
    createOperatorMotionExactKeys(['l'], function(vimState, document, position) {
        return {
            range: new vscode.Range(position, positionUtils.right(document, position)),
            linewise: false,
        };
    }),
    createOperatorMotionExactKeys(['h'], function(vimState, document, position) {
        return {
            range: new vscode.Range(position, positionUtils.left(document, position)),
            linewise: false,
        };
    }),
    createOperatorMotionExactKeys(['k'], function(vimState, document, position) {
        if (position.line === 0) {
            return {
                range: new vscode.Range(position, position),
                linewise: true,
            };
        }

        return {
            range: new vscode.Range(
                new vscode.Position(position.line - 1, 0),
                positionUtils.lineEnd(document, position),
            ),
            linewise: true,
        };
    }),

    createOperatorMotionExactKeys(['j'], function(vimState, document, position) {
        if (position.line === document.lineCount - 1) {
            return {
                range: new vscode.Range(position, position),
                linewise: true,
            };
        }

        return {
            range: new vscode.Range(
                new vscode.Position(position.line, 0),
                positionUtils.lineEnd(document, position.with({ line: position.line + 1 })),
            ),
            linewise: true,
        };
    }),

    createOperatorMotionExactKeys(['w'], createWordForwardHandler(wordRanges)),
    createOperatorMotionExactKeys(['W'], createWordForwardHandler(whitespaceWordRanges)),

    createOperatorMotionExactKeys(['b'], createWordBackwardHandler(wordRanges)),
    createOperatorMotionExactKeys(['B'], createWordBackwardHandler(whitespaceWordRanges)),

    createOperatorMotionExactKeys(['e'], createWordEndHandler(wordRanges)),
    createOperatorMotionExactKeys(['E'], createWordEndHandler(whitespaceWordRanges)),

    createOperatorMotionRegex(/^f(..)$/, /^(f|f.)$/, function(vimState, document, position, match) {
        const fromPosition = position.with({ character: position.character + 1 });
        const result = searchForward(document, match[1], fromPosition);

        if (result) {
            return {
                range: new vscode.Range(position, result),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),

    createOperatorMotionRegex(/^F(..)$/, /^(F|F.)$/, function(vimState, document, position, match) {
        const fromPosition = position.with({ character: position.character - 1 });
        const result = searchBackward(document, match[1], fromPosition);

        if (result) {
            return {
                range: new vscode.Range(position, result),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),

    createOperatorMotionRegex(/^t(.)$/, /^t$/, function(vimState, document, position, match) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.indexOf(match[1], position.character + 1);

        if (result >= 0) {
            return {
                range: new vscode.Range(position, position.with({ character: result })),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),

    createOperatorMotionRegex(/^T(.)$/, /^T$/, function(vimState, document, position, match) {
        const lineText = document.lineAt(position.line).text;
        const result = lineText.lastIndexOf(match[1], position.character - 1);

        if (result >= 0) {
            const newPosition = positionUtils.right(document, position.with({ character: result }));
            return {
                range: new vscode.Range(newPosition, position),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    }),

    createOperatorMotionExactKeys(['g', 'g'], function(vimState, document, position) {
        const lineLength = document.lineAt(position.line).text.length;

        return {
            range: new vscode.Range(
                new vscode.Position(0, 0),
                position.with({ character: lineLength }),
            ),
            linewise: true,
        };
    }),

    createOperatorMotionExactKeys(['G'], function(vimState, document, position) {
        const lineLength = document.lineAt(document.lineCount - 1).text.length;

        return {
            range: new vscode.Range(
                position.with({ character: 0 }),
                new vscode.Position(document.lineCount - 1, lineLength),
            ),
            linewise: true,
        };
    }),

    createOperatorMotionExactKeys(['}'], function(vimState, document, position) {
        return {
            range: new vscode.Range(
                position.with({ character: 0 }),
                new vscode.Position(paragraphForward(document, position.line), 0),
            ),
            linewise: true,
        };
    }),

    createOperatorMotionExactKeys(['{'], function(vimState, document, position) {
        return {
            range: new vscode.Range(
                new vscode.Position(paragraphBackward(document, position.line), 0),
                position.with({ character: 0 }),
            ),
            linewise: true,
        };
    }),

    createOperatorMotionExactKeys(['i', "'"], createInnerQuoteHandler("'")),
    createOperatorMotionExactKeys(['a', "'"], createOuterQuoteHandler("'")),

    createOperatorMotionExactKeys(['i', '"'], createInnerQuoteHandler('"')),
    createOperatorMotionExactKeys(['a', '"'], createOuterQuoteHandler('"')),

    createOperatorMotionExactKeys(['i', '('], createInnerBracketHandler('(', ')')),
    createOperatorMotionExactKeys(['a', '('], createOuterBracketHandler('(', ')')),

    createOperatorMotionExactKeys(['i', '{'], createInnerBracketHandler('{', '}')),
    createOperatorMotionExactKeys(['a', '{'], createOuterBracketHandler('{', '}')),

    createOperatorMotionExactKeys(['i', '['], createInnerBracketHandler('[', ']')),
    createOperatorMotionExactKeys(['a', '['], createOuterBracketHandler('[', ']')),

    createOperatorMotionExactKeys(['i', '<'], createInnerBracketHandler('<', '>')),
    createOperatorMotionExactKeys(['a', '<'], createOuterBracketHandler('<', '>')),

    createOperatorMotionExactKeys(['i', 'i'], function(vimState, document, position) {
        const simpleRange = indentLevelRange(document, position.line);

        return {
            range: new vscode.Range(
                new vscode.Position(simpleRange.start, 0),
                new vscode.Position(simpleRange.end, document.lineAt(simpleRange.end).text.length),
            ),
            linewise: true,
        };
    }),
];

function createInnerBracketHandler(
    openingString: string,
    closingString: string,
): (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange {
    return function(vimState, document, position) {
        const start = searchBackward(document, openingString, position);
        const end = searchForward(document, closingString, position);

        if (start && end) {
            return {
                range: new vscode.Range(start.with({ character: start.character + 1 }), end),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    };
}

function createOuterBracketHandler(
    openingString: string,
    closingString: string,
): (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange {
    return function(vimState, document, position) {
        const start = searchBackward(document, openingString, position);
        const end = searchForward(document, closingString, position);

        if (start && end) {
            return {
                range: new vscode.Range(start, end.with({ character: end.character + 1 })),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    };
}

function createInnerQuoteHandler(
    quoteChar: string,
): (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange {
    return function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = quoteRanges(quoteChar, lineText);
        const result = findQuoteRange(ranges, position);

        if (result) {
            return {
                range: new vscode.Range(
                    position.with({ character: result.start + 1 }),
                    position.with({ character: result.end }),
                ),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    };
}

function createOuterQuoteHandler(
    quoteChar: string,
): (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange {
    return function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = quoteRanges(quoteChar, lineText);
        const result = findQuoteRange(ranges, position);

        if (result) {
            return {
                range: new vscode.Range(
                    position.with({ character: result.start }),
                    position.with({ character: result.end + 1 }),
                ),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    };
}

function createWordForwardHandler(
    wordRangesFunction: (text: string) => { start: number; end: number }[],
): (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange {
    return function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = wordRangesFunction(lineText);

        const result = ranges.find(x => x.start > position.character);

        if (result) {
            return {
                range: new vscode.Range(position, position.with({ character: result.start })),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position.with({ character: lineText.length })),
                linewise: false,
            };
        }
    };
}

function createWordBackwardHandler(
    wordRangesFunction: (text: string) => { start: number; end: number }[],
): (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange {
    return function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = wordRangesFunction(lineText);

        const result = ranges.reverse().find(x => x.start < position.character);

        if (result) {
            return {
                range: new vscode.Range(position.with({ character: result.start }), position),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    };
}

function createWordEndHandler(
    wordRangesFunction: (text: string) => { start: number; end: number }[],
): (vimState: VimState, document: vscode.TextDocument, position: vscode.Position) => VimRange {
    return function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = wordRangesFunction(lineText);

        const result = ranges.find(x => x.end > position.character);

        if (result) {
            return {
                range: new vscode.Range(
                    position,
                    positionUtils.right(document, position.with({ character: result.end })),
                ),
                linewise: false,
            };
        } else {
            return {
                range: new vscode.Range(position, position),
                linewise: false,
            };
        }
    };
}
