import { useState, useEffect, useCallback } from "react";
import type { BlockNoteEditor, Block } from "@blocknote/core";

export interface HeadingNode {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: HeadingNode[];
  isCollapsed: boolean;
}

function extractHeadingText(block: Block<any, any, any>): string {
  if (!block.content || !Array.isArray(block.content)) return "";

  return block.content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        return item.text;
      }
      return "";
    })
    .join(" ")
    .trim();
}

function buildHeadingHierarchy(
  flatHeadings: Array<{ id: string; text: string; level: number }>,
  collapsedIds: Set<string>
): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  flatHeadings.forEach((heading) => {
    const node: HeadingNode = {
      id: heading.id,
      text: heading.text,
      level: heading.level as 1 | 2 | 3 | 4 | 5 | 6,
      children: [],
      isCollapsed: collapsedIds.has(heading.id),
    };

    // Pop stack until we find parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    // Add to parent's children or root
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return root;
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel?: () => void } {
  let timeout: number | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };

  return debounced as T & { cancel?: () => void };
}

export function useTableOfContents(
  editor: BlockNoteEditor<any, any, any> | null
): {
  headings: HeadingNode[];
  hasHeadings: boolean;
  toggleCollapse: (id: string) => void;
} {
  const [headings, setHeadings] = useState<HeadingNode[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }

    const extractHeadings = () => {
      const flatHeadings: Array<{ id: string; text: string; level: number }> =
        [];

      editor.document.forEach((block) => {
        if (block.type === "heading") {
          const text = extractHeadingText(block);
          const level = (block.props as any).level || 1;

          if (text) {
            flatHeadings.push({ id: block.id, text, level });
          }
        }
      });

      const hierarchy = buildHeadingHierarchy(flatHeadings, collapsedIds);
      setHeadings(hierarchy);

      // Clean up stale collapsed IDs
      setCollapsedIds((prev) => {
        const validIds = new Set(flatHeadings.map((h) => h.id));
        const cleaned = new Set(
          Array.from(prev).filter((id) => validIds.has(id))
        );
        return cleaned.size !== prev.size ? cleaned : prev;
      });
    };

    const debouncedExtract = debounce(extractHeadings, 300);

    // Subscribe to document changes
    const unsubscribe = editor.onChange(debouncedExtract);

    // Initial extraction
    extractHeadings();

    return () => {
      debouncedExtract.cancel?.();
      unsubscribe?.();
    };
  }, [editor, collapsedIds]);

  const hasHeadings = headings.length > 0;

  return { headings, hasHeadings, toggleCollapse };
}
