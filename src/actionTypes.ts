'use strict';
import * as vscode from 'vscode';

import { VimState } from './vimState';
import { ParseKeysStatus } from './parseKeysTypes';

export type Action = (vimState: VimState, keys: string[], editor: vscode.TextEditor) => ParseKeysStatus;

