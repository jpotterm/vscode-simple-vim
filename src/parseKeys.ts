'use strict';
import { VimState } from './vimState';
import { Mode } from './modes';

export enum ParseKeysStatus {
    YES,
    NO,
    MORE_INPUT,
}

export type ParseKeysResult = {
    status: ParseKeysStatus;
    rest: string[];
};

type ParseKeysFunction = (vimState: VimState, keys: string[]) => ParseKeysResult;

export interface ParseKeys {
    parseKeys: ParseKeysFunction;
}

function arrayStartsWith<T>(prefix: T[], xs: T[]) {
    if (xs.length < prefix.length) {
        return false;
    }

    for (let i = 0; i < prefix.length; ++i) {
        if (prefix[i] !== xs[i]) {
            return false;
        }
    }

    return true;
}

function arrayEquals<T>(xs: T[], ys: T[]) {
    if (xs.length !== ys.length) {
        return false;
    }

    for (let i = 0; i < xs.length; ++i) {
        if (xs[i] !== ys[i]) {
            return false;
        }
    }

    return true;
}

export function parseKeysExact(matchKeys: string[], modes?: Mode[]): ParseKeysFunction {
    return function(vimState: VimState, keys: string[]): ParseKeysResult {
        if (modes && modes.indexOf(vimState.mode) < 0) {
            return {
                status: ParseKeysStatus.NO,
                rest: [],
            };
        }

        if (arrayEquals(keys, matchKeys)) {
            return {
                status: ParseKeysStatus.YES,
                rest: [],
            };
        } else if (arrayStartsWith(keys, matchKeys)) {
            return {
                status: ParseKeysStatus.MORE_INPUT,
                rest: [],
            };
        } else {
            return {
                status: ParseKeysStatus.NO,
                rest: [],
            };
        }
    }
}

export function parseKeysWithRest(matchKeys: string[]): ParseKeysFunction {
    return function(vimState: VimState, keys: string[]): ParseKeysResult {
        if (arrayStartsWith(matchKeys, keys)) {
            return {
                status: ParseKeysStatus.YES,
                rest: keys.slice(matchKeys.length),
            };
        } else if (arrayStartsWith(keys, matchKeys)) {
            return {
                status: ParseKeysStatus.MORE_INPUT,
                rest: [],
            };
        } else {
            return {
                status: ParseKeysStatus.NO,
                rest: [],
            };
        }
    }
}
