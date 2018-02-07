'use strict';
import * as vscode from 'vscode';

import { createOperatorMotionExactKeys, createOperatorMotionRegex } from '../parseKeys';
import { OperatorMotion } from '../parseKeysTypes';
import { searchForward, searchBackward } from '../searchUtils';
import * as positionUtils from '../positionUtils';
import { wordRanges } from '../wordUtils';
import { paragraphForward, paragraphBackward } from '../paragraphUtils';
import { VimRange } from '../vimRangeTypes';
import { VimState } from '../vimStateTypes';

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
    createOperatorMotionExactKeys(['w'], function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = wordRanges(lineText);

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
    }),
    createOperatorMotionExactKeys(['b'], function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = wordRanges(lineText);

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
    }),
    createOperatorMotionExactKeys(['e'], function(vimState, document, position) {
        const lineText = document.lineAt(position.line).text;
        const ranges = wordRanges(lineText);

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
                    position.with({ character: result.end })
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
                    position.with({ character: result.end + 1 })
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

type CharacterRange = {
    start: number;
    end: number;
};

function findQuoteRange(ranges: CharacterRange[], position: vscode.Position): CharacterRange | undefined {
    const insideResult = ranges.find(x => x.start <= position.character && x.end >= position.character);

    if (insideResult) {
        return insideResult;
    }

    const outsideResult = ranges.find(x => x.start > position.character);

    if (outsideResult) {
        return outsideResult;
    }

    return undefined;
}

function quoteRanges(quoteChar: string, s: string): CharacterRange[] {
    let stateInQuote = false;
    let stateStartIndex = 0;
    const ranges = [];

    for (let i = 0; i < s.length; ++i) {
        if (s[i] === quoteChar) {
            if (stateInQuote) {
                ranges.push({
                    start: stateStartIndex,
                    end: i,
                });

                stateInQuote = false;
            } else {
                stateInQuote = true;
                stateStartIndex = i;
            }
        }
    }

    return ranges;
}
