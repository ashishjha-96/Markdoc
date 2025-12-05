/**
 * Custom keyboard shortcuts for the editor
 */
import { useEffect } from "react";
import type { BlockNoteEditor } from "@blocknote/core";

export function useKeyboardShortcuts(editor: BlockNoteEditor | null) {
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      // Cmd/Ctrl + D: Duplicate current block
      if (modKey && event.key === "d") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          const blockCopy = JSON.parse(JSON.stringify(currentBlock));
          editor.insertBlocks([blockCopy], currentBlock.id, "after");
        } catch (error) {
          console.error("Error duplicating block:", error);
        }
        return;
      }

      // Cmd/Ctrl + Shift + Up: Move block up
      if (modKey && event.shiftKey && event.key === "ArrowUp") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          const previousBlock = editor.getTextCursorPosition().prevBlock;

          if (previousBlock) {
            editor.removeBlocks([currentBlock]);
            editor.insertBlocks([currentBlock], previousBlock.id, "before");
          }
        } catch (error) {
          console.error("Error moving block up:", error);
        }
        return;
      }

      // Cmd/Ctrl + Shift + Down: Move block down
      if (modKey && event.shiftKey && event.key === "ArrowDown") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          const nextBlock = editor.getTextCursorPosition().nextBlock;

          if (nextBlock) {
            editor.removeBlocks([currentBlock]);
            editor.insertBlocks([currentBlock], nextBlock.id, "after");
          }
        } catch (error) {
          console.error("Error moving block down:", error);
        }
        return;
      }

      // Cmd/Ctrl + Shift + C: Copy block (copies the entire block content)
      if (modKey && event.shiftKey && event.key === "c") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          const blockText = JSON.stringify(currentBlock, null, 2);
          navigator.clipboard.writeText(blockText);
          console.log("📋 Block copied to clipboard");
        } catch (error) {
          console.error("Error copying block:", error);
        }
        return;
      }

      // Cmd/Ctrl + Alt + 1-6: Quick heading levels
      if (modKey && event.altKey && ["1", "2", "3", "4", "5", "6"].includes(event.key)) {
        event.preventDefault();
        try {
          const level = parseInt(event.key) as 1 | 2 | 3 | 4 | 5 | 6;
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, {
            type: "heading",
            props: { level },
          });
        } catch (error) {
          console.error("Error setting heading:", error);
        }
        return;
      }

      // Cmd/Ctrl + Alt + 0: Convert to paragraph
      if (modKey && event.altKey && event.key === "0") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, {
            type: "paragraph",
          });
        } catch (error) {
          console.error("Error converting to paragraph:", error);
        }
        return;
      }

      // Cmd/Ctrl + Shift + L: Convert to bullet list
      if (modKey && event.shiftKey && event.key === "L") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, {
            type: "bulletListItem",
          });
        } catch (error) {
          console.error("Error converting to bullet list:", error);
        }
        return;
      }

      // Cmd/Ctrl + Shift + N: Convert to numbered list
      if (modKey && event.shiftKey && event.key === "N") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, {
            type: "numberedListItem",
          });
        } catch (error) {
          console.error("Error converting to numbered list:", error);
        }
        return;
      }

      // Cmd/Ctrl + Shift + K: Convert to checkbox
      if (modKey && event.shiftKey && event.key === "K") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, {
            type: "checkListItem",
          });
        } catch (error) {
          console.error("Error converting to checkbox:", error);
        }
        return;
      }

      // Cmd/Ctrl + Shift + Q: Convert to quote
      if (modKey && event.shiftKey && event.key === "Q") {
        event.preventDefault();
        try {
          const currentBlock = editor.getTextCursorPosition().block;
          editor.updateBlock(currentBlock, {
            type: "paragraph",
          });
          // Note: BlockNote doesn't have a direct "quote" type in default specs
          // This converts to paragraph. If you have a custom quote block, update accordingly.
        } catch (error) {
          console.error("Error converting to quote:", error);
        }
        return;
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor]);
}
