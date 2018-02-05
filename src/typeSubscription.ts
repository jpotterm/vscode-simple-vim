'use strict';
import * as vscode from 'vscode';

import { vimState } from './vimState';

export function addTypeSubscription(typeHandler: (e: { text: string }) => void): void {
    vimState.typeSubscription = vscode.commands.registerCommand('type', typeHandler);
}

export function removeTypeSubscription(): void {
    if (vimState.typeSubscription) {
        vimState.typeSubscription.dispose();
    }
}
