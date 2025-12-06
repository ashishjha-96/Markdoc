/**
 * MermaidBlock Component
 *
 * A BlockNote block for creating Mermaid flowcharts and diagrams.
 * Features:
 * - Edit mode: Text editor for Mermaid code
 * - Render mode: Visual diagram preview
 * - Toggle button to switch between modes
 * - Y.js integration for collaborative editing
 */

import React, { useState, useContext, useRef, useCallback, useEffect } from 'react';
import { EditorContext } from '../chat/ChatBlock';
import { useBlockNoteEditor } from '@blocknote/react';
import { useMermaid } from '../../hooks/useMermaid';
import { MermaidCanvas } from './MermaidCanvas';
import { MermaidCodeEditor } from './MermaidCodeEditor';
import { loadMinimizedState, saveMinimizedState } from '../../lib/floatingChats';

interface MermaidBlockProps {
  block: {
    id: string;
    type: string;
    props: {
      diagramId: string;
      title: string;
      height: number;
      width: number;
    };
  };
}

export function MermaidBlock({ block }: MermaidBlockProps) {
  const context = useContext(EditorContext);
  const editor = useBlockNoteEditor();
  const diagramId = block.props.diagramId;

  // Load minimized state from localStorage (local to each user)
  const [isMinimized, setIsMinimized] = useState(() => loadMinimizedState(diagramId));
  const [isEditMode, setIsEditMode] = useState(true); // Start in edit mode for new blocks
  const [height, setHeight] = useState(block.props.height || 400);
  const [width, setWidth] = useState(block.props.width || 600);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(block.props.title || 'Mermaid Diagram');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const resizeStartY = useRef(0);
  const resizeStartX = useRef(0);
  const resizeStartHeight = useRef(0);
  const resizeStartWidth = useRef(0);

  if (!context) {
    return (
      <div
        style={{
          padding: '16px',
          border: '1px solid var(--chat-border)',
          borderRadius: '8px',
          backgroundColor: 'var(--chat-header-bg)',
          color: 'var(--chat-text-secondary)',
        }}
      >
        Mermaid block error: Editor context not available
      </div>
    );
  }

  const { doc } = context;

  const { yCode, isInitialized } = useMermaid(doc, diagramId);

  // Local state for the code to avoid Y.js update issues
  const [localCode, setLocalCode] = useState('');

  // Sync Y.Text to local state on mount and when yCode changes
  useEffect(() => {
    if (!yCode) return;

    const updateLocalCode = () => {
      setLocalCode(yCode.toString());
    };

    // Initial sync
    updateLocalCode();

    // Listen for remote changes
    yCode.observe(updateLocalCode);

    return () => {
      yCode.unobserve(updateLocalCode);
    };
  }, [yCode]);


  // Prevent BlockNote from handling keyboard events in the textarea
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop event from bubbling to BlockNote editor
    e.stopPropagation();
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartX.current = e.clientX;
    resizeStartHeight.current = height;
    resizeStartWidth.current = width;
  }, [height, width]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaY = e.clientY - resizeStartY.current;
    const deltaX = e.clientX - resizeStartX.current;

    const newHeight = Math.max(200, Math.min(800, resizeStartHeight.current + deltaY));
    const newWidth = Math.max(300, Math.min(1200, resizeStartWidth.current + deltaX));

    setHeight(newHeight);
    setWidth(newWidth);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);

    if (editor) {
      editor.updateBlock(block.id, {
        props: { ...block.props, height, width },
      });
    }
  }, [isResizing, editor, block.id, block.props, height, width]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Title editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = useCallback(() => {
    if (!editor) return;

    const trimmedTitle = editedTitle.trim();
    const finalTitle = trimmedTitle || 'Mermaid Diagram';

    if (finalTitle !== block.props.title) {
      editor.updateBlock(block.id, {
        props: { ...block.props, title: finalTitle },
      });
    }

    setEditedTitle(finalTitle);
    setIsEditingTitle(false);
  }, [editor, block.id, block.props, editedTitle]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(block.props.title || 'Mermaid Diagram');
      setIsEditingTitle(false);
    }
  }, [handleTitleSave, block.props.title]);

  if (!diagramId) {
    return (
      <div
        style={{
          padding: '16px',
          border: '1px solid var(--chat-border)',
          borderRadius: '8px',
          backgroundColor: 'var(--chat-header-bg)',
          color: 'var(--chat-text-secondary)',
        }}
      >
        Initializing Mermaid diagram...
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--chat-border)',
        borderRadius: '12px',
        backgroundColor: 'var(--chat-bg)',
        marginTop: '12px',
        marginBottom: '12px',
        overflow: 'hidden',
        width: `${width}px`,
        position: 'relative',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
      contentEditable={false}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid var(--chat-border)',
          backgroundColor: 'var(--chat-header-bg)',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              style={{
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--chat-text)',
                backgroundColor: 'var(--chat-btn-bg)',
                border: '1px solid #646cff',
                borderRadius: '4px',
                padding: '2px 6px',
                outline: 'none',
                minWidth: '150px',
              }}
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              style={{
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--chat-text)',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--chat-btn-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Click to edit title"
            >
              {block.props.title || 'Mermaid Diagram'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Toggle Edit/Render button */}
          {!isMinimized && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              style={{
                padding: '4px 12px',
                border: '1px solid var(--chat-border)',
                borderRadius: '4px',
                backgroundColor: isEditMode ? '#646cff' : 'var(--chat-btn-bg)',
                color: isEditMode ? 'white' : 'var(--chat-text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isEditMode) {
                  e.currentTarget.style.backgroundColor = 'var(--chat-btn-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isEditMode) {
                  e.currentTarget.style.backgroundColor = 'var(--chat-btn-bg)';
                }
              }}
              title={isEditMode ? 'Render diagram' : 'Edit code'}
            >
              {isEditMode ? '👁️ Render' : '✏️ Edit'}
            </button>
          )}

          {/* Minimize button */}
          <button
            onClick={() => {
              const newMinimizedState = !isMinimized;
              setIsMinimized(newMinimizedState);

              // Persist minimized state to localStorage (local, not synced)
              saveMinimizedState(diagramId, newMinimizedState);
            }}
            style={{
              width: '24px',
              height: '24px',
              border: '1px solid var(--chat-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--chat-btn-bg)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: 'var(--chat-text-secondary)',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--chat-btn-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--chat-btn-bg)';
            }}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '□' : '_'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && isInitialized && yCode && (
        <>
          {isEditMode ? (
            // Edit Mode: Syntax-highlighted code editor
            <div
              contentEditable={false}
              style={{
                padding: '12px',
                backgroundColor: 'var(--chat-bg)',
              }}
            >
              <MermaidCodeEditor
                value={localCode}
                onChange={(newValue) => {
                  // Update local state immediately for responsive UI
                  setLocalCode(newValue);

                  // Update Y.Text
                  if (yCode) {
                    const oldCode = yCode.toString();
                    if (oldCode !== newValue) {
                      yCode.delete(0, oldCode.length);
                      yCode.insert(0, newValue);
                    }
                  }
                }}
                onKeyDown={handleTextareaKeyDown}
                height={height}
              />
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--chat-text-tertiary)',
                }}
              >
                💡 Tip: Write Mermaid syntax above, then click "Render" to visualize your diagram
              </div>
            </div>
          ) : (
            // Render Mode: Diagram preview
            <MermaidCanvas
              diagramId={diagramId}
              code={localCode}
              height={height}
            />
          )}

          {/* Resize handle */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '16px',
              height: '16px',
              cursor: 'nwse-resize',
              borderBottomRightRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRight: '2px solid #999',
                borderBottom: '2px solid #999',
              }}
            />
          </div>
        </>
      )}

      {/* Minimized state */}
      {isMinimized && (
        <div
          style={{
            padding: '10px 14px',
            color: 'var(--chat-text-tertiary)',
            fontSize: '13px',
            fontStyle: 'italic',
          }}
        >
          Diagram minimized • Click to expand
        </div>
      )}

      {/* Loading state */}
      {!isMinimized && !isInitialized && (
        <div
          style={{
            padding: '24px',
            color: 'var(--chat-text-tertiary)',
            fontSize: '13px',
            textAlign: 'center',
          }}
        >
          Loading diagram...
        </div>
      )}
    </div>
  );
}
