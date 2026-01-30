/**
 * Markdoc Export Extension
 *
 * Exports markdown and code files to markdoc.live for collaborative editing.
 */

import * as vscode from 'vscode';
import { exportToMarkdoc, exportSelectionToMarkdoc } from './exporter';

export function activate(context: vscode.ExtensionContext) {
  console.log('Markdoc Export extension activated');

  // Register export file command
  const exportFileCmd = vscode.commands.registerCommand(
    'markdoc.exportFile',
    async (uri?: vscode.Uri) => {
      try {
        // If called from explorer context menu, use the provided URI
        // Otherwise, use the active editor
        let fileUri: vscode.Uri | undefined = uri;

        if (!fileUri) {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage('No file is open');
            return;
          }
          fileUri = editor.document.uri;
        }

        await exportToMarkdoc(fileUri);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to export: ${message}`);
      }
    }
  );

  // Register export selection command
  const exportSelectionCmd = vscode.commands.registerCommand(
    'markdoc.exportSelection',
    async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No file is open');
          return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
          vscode.window.showErrorMessage('No text is selected');
          return;
        }

        await exportSelectionToMarkdoc(editor);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to export selection: ${message}`);
      }
    }
  );

  context.subscriptions.push(exportFileCmd, exportSelectionCmd);
}

export function deactivate() {
  console.log('Markdoc Export extension deactivated');
}
