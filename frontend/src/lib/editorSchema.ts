import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { createElement } from "react";
import {
  createShikiHighlighter,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} from "./syntaxHighlighting";
import { ChatBlock } from "../components/chat/ChatBlock";
import { MermaidBlock } from "../components/mermaid/MermaidBlock";
import { EmbedBlock } from "../components/embed/EmbedBlock";

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

// Mermaid block specification
const mermaidBlockSpec = createReactBlockSpec(
  {
    type: "mermaid" as const,
    propSchema: {
      diagramId: {
        default: "",
      },
      title: {
        default: "Mermaid Diagram",
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
      return createElement(MermaidBlock, { block: props.block });
    },
  }
);

// Embed block specification (YouTube, Vimeo, Spotify, Twitch, etc.)
const embedBlockSpec = createReactBlockSpec(
  {
    type: "embed" as const,
    propSchema: {
      url: {
        default: "",
      },
      width: {
        default: 640, // Default width in pixels
      },
      height: {
        default: 360, // Default height in pixels
      },
      caption: {
        default: "",
      },
    },
    content: "none" as const,
  },
  {
    render: (props) => {
      return createElement(EmbedBlock, { block: props.block });
    },
  }
);

/**
 * Custom BlockNote schema with syntax-highlighted code blocks, chat blocks, mermaid blocks, and embed blocks.
 * Overrides the codeBlock spec and adds custom blocks for chat, mermaid diagrams, and media embeds.
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
    // Add custom mermaid block
    mermaid: mermaidBlockSpec(),
    // Add custom embed block (YouTube, Vimeo, Spotify, etc.)
    embed: embedBlockSpec(),
  },
});

export type EditorSchema = typeof schema;
