'use strict';

export function arraySet<T>(xs: T[], i: number, x: T): T[] {
    const newXs = xs.slice();
    newXs[i] = x;
    return newXs;
}
