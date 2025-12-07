import { useEffect } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { detectLanguageWithHeuristics } from "../lib/languageDetector";

/**
 * Hook to automatically detect and set language for code blocks
 * Triggers when code content changes in a code block
 */
export function useCodeBlockAutoDetect(editor: BlockNoteEditor<any, any, any> | null) {
  useEffect(() => {
    if (!editor) return;

    // Track the last detected language for each block to avoid redundant updates
    const blockLanguages = new Map<string, string>();

    const handleTextChange = () => {
      try {
        const blocks = editor.document;

        for (const block of blocks) {
          // Only process code blocks
          if (block.type !== "codeBlock") continue;

          // Skip if language is already set and not "text"
          const currentLang = (block as any).props?.language || "text";
          if (currentLang !== "text" && currentLang !== "") {
            continue;
          }

          // Get the code content
          const codeContent = Array.isArray(block.content)
            ? block.content.map((item: any) => item.text || "").join("\n")
            : "";

          // Skip very short content
          if (codeContent.trim().length < 15) {
            continue;
          }

          // Check if we've already processed this content
          const lastLang = blockLanguages.get(block.id);
          if (lastLang) {
            continue;
          }

          // Detect language
          const detectedLang = detectLanguageWithHeuristics(codeContent);

          if (detectedLang && detectedLang !== "text") {
            // Update the block's language property
            editor.updateBlock(block.id, {
              type: "codeBlock",
              props: {
                language: detectedLang,
              },
            });

            // Remember we've set this language
            blockLanguages.set(block.id, detectedLang);
          }
        }
      } catch (error) {
        // Silently fail to avoid disrupting user experience
        console.debug("Auto-detection error:", error);
      }
    };

    // Listen for editor changes with debouncing
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedHandler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleTextChange, 500); // Wait 500ms after typing stops
    };

    // Subscribe to editor changes
    const unsubscribe = editor.onChange(debouncedHandler);

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [editor]);
}

