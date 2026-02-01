/**
 * App Component
 *
 * Root component that extracts doc ID from URL and renders the Editor.
 * Validates doc ID format and redirects invalid IDs to landing page.
 */

import { useEffect } from "react";
import { Editor } from "./components/Editor";
import { Landing } from "./components/Landing";
import { initImportBridge } from "./lib/importBridge";
import { isValidDocId } from "./lib/generateDocId";

function App() {
  // Initialize import bridge on mount
  useEffect(() => {
    initImportBridge();
  }, []);

  // Extract doc ID from URL path
  const path = window.location.pathname;
  const docId = path.slice(1);

  // Show landing page if no document ID
  if (!docId) {
    return <Landing />;
  }

  // Validate doc ID format - must be a valid nanoid (21 chars, A-Za-z0-9_-)
  // Invalid IDs redirect to root to prevent accidental doc creation
  if (!isValidDocId(docId)) {
    window.location.href = "/";
    return null;
  }

  return <Editor docId={docId} />;
}

export default App;
