/**
 * useMermaid Hook
 *
 * Manages Mermaid diagram data using Y.js for collaborative editing.
 * Stores diagram code in a shared Y.Text structure.
 */

import { useEffect, useState } from 'react';
import * as Y from 'yjs';

export interface UseMermaidReturn {
  yCode: Y.Text | null;
  isInitialized: boolean;
}

/**
 * Hook to manage Mermaid diagram data with Y.js
 * @param doc - Y.Doc instance for collaborative editing
 * @param diagramId - Unique ID for this Mermaid diagram
 */
export function useMermaid(doc: Y.Doc, diagramId: string): UseMermaidReturn {
  const [yCode, setYCode] = useState<Y.Text | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!doc || !diagramId) {
      return;
    }

    // Get or create Y.Map for this diagram
    const diagramsMap = doc.getMap('mermaidDiagrams');

    // Get or create Y.Text for diagram code
    let codeText = diagramsMap.get(diagramId) as Y.Text | undefined;

    if (!codeText) {
      codeText = new Y.Text();
      // Initialize with default Mermaid diagram
      codeText.insert(0, `graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]`);
      diagramsMap.set(diagramId, codeText);
    }

    setYCode(codeText);
    setIsInitialized(true);

    return () => {
      setYCode(null);
      setIsInitialized(false);
    };
  }, [doc, diagramId]);

  return {
    yCode,
    isInitialized,
  };
}
