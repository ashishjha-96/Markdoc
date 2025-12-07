import hljs from "highlight.js/lib/core";

// Import only the languages we support for detection
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import dart from "highlight.js/lib/languages/dart";
import scala from "highlight.js/lib/languages/scala";
import bash from "highlight.js/lib/languages/bash";
import powershell from "highlight.js/lib/languages/powershell";
import lua from "highlight.js/lib/languages/lua";
import perl from "highlight.js/lib/languages/perl";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import scss from "highlight.js/lib/languages/scss";
import less from "highlight.js/lib/languages/less";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import r from "highlight.js/lib/languages/r";
import julia from "highlight.js/lib/languages/julia";
import matlab from "highlight.js/lib/languages/matlab";
import haskell from "highlight.js/lib/languages/haskell";
import elixir from "highlight.js/lib/languages/elixir";
import erlang from "highlight.js/lib/languages/erlang";
import clojure from "highlight.js/lib/languages/clojure";
import fsharp from "highlight.js/lib/languages/fsharp";
import ocaml from "highlight.js/lib/languages/ocaml";
import latex from "highlight.js/lib/languages/latex";

// Register languages for detection
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("php", php);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("dart", dart);
hljs.registerLanguage("scala", scala);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("powershell", powershell);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("perl", perl);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("scss", scss);
hljs.registerLanguage("less", less);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("r", r);
hljs.registerLanguage("julia", julia);
hljs.registerLanguage("matlab", matlab);
hljs.registerLanguage("haskell", haskell);
hljs.registerLanguage("elixir", elixir);
hljs.registerLanguage("erlang", erlang);
hljs.registerLanguage("clojure", clojure);
hljs.registerLanguage("fsharp", fsharp);
hljs.registerLanguage("ocaml", ocaml);
hljs.registerLanguage("latex", latex);

/**
 * Map highlight.js language names to our supported language names
 * Some languages have different names in highlight.js vs shiki
 */
const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  dockerfile: "dockerfile",
  yml: "yaml",
  c: "c",
  "c++": "cpp",
  "objective-c": "c",
  cs: "csharp",
  fs: "fsharp",
  kt: "kotlin",
  rs: "rust",
  go: "go",
  jl: "julia",
  ml: "ocaml",
  tex: "latex",
  cls: "latex",
  sty: "latex",
};

/**
 * Detect the programming language from code content
 * Returns the detected language or null if confidence is too low
 * 
 * @param code - The code content to analyze
 * @param minConfidence - Minimum confidence threshold (0-1), default 0.5
 * @returns The detected language name or null
 */
export function detectLanguage(code: string, minConfidence = 0.5): string | null {
  // Skip detection for very short code snippets
  if (!code || code.trim().length < 10) {
    return null;
  }

  try {
    const result = hljs.highlightAuto(code);
    
    // Check if we have a language with sufficient confidence
    if (result.language && result.relevance > minConfidence * 10) {
      const detectedLang = result.language;
      
      // Map to our supported language name
      return LANGUAGE_MAP[detectedLang] || detectedLang;
    }
    
    return null;
  } catch (error) {
    console.error("Language detection error:", error);
    return null;
  }
}

/**
 * Detect language with fallback heuristics for common patterns
 * This provides better detection for edge cases
 */
export function detectLanguageWithHeuristics(code: string): string | null {
  const trimmedCode = code.trim();
  
  // Quick pattern-based detection for common cases
  if (trimmedCode.startsWith("<!DOCTYPE") || trimmedCode.startsWith("<html")) {
    return "html";
  }
  if (trimmedCode.startsWith("<?xml")) {
    return "xml";
  }
  if (trimmedCode.startsWith("FROM ") || /^FROM\s+\w+/.test(trimmedCode)) {
    return "dockerfile";
  }
  if (trimmedCode.startsWith("---") && trimmedCode.includes("\n")) {
    return "yaml";
  }
  if (/^(import|export|const|let|var|function)\s/.test(trimmedCode)) {
    // Could be JS/TS, let auto-detection handle it
    return detectLanguage(code, 0.3);
  }
  if (/^(def|class|import|from)\s/.test(trimmedCode)) {
    return "python";
  }
  if (/^(package|public class|private class)\s/.test(trimmedCode)) {
    return "java";
  }
  if (/^(defmodule|defp|def)\s/.test(trimmedCode)) {
    return "elixir";
  }
  if (/^#include\s*[<"]/.test(trimmedCode)) {
    return /\.cpp|\.hpp|::/.test(code) ? "cpp" : "c";
  }
  if (/^use\s+|fn\s+\w+/.test(trimmedCode)) {
    return "rust";
  }
  
  // Fall back to auto-detection
  return detectLanguage(code, 0.5);
}

