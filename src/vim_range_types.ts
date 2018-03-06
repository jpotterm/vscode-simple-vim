import * as vscode from 'vscode';

export type VimRange = {
    range: vscode.Range;
    linewise: boolean;
};
