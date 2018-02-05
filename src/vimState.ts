'use strict';
import { VimState } from './vimStateTypes';
import { Mode } from './modesTypes';

export const vimState: VimState = {
    typeSubscription: undefined,
    mode: Mode.Insert,
    desiredColumns: [],
    keysPressed: [],
    registers: {},
};
