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
  const { mode } = useTheme();

  useEffect(() => {
    // Initialize Mermaid with theme
    mermaid.initialize({
      startOnLoad: false,
      theme: mode === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    });
  }, [mode]);

  useEffect(() => {
    if (!containerRef.current || !code.trim()) {
      return;
    }

    const renderDiagram = async () => {
      setIsRendering(true);
      setError(null);

      try {
        // Clear previous content
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Generate unique ID for this render
        const renderKey = `mermaid-${diagramId}-${Date.now()}`;

        // Render the diagram
        const { svg } = await mermaid.render(renderKey, code);

        // Insert the SVG
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [code, diagramId, mode]);

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
    />
  );
}
