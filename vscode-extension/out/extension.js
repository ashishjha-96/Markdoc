"use strict";
/**
 * Markdoc Export Extension
 *
 * Exports markdown and code files to markdoc.live for collaborative editing.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const exporter_1 = require("./exporter");
function activate(context) {
    console.log('Markdoc Export extension activated');
    // Register export file command
    const exportFileCmd = vscode.commands.registerCommand('markdoc.exportFile', async (uri) => {
        try {
            // If called from explorer context menu, use the provided URI
            // Otherwise, use the active editor
            let fileUri = uri;
            if (!fileUri) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No file is open');
                    return;
                }
                fileUri = editor.document.uri;
            }
            await (0, exporter_1.exportToMarkdoc)(fileUri);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to export: ${message}`);
        }
    });
    // Register export selection command
    const exportSelectionCmd = vscode.commands.registerCommand('markdoc.exportSelection', async () => {
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
            await (0, exporter_1.exportSelectionToMarkdoc)(editor);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to export selection: ${message}`);
        }
    });
    context.subscriptions.push(exportFileCmd, exportSelectionCmd);
}
function deactivate() {
    console.log('Markdoc Export extension deactivated');
}
//# sourceMappingURL=extension.js.map