'use strict';

export function arraySet<T>(xs: T[], i: number, x: T): T[] {
    const newXs = xs.slice();
    newXs[i] = x;
    return newXs;
}

export function arrayFindLast<T>(xs: T[], p: (x: T) => boolean): T | undefined {
    const filtered = xs.filter(p);

    if (filtered.length === 0) {
        return undefined;
    } else {
        return filtered[filtered.length - 1];
    }
}
