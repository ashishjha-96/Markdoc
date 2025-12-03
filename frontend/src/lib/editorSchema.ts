import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from "@blocknote/core";
import {
  createShikiHighlighter,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} from "./syntaxHighlighting";

/**
 * Custom BlockNote schema with syntax-highlighted code blocks.
 * Overrides only the codeBlock spec; all other blocks use defaults.
 */
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    // Include all default block specs
    ...defaultBlockSpecs,
    // Override the codeBlock spec with syntax highlighting
    codeBlock: createCodeBlockSpec({
      defaultLanguage: DEFAULT_LANGUAGE,
      supportedLanguages: SUPPORTED_LANGUAGES,
      createHighlighter: createShikiHighlighter,
    }),
  },
});

export type EditorSchema = typeof schema;
