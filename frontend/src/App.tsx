/**
 * App Component
 *
 * Root component that extracts doc ID from URL and renders the Editor.
 */

import { Editor } from "./components/Editor";

function App() {
  // Extract doc ID from URL path
  // Examples: /welcome → "welcome", /meeting-notes → "meeting-notes", / → "welcome"
  const path = window.location.pathname;
  const docId = path.slice(1) || "welcome";

  return <Editor docId={docId} />;
}

export default App;
