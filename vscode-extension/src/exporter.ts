/**
 * Exporter Module
 *
 * Handles exporting files and selections to markdoc.live.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';

// Language mappings for code fence syntax highlighting
const LANGUAGE_MAP: Record<string, string> = {
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
function getLanguage(ext: string): string {
  return LANGUAGE_MAP[ext.toLowerCase()] || 'text';
}

/**
 * Check if a file is a markdown file
 */
function isMarkdownFile(ext: string): boolean {
  return MARKDOWN_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Wrap code content in a markdown code fence
 */
function wrapInCodeFence(content: string, language: string, filename?: string): string {
  const header = filename ? `> File: \`${filename}\`\n\n` : '';
  return `${header}\`\`\`${language}\n${content}\n\`\`\`\n`;
}

/**
 * Get the server URL from configuration
 */
function getServerUrl(): string {
  const config = vscode.workspace.getConfiguration('markdoc');
  return config.get<string>('serverUrl') || 'https://markdoc.live';
}

/**
 * Open URL in default browser without encoding issues
 */
function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

    exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

interface ImportResponse {
  doc_id: string;
  url: string;
}

interface ErrorResponse {
  error?: string;
}

/**
 * POST markdown to the Markdoc API and get back the doc URL
 */
async function postToMarkdoc(markdown: string): Promise<{ docId: string; url: string }> {
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
    const errorData = (await response.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(errorData.error || `Server returned ${response.status}`);
  }

  const data = (await response.json()) as ImportResponse;
  return { docId: data.doc_id, url: data.url };
}

/**
 * Export a file to markdoc.live
 */
export async function exportToMarkdoc(fileUri: vscode.Uri): Promise<void> {
  // Read the file content
  const fileContent = await vscode.workspace.fs.readFile(fileUri);
  const content = new TextDecoder().decode(fileContent);

  const ext = path.extname(fileUri.fsPath);
  const filename = path.basename(fileUri.fsPath);

  // Prepare markdown content
  let markdown: string;
  if (isMarkdownFile(ext)) {
    // Export markdown files as-is
    markdown = content;
  } else {
    // Wrap code files in a code fence
    const language = getLanguage(ext);
    markdown = wrapInCodeFence(content, language, filename);
  }

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Exporting to Markdoc.live...',
      cancellable: false,
    },
    async () => {
      const { url } = await postToMarkdoc(markdown);

      // Open browser directly to avoid URI encoding issues
      await openUrl(url);

      vscode.window.showInformationMessage(`Exported to ${url}`);
    }
  );
}

/**
 * Export the current selection to markdoc.live
 */
export async function exportSelectionToMarkdoc(editor: vscode.TextEditor): Promise<void> {
  const selection = editor.selection;
  const content = editor.document.getText(selection);

  if (!content.trim()) {
    throw new Error('Selection is empty');
  }

  const ext = path.extname(editor.document.fileName);
  const filename = path.basename(editor.document.fileName);

  // Prepare markdown content
  let markdown: string;
  if (isMarkdownFile(ext)) {
    // Export markdown selection as-is
    markdown = content;
  } else {
    // Wrap code selection in a code fence
    const language = getLanguage(ext);
    markdown = wrapInCodeFence(content, language, `${filename} (selection)`);
  }

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Exporting selection to Markdoc.live...',
      cancellable: false,
    },
    async () => {
      const { url } = await postToMarkdoc(markdown);

      // Open browser directly to avoid URI encoding issues
      await openUrl(url);

      vscode.window.showInformationMessage(`Exported selection to ${url}`);
    }
  );
}
