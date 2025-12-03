import { createHighlighter } from "shiki";

/**
 * Supported programming languages for syntax highlighting.
 * Core set optimized for common use cases and bundle size.
 */
export const SUPPORTED_LANGUAGES: Record<string, { name: string; aliases?: string[] }> = {
  // Web Development
  javascript: { name: "JavaScript", aliases: ["js"] },
  typescript: { name: "TypeScript", aliases: ["ts"] },
  html: { name: "HTML", aliases: ["htm"] },
  css: { name: "CSS" },
  json: { name: "JSON" },

  // Backend Languages
  python: { name: "Python", aliases: ["py"] },
  java: { name: "Java" },
  go: { name: "Go", aliases: ["golang"] },
  rust: { name: "Rust", aliases: ["rs"] },
  php: { name: "PHP" },

  // Other
  bash: { name: "Bash", aliases: ["sh", "shell", "zsh"] },
  yaml: { name: "YAML", aliases: ["yml"] },
  sql: { name: "SQL" },
  markdown: { name: "Markdown", aliases: ["md"] },
  haskell: { name: "Haskell", aliases: ["hs"] },
};

export const DEFAULT_LANGUAGE = "text";
export const THEME = "github-dark-dimmed";

/**
 * Creates Shiki highlighter instance.
 * Called lazily by BlockNote on first code block creation.
 */
export async function createShikiHighlighter() {
  const highlighter = await createHighlighter({
    themes: [THEME],
    langs: Object.keys(SUPPORTED_LANGUAGES),
  });

  return highlighter as any;
}
