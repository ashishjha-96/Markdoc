import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { createElement } from "react";
import {
  createShikiHighlighter,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} from "./syntaxHighlighting";
import { ChatBlock } from "../components/chat/ChatBlock";

// Chat block specification
const chatBlockSpec = createReactBlockSpec(
  {
    type: "chat" as const,
    propSchema: {
      chatId: {
        default: "",
      },
      title: {
        default: "Chat Discussion",
      },
      minimized: {
        default: false,
      },
      height: {
        default: 400, // Default height in pixels
      },
      width: {
        default: 600, // Default width in pixels
      },
    },
    content: "none" as const,
  },
  {
    render: (props) => {
      return createElement(ChatBlock, { block: props.block });
    },
  }
);

/**
 * Custom BlockNote schema with syntax-highlighted code blocks and chat blocks.
 * Overrides the codeBlock spec and adds a custom chat block.
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
    // Add custom chat block
    chat: chatBlockSpec(),
  },
});

export type EditorSchema = typeof schema;
