"use strict";
/**
 * Exporter Module
 *
 * Handles exporting files and selections to markdoc.live.
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
exports.exportToMarkdoc = exportToMarkdoc;
exports.exportSelectionToMarkdoc = exportSelectionToMarkdoc;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
// Language mappings for code fence syntax highlighting
const LANGUAGE_MAP = {
    // JavaScript/TypeScript
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    // Web
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.vue': 'vue',
    '.svelte': 'svelte',
    // Python
    '.py': 'python',
    '.pyw': 'python',
    '.pyx': 'python',
    // Systems
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.rs': 'rust',
    '.go': 'go',
    // JVM
    '.java': 'java',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    '.scala': 'scala',
    '.groovy': 'groovy',
    // .NET
    '.cs': 'csharp',
    '.fs': 'fsharp',
    '.vb': 'vb',
    // Scripting
    '.rb': 'ruby',
    '.php': 'php',
    '.pl': 'perl',
    '.pm': 'perl',
    '.lua': 'lua',
    '.r': 'r',
    // Shell
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'zsh',
    '.fish': 'fish',
    '.ps1': 'powershell',
    '.bat': 'batch',
    '.cmd': 'batch',
    // Data/Config
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.xml': 'xml',
    '.ini': 'ini',
    // Elixir/Erlang
    '.ex': 'elixir',
    '.exs': 'elixir',
    '.erl': 'erlang',
    // Other
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.swift': 'swift',
    '.dart': 'dart',
    '.zig': 'zig',
    '.nim': 'nim',
    '.clj': 'clojure',
    '.cljs': 'clojure',
    '.ml': 'ocaml',
    '.hs': 'haskell',
    '.elm': 'elm',
};
// Markdown file extensions (exported as-is)
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mdown', '.mkd']);
/**
 * Get the language identifier for a file extension
 */
function getLanguage(ext) {
    return LANGUAGE_MAP[ext.toLowerCase()] || 'text';
}
/**
 * Check if a file is a markdown file
 */
function isMarkdownFile(ext) {
    return MARKDOWN_EXTENSIONS.has(ext.toLowerCase());
}
/**
 * Wrap code content in a markdown code fence
 */
function wrapInCodeFence(content, language, filename) {
    const header = filename ? `> File: \`${filename}\`\n\n` : '';
    return `${header}\`\`\`${language}\n${content}\n\`\`\`\n`;
}
/**
 * Get the server URL from configuration
 */
function getServerUrl() {
    const config = vscode.workspace.getConfiguration('markdoc');
    return config.get('serverUrl') || 'https://markdoc.live';
}
/**
 * Open URL in default browser without encoding issues
 */
function openUrl(url) {
    return new Promise((resolve, reject) => {
        const command = process.platform === 'darwin'
            ? `open "${url}"`
            : process.platform === 'win32'
                ? `start "" "${url}"`
                : `xdg-open "${url}"`;
        (0, child_process_1.exec)(command, (error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}
/**
 * POST markdown to the Markdoc API and get back the doc URL
 */
async function postToMarkdoc(markdown) {
    const serverUrl = getServerUrl();
    const apiUrl = `${serverUrl}/api/import`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
    });
    if (!response.ok) {
        const errorData = (await response.json().catch(() => ({})));
        throw new Error(errorData.error || `Server returned ${response.status}`);
    }
    const data = (await response.json());
    return { docId: data.doc_id, url: data.url };
}
/**
 * Export a file to markdoc.live
 */
async function exportToMarkdoc(fileUri) {
    // Read the file content
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    const content = new TextDecoder().decode(fileContent);
    const ext = path.extname(fileUri.fsPath);
    const filename = path.basename(fileUri.fsPath);
    // Prepare markdown content
    let markdown;
    if (isMarkdownFile(ext)) {
        // Export markdown files as-is
        markdown = content;
    }
    else {
        // Wrap code files in a code fence
        const language = getLanguage(ext);
        markdown = wrapInCodeFence(content, language, filename);
    }
    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Exporting to Markdoc.live...',
        cancellable: false,
    }, async () => {
        const { url } = await postToMarkdoc(markdown);
        // Open browser directly to avoid URI encoding issues
        await openUrl(url);
        vscode.window.showInformationMessage(`Exported to ${url}`);
    });
}
/**
 * Export the current selection to markdoc.live
 */
async function exportSelectionToMarkdoc(editor) {
    const selection = editor.selection;
    const content = editor.document.getText(selection);
    if (!content.trim()) {
        throw new Error('Selection is empty');
    }
    const ext = path.extname(editor.document.fileName);
    const filename = path.basename(editor.document.fileName);
    // Prepare markdown content
    let markdown;
    if (isMarkdownFile(ext)) {
        // Export markdown selection as-is
        markdown = content;
    }
    else {
        // Wrap code selection in a code fence
        const language = getLanguage(ext);
        markdown = wrapInCodeFence(content, language, `${filename} (selection)`);
    }
    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Exporting selection to Markdoc.live...',
        cancellable: false,
    }, async () => {
        const { url } = await postToMarkdoc(markdown);
        // Open browser directly to avoid URI encoding issues
        await openUrl(url);
        vscode.window.showInformationMessage(`Exported selection to ${url}`);
    });
}
//# sourceMappingURL=exporter.js.map