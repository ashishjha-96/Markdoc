/**
 * App Component
 *
 * Root component that extracts doc ID from URL and renders the Editor.
 */

import { Editor } from "./components/Editor";
import { Landing } from "./components/Landing";

function App() {
  // Extract doc ID from URL path
  // Examples: /abc123 → "abc123", /meeting-notes → "meeting-notes"
  const path = window.location.pathname;
  const docId = path.slice(1);

  // Show landing page if no document ID
  if (!docId) {
    return <Landing />;
  }

  return <Editor docId={docId} />;
}

export default App;
