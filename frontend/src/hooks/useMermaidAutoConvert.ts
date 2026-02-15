import { useEffect } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { nanoid } from "nanoid";
import * as Y from "yjs";

/**
 * Known Mermaid diagram type keywords.
 * Used for content-based detection when language isn't explicitly "mermaid".
 */
const MERMAID_KEYWORDS = [
  "graph",
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "pie",
  "gitgraph",
  "journey",
  "mindmap",
  "timeline",
  "quadrantChart",
  "xychart-beta",
  "block-beta",
  "sankey-beta",
  "packet-beta",
];

const MERMAID_START_REGEX = new RegExp(
  `^\\s*(${MERMAID_KEYWORDS.join("|")})\\b`,
  "m"
);

/**
 * Hook to auto-convert code blocks with mermaid content into Mermaid diagram blocks.
 * Detects mermaid by:
 *   1. Code block language explicitly set to "mermaid"
 *   2. Code block content starting with a known mermaid diagram keyword
 */
export function useMermaidAutoConvert(
  editor: BlockNoteEditor<any, any, any> | null,
  doc: Y.Doc
) {
  useEffect(() => {
    if (!editor) return;

    // Track blocks we've already converted to prevent re-processing
    const convertedBlocks = new Set<string>();

    const handleChange = () => {
      try {
        const blocks = editor.document;

        for (const block of blocks) {
          if (block.type !== "codeBlock") continue;
          if (convertedBlocks.has(block.id)) continue;

          const language = (block as any).props?.language || "";
          const codeContent = Array.isArray(block.content)
            ? block.content
                .map((item: any) => item.text || "")
                .join("\n")
            : "";

          if (!codeContent.trim()) continue;

          // Check if this is mermaid content
          const isMermaid =
            language === "mermaid" ||
            ((!language || language === "text") &&
              MERMAID_START_REGEX.test(codeContent));

          if (!isMermaid) continue;

          // Mark as converted before modifying to prevent re-entry
          convertedBlocks.add(block.id);

          const diagramId = nanoid();

          // Store the mermaid code in Y.js
          const diagramsMap = doc.getMap("mermaidDiagrams");
          const codeText = new Y.Text();
          codeText.insert(0, codeContent);
          diagramsMap.set(diagramId, codeText);

          // Replace the code block with a mermaid diagram block
          editor.replaceBlocks(
            [block.id],
            [
              {
                type: "mermaid" as any,
                props: {
                  diagramId,
                  title: "Mermaid Diagram",
                  height: 400,
                  width: 600,
                },
              },
            ]
          );
        }
      } catch (error) {
        console.debug("Mermaid auto-convert error:", error);
      }
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedHandler = () => {
      clearTimeout(timeoutId);
      // Use shorter debounce than code auto-detect (500ms) so we run first
      timeoutId = setTimeout(handleChange, 200);
    };

    const unsubscribe = editor.onChange(debouncedHandler);

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [editor, doc]);
}
