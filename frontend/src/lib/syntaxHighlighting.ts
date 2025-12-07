import { createHighlighter } from "shiki";

/**
 * Supported programming languages for syntax highlighting.
 * Core set optimized for common use cases and bundle size.
 */
export const SUPPORTED_LANGUAGES: Record<string, { name: string; aliases?: string[] }> = {
  // Web Development - Core
  javascript: { name: "JavaScript", aliases: ["js"] },
  typescript: { name: "TypeScript", aliases: ["ts"] },
  jsx: { name: "JSX" },
  tsx: { name: "TSX" },
  html: { name: "HTML", aliases: ["htm"] },
  css: { name: "CSS" },
  scss: { name: "SCSS", aliases: ["sass"] },
  less: { name: "Less" },
  json: { name: "JSON" },
  xml: { name: "XML" },
  
  // Web Frameworks
  vue: { name: "Vue" },
  svelte: { name: "Svelte" },
  
  // Backend Languages - Popular
  python: { name: "Python", aliases: ["py"] },
  java: { name: "Java" },
  go: { name: "Go", aliases: ["golang"] },
  rust: { name: "Rust", aliases: ["rs"] },
  php: { name: "PHP" },
  ruby: { name: "Ruby", aliases: ["rb"] },
  elixir: { name: "Elixir", aliases: ["ex", "exs"] },
  
  // Systems Programming
  c: { name: "C" },
  cpp: { name: "C++", aliases: ["c++", "cxx"] },
  csharp: { name: "C#", aliases: ["cs"] },
  
  // Mobile Development
  swift: { name: "Swift" },
  kotlin: { name: "Kotlin", aliases: ["kt"] },
  dart: { name: "Dart" },
  
  // Functional Languages
  haskell: { name: "Haskell", aliases: ["hs"] },
  scala: { name: "Scala" },
  clojure: { name: "Clojure", aliases: ["clj"] },
  ocaml: { name: "OCaml", aliases: ["ml"] },
  fsharp: { name: "F#", aliases: ["fs"] },
  elm: { name: "Elm" },
  erlang: { name: "Erlang", aliases: ["erl"] },
  
  // Scripting & Shell
  bash: { name: "Bash", aliases: ["sh", "shell", "zsh"] },
  powershell: { name: "PowerShell", aliases: ["ps1", "pwsh"] },
  lua: { name: "Lua" },
  perl: { name: "Perl", aliases: ["pl"] },
  
  // Configuration & Data
  yaml: { name: "YAML", aliases: ["yml"] },
  toml: { name: "TOML" },
  ini: { name: "INI" },
  dockerfile: { name: "Dockerfile", aliases: ["docker"] },
  
  // Query Languages
  sql: { name: "SQL" },
  graphql: { name: "GraphQL", aliases: ["gql"] },
  
  // Markup & Documentation
  markdown: { name: "Markdown", aliases: ["md"] },
  latex: { name: "LaTeX", aliases: ["tex"] },
  
  // Data Science & Math
  r: { name: "R" },
  julia: { name: "Julia", aliases: ["jl"] },
  matlab: { name: "MATLAB" },
  
  // Other
  diff: { name: "Diff", aliases: ["patch"] },
  regex: { name: "Regex", aliases: ["regexp"] },
  text: { name: "Text", aliases: ["txt", "plaintext"] }
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
  const highlighter = await createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: Object.keys(SUPPORTED_LANGUAGES),
  });

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
