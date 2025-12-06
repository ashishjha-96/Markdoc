/**
 * exportDocument.ts
 *
 * Utility functions for exporting documents in various formats.
 * Supports Markdown, HTML, and Plain Text exports.
 */

import type { BlockNoteEditor } from "@blocknote/core";
import type * as Y from "yjs";

/**
 * Generates a filename with document ID and timestamp
 * Format: markdoc-{docId}-{YYYYMMDD-HHMMSS}.{extension}
 * Example: markdoc-V1StGXR8_Z5j-20251203-143022.md
 */
export function generateFilename(docId: string, extension: string): string {
  const now = new Date();

  // Format: YYYYMMDD-HHMMSS
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;

  // Truncate docId if too long (keep first 12 chars)
  const shortDocId = docId.length > 12 ? docId.slice(0, 12) : docId;

  return `markdoc-${shortDocId}-${timestamp}.${extension}`;
}

/**
 * Downloads content as a file using Blob API
 * Creates temporary anchor element for download
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  // Create blob from content
  const blob = new Blob([content], { type: mimeType });

  // Create object URL
  const url = URL.createObjectURL(blob);

  // Create temporary anchor element
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  // Append to body, click, and remove
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up object URL
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Exports document to Markdown format
 * Uses editor.blocksToMarkdownLossy() with custom Mermaid block handling
 */
export async function exportToMarkdown(
  editor: BlockNoteEditor,
  docId: string,
  yDoc?: Y.Doc
): Promise<void> {
  try {
    // Get current document blocks
    const blocks = editor.document;

    // Convert to markdown using BlockNote's built-in method
    let markdown = await editor.blocksToMarkdownLossy(blocks);

    // Post-process to add Mermaid code blocks
    if (yDoc) {
      const mermaidDiagrams = yDoc.getMap('mermaidDiagrams');

      blocks.forEach((block: any) => {
        if (block.type === 'mermaid' && block.props?.diagramId) {
          const diagramId = block.props.diagramId;
          const yCode = mermaidDiagrams.get(diagramId) as Y.Text;

          if (yCode) {
            const code = yCode.toString();
            const title = block.props.title || 'Mermaid Diagram';

            // Create a Mermaid code block in markdown
            const mermaidBlock = `\n\n### ${title}\n\n\`\`\`mermaid\n${code}\n\`\`\`\n\n`;
            markdown += mermaidBlock;
          }
        }
      });
    }

    // Generate filename
    const filename = generateFilename(docId, "md");

    // Download file
    downloadFile(markdown, filename, "text/markdown");

    console.log("✅ Exported to Markdown:", filename);
  } catch (error) {
    console.error("❌ Failed to export to Markdown:", error);
  }
}

/**
 * Exports document to HTML format
 * Uses editor.blocksToFullHTML() for complete HTML with styles
 */
export async function exportToHTML(
  editor: BlockNoteEditor,
  docId: string
): Promise<void> {
  try {
    const blocks = editor.document;

    // Use blocksToFullHTML for complete HTML with styles
    const html = await editor.blocksToFullHTML(blocks);

    // Wrap in complete HTML document structure
    const completeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdoc Export - ${docId}</title>
  <style>
    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #1a1a1a;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;

    const filename = generateFilename(docId, "html");
    downloadFile(completeHTML, filename, "text/html");

    console.log("✅ Exported to HTML:", filename);
  } catch (error) {
    console.error("❌ Failed to export to HTML:", error);
  }
}

/**
 * Helper function to recursively extract text from block structure
 */
function extractTextFromBlock(block: any): string {
  let text = "";

  // Handle Mermaid blocks specially - export the code
  if (block.type === "mermaid") {
    // Access the Y.js doc to get the actual Mermaid code
    // Note: This requires access to the Y.Doc, so we'll handle it in markdown export
    return ""; // Will be handled in the markdown export function
  }

  // Handle block content (array of inline content)
  if (block.content && Array.isArray(block.content)) {
    text = block.content.map((item: any) => item.text || "").join("");
  }

  // Handle nested children blocks
  if (block.children && Array.isArray(block.children)) {
    const childrenText = block.children.map(extractTextFromBlock).join("\n");
    text += (text ? "\n" : "") + childrenText;
  }

  return text;
}

/**
 * Exports document to plain text format
 * Extracts text from block structure recursively
 */
export async function exportToPlainText(
  editor: BlockNoteEditor,
  docId: string
): Promise<void> {
  try {
    const blocks = editor.document;

    // Extract plain text from blocks
    const plainText = blocks
      .map((block) => extractTextFromBlock(block))
      .filter((text) => text.trim().length > 0)
      .join("\n\n");

    const filename = generateFilename(docId, "txt");
    downloadFile(plainText, filename, "text/plain");

    console.log("✅ Exported to Plain Text:", filename);
  } catch (error) {
    console.error("❌ Failed to export to Plain Text:", error);
  }
}
