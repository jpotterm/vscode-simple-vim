'use strict';
import { VimState } from './vimState';
import { Mode } from './modes';
import { OperatorMotion } from './operators';

export enum ParseKeysStatus {
    YES,
    NO,
    MORE_INPUT,
}

type ParseKeysFunction = (vimState: VimState, keys: string[]) => ParseKeysStatus;

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
    return function(vimState, keys) {
        if (modes && modes.indexOf(vimState.mode) < 0) {
            return ParseKeysStatus.NO;
        }

        if (arrayEquals(keys, matchKeys)) {
            return ParseKeysStatus.YES;
        } else if (arrayStartsWith(keys, matchKeys)) {
            return ParseKeysStatus.MORE_INPUT;
        } else {
            return ParseKeysStatus.NO;
        }
    }
}

type ParseFailure = {
    kind: 'failure';
    status: ParseKeysStatus;
};

type ParseRegisterSuccess = {
    kind: 'success';
    register: string;
    rest: string[];
};

function parseRegister(keys: string[]): ParseFailure | ParseRegisterSuccess {
    if (keys[0] === '"') {
        if (keys.length < 2) {
            return {
                kind: 'failure',
                status: ParseKeysStatus.MORE_INPUT,
            };
        } else {
            return {
                kind: 'success',
                register: keys[1],
                rest: keys.slice(2),
            };
        }
    }

    return {
        kind: 'success',
        register: '"',
        rest: keys,
    };
}

type ParseCountSuccess = {
    kind: 'success';
    count: number;
    rest: string[];
};

function parseCount(keys: string[]): ParseCountSuccess {
    const match = keys.join('').match(/^\d+/);

    if (match) {
        return {
            kind: 'success',
            count: parseInt(match[0]),
            rest: keys.slice(match[0].length),
        };
    } else {
        return {
            kind: 'success',
            count: 1,
            rest: keys,
        };
    }
}

type ParseOperatorSuccess = {
    kind: 'success';
    rest: string[];
};

function parseOperator(keys: string[], operatorKeys: string[]): ParseFailure | ParseOperatorSuccess {
    if (arrayStartsWith(operatorKeys, keys)) {
        return {
            kind: 'success',
            rest: keys.slice(operatorKeys.length),
        };
    } else if (arrayStartsWith(keys, operatorKeys)) {
        return {
            kind: 'failure',
            status: ParseKeysStatus.MORE_INPUT,
        };
    } else {
        return {
            kind: 'failure',
            status: ParseKeysStatus.NO,
        };
    }
}

type ParseOperatorMotionSuccess = {
    kind: 'success';
    motion: OperatorMotion;
};

function parseOperatorMotion(
    vimState: VimState,
    keys: string[],
    motions: (OperatorMotion & ParseKeys)[]
): ParseFailure | ParseOperatorMotionSuccess {
    const motionDoes = motions.find(
        x => x.parseKeys(vimState, keys) === ParseKeysStatus.YES
    );

    if (motionDoes) {
        return {
            kind: 'success',
            motion: motionDoes,
        };
    } else {
        const motionCould = motions.find(
            x => x.parseKeys(vimState, keys) === ParseKeysStatus.MORE_INPUT
        );

        if (motionCould) {
            return {
                kind: 'failure',
                status: ParseKeysStatus.MORE_INPUT,
            };
        } else {
            return {
                kind: 'failure',
                status: ParseKeysStatus.NO,
            };
        }
    }
}

export type ParseOperatorAllSuccess = {
    kind: 'success';
    register: string;
    count: number;
    motion: OperatorMotion | undefined;
};

export function parseOperatorAll(
    vimState: VimState,
    keys: string[],
    operatorKeys: string[],
    motions: (OperatorMotion & ParseKeys)[]
): ParseFailure | ParseOperatorAllSuccess {
    const registerResult = parseRegister(keys);
    if (registerResult.kind === 'failure') {
        return {
            kind: 'failure',
            status: registerResult.status,
        };
    }

    if (registerResult.rest.length === 0) {
        return {
            kind: 'failure',
            status: ParseKeysStatus.MORE_INPUT,
        };
    }

    const countResult = parseCount(registerResult.rest);

    if (countResult.rest.length === 0) {
        return {
            kind: 'failure',
            status: ParseKeysStatus.MORE_INPUT,
        };
    }

    const operatorResult = parseOperator(countResult.rest, operatorKeys);
    if (operatorResult.kind === 'failure') {
        return {
            kind: 'failure',
            status: operatorResult.status,
        };
    }

    let motion;
    if (vimState.mode === Mode.Normal) {
        if (operatorResult.rest.length === 0) {
            return {
                kind: 'failure',
                status: ParseKeysStatus.MORE_INPUT,
            };
        }

        const motionResult = parseOperatorMotion(vimState, operatorResult.rest, motions);
        if (motionResult.kind === 'failure') {
            return {
                kind: 'failure',
                status: motionResult.status,
            };
        }

        motion = motionResult.motion;
    }

    return {
        kind: 'success',
        register: registerResult.register,
        count: countResult.count,
        motion: motion,
    };
}

export function parseKeysOperator(operatorKeys: string[], motions: (OperatorMotion & ParseKeys)[]): ParseKeysFunction {
    return function(vimState, keys) {
        const result = parseOperatorAll(vimState, keys, operatorKeys, motions);

        if (result.kind === 'failure') {
            return result.status;
        } else {
            return ParseKeysStatus.YES;
        }
    };
}
