/**
 * MermaidCanvas Component
 *
 * Renders Mermaid diagrams using the Mermaid library.
 * Handles diagram rendering, error display, and theme integration.
 */

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../../contexts/ThemeContext';

interface MermaidCanvasProps {
  diagramId: string;
  code: string;
  height: number;
}

export function MermaidCanvas({ diagramId, code, height }: MermaidCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isMermaidReady, setIsMermaidReady] = useState(false);
  const [svgContent, setSvgContent] = useState<string>('');
  const { mode } = useTheme();

  // Initialize Mermaid on mount
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: mode === 'dark' ? 'dark' : 'base',
        securityLevel: 'loose',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        logLevel: 'error',
      });
      setIsMermaidReady(true);
      console.log('✅ Mermaid initialized successfully');
    } catch (err) {
      console.error('❌ Failed to initialize Mermaid:', err);
      setError('Failed to initialize Mermaid library');
    }
  }, [mode]);

  useEffect(() => {
    if (!code.trim() || !isMermaidReady) {
      return;
    }

    const renderDiagram = async () => {
      setIsRendering(true);
      setError(null);

      try {
        // Generate unique ID for this render
        const renderKey = `mermaid-${diagramId}-${Date.now()}`;

        console.log('🎨 Rendering Mermaid diagram:', { renderKey, codeLength: code.length });

        // Render the diagram first (this creates the SVG string)
        const result = await mermaid.render(renderKey, code);

        console.log('📦 Mermaid render result:', {
          hasSvg: !!result.svg,
          svgLength: result.svg?.length,
          svgPreview: result.svg?.substring(0, 100)
        });

        // Store SVG in state to trigger re-render
        if (result.svg) {
          setSvgContent(result.svg);
          console.log('✅ Mermaid SVG stored in state');
        } else {
          console.warn('⚠️ No SVG in result');
        }
      } catch (err) {
        console.error('❌ Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [code, diagramId, isMermaidReady]);

  // Insert SVG into DOM when svgContent changes
  useEffect(() => {
    if (containerRef.current && svgContent) {
      containerRef.current.innerHTML = svgContent;
      console.log('🎯 SVG inserted into DOM');

      // Verify insertion
      const svgElement = containerRef.current.querySelector('svg');
      console.log('🔍 SVG element check:', {
        found: !!svgElement,
        width: svgElement?.getAttribute('width'),
        height: svgElement?.getAttribute('height'),
        viewBox: svgElement?.getAttribute('viewBox')
      });
    }
  }, [svgContent]);

  if (error) {
    return (
      <div
        style={{
          padding: '24px',
          minHeight: `${height - 100}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--chat-bg)',
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            maxWidth: '600px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
            ⚠️ Diagram Error
          </div>
          <div style={{ fontSize: '13px', fontFamily: 'Monaco, monospace' }}>
            {error}
          </div>
        </div>
        <div
          style={{
            marginTop: '16px',
            fontSize: '12px',
            color: 'var(--chat-text-tertiary)',
          }}
        >
          Click "Edit" to fix your Mermaid syntax
        </div>
      </div>
    );
  }

  if (isRendering) {
    return (
      <div
        style={{
          padding: '24px',
          minHeight: `${height - 100}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--chat-bg)',
          color: 'var(--chat-text-tertiary)',
        }}
      >
        Rendering diagram...
      </div>
    );
  }

  if (!code.trim()) {
    return (
      <div
        style={{
          padding: '24px',
          minHeight: `${height - 100}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--chat-bg)',
          color: 'var(--chat-text-tertiary)',
          fontSize: '13px',
        }}
      >
        No diagram code. Click "Edit" to add Mermaid syntax.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        padding: '24px',
        minHeight: `${height - 100}px`,
        backgroundColor: 'var(--chat-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
      // Add CSS to ensure SVG is visible
      className="mermaid-container"
    />
  );
}

// Add global styles for Mermaid SVG
const style = document.createElement('style');
style.textContent = `
  .mermaid-container svg {
    max-width: 100%;
    height: auto;
  }
`;
if (typeof document !== 'undefined' && !document.querySelector('style[data-mermaid-styles]')) {
  style.setAttribute('data-mermaid-styles', 'true');
  document.head.appendChild(style);
}
