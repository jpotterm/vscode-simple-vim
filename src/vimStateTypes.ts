'use strict';
import * as vscode from 'vscode';

import { Mode } from './modesTypes';

type Regsiter = {
    contents: string;
    linewise: boolean;
};

export type VimState = {
    typeSubscription: vscode.Disposable | undefined;
    mode: Mode;
    desiredColumns: number[];
    keysPressed: string[];
    registers: { [index: string]: Regsiter[] };
};
