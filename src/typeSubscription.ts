'use strict';
import * as vscode from 'vscode';
import { VimState } from './vimStateTypes';

export function addTypeSubscription(vimState: VimState, typeHandler: (vimState: VimState, char: string) => void): void {
    vimState.typeSubscription = vscode.commands.registerCommand('type', function(e) {
        typeHandler(vimState, e.text);
    });
}

export function removeTypeSubscription(vimState: VimState): void {
    if (vimState.typeSubscription) {
        vimState.typeSubscription.dispose();
    }
}
