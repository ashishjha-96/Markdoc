/**
 * MermaidCodeEditor Component
 *
 * Syntax-highlighted code editor for Mermaid diagrams.
 * Uses a textarea overlay technique for editable syntax highlighting.
 */

import { useRef, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../contexts/ThemeContext';

interface MermaidCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  height: number;
}

export function MermaidCodeEditor({
  value,
  onChange,
  onKeyDown,
  height,
}: MermaidCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mode } = useTheme();

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Sync scroll between textarea and highlighter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const pre = e.currentTarget.previousElementSibling as HTMLElement;
    if (pre) {
      pre.scrollTop = e.currentTarget.scrollTop;
      pre.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    height: `${height - 100}px`,
    fontFamily: 'Monaco, Menlo, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    overflow: 'hidden',
    borderRadius: '4px',
    border: '1px solid var(--chat-border)',
  };

  const highlighterStyle: React.CSSProperties = {
    margin: 0,
    padding: '12px',
    height: '100%',
    overflow: 'auto',
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  const textareaStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    padding: '12px',
    fontFamily: 'Monaco, Menlo, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: 'transparent',
    caretColor: mode === 'dark' ? '#fff' : '#000',
    resize: 'none',
    overflow: 'auto',
    whiteSpace: 'pre',
    wordWrap: 'normal',
  };

  return (
    <div style={containerStyle}>
      {/* Syntax-highlighted background */}
      <SyntaxHighlighter
        language="mermaid"
        style={mode === 'dark' ? oneDark : oneLight}
        customStyle={highlighterStyle}
        codeTagProps={{
          style: {
            fontFamily: 'Monaco, Menlo, "Courier New", monospace',
            fontSize: '13px',
            lineHeight: '1.5',
          },
        }}
      >
        {value || ' '}
      </SyntaxHighlighter>

      {/* Transparent textarea overlay */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Enter Mermaid diagram code..."
        style={textareaStyle}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
      />
    </div>
  );
}
