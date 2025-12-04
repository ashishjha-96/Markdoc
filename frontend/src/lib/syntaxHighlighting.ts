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
  text: { name: "Text", aliases: ["txt"]}
};

export const DEFAULT_LANGUAGE = "text";

// Theme names for dark and light modes
export const THEMES = {
  light: "github-light",
  dark: "github-dark",
} as const;

// Global variable to track current theme mode
let currentThemeMode: "light" | "dark" = "light";

/**
 * Set the current theme mode (called from React components)
 */
export function setThemeMode(mode: "light" | "dark") {
  currentThemeMode = mode;
  console.log(`🎨 Theme mode changed to: ${mode}`);
}

/**
 * Get the current theme name based on mode
 */
function getCurrentTheme(): string {
  return THEMES[currentThemeMode];
}

/**
 * Creates Shiki highlighter instance.
 * Called lazily by BlockNote on first code block creation.
 * Loads BOTH light and dark themes for switching.
 */
export async function createShikiHighlighter() {
  console.log(`🎨 Creating Shiki highlighter with both themes:`, THEMES);

  const highlighter = await createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: Object.keys(SUPPORTED_LANGUAGES),
  });

  console.log(`✅ Shiki highlighter created successfully with both themes`);

  // Wrap the highlighter to dynamically use current theme
  const wrappedHighlighter = {
    ...highlighter,
    codeToHtml: (code: string, options: any) => {
      const theme = getCurrentTheme();
      return highlighter.codeToHtml(code, {
        ...options,
        theme,
      });
    },
    codeToTokens: (code: string, options: any) => {
      const theme = getCurrentTheme();
      return highlighter.codeToTokens(code, {
        ...options,
        theme,
      });
    },
    codeToHast: (code: string, options: any) => {
      const theme = getCurrentTheme();
      return highlighter.codeToHast(code, {
        ...options,
        theme,
      });
    },
  };

  return wrappedHighlighter as any;
}
