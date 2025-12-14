/**
 * EmbedBlock Component
 *
 * A BlockNote block for embedding external content like YouTube, Vimeo, Spotify, etc.
 * Features:
 * - Compact inline URL input
 * - Responsive iframe embedding with auto-sizing
 * - Support for multiple platforms
 */

import { useState, useEffect, useCallback } from 'react';
import { useBlockNoteEditor } from '@blocknote/react';
import { parseEmbedUrl, getEmbedTypeName, type EmbedInfo } from '../../lib/embedParser';

interface EmbedBlockProps {
    block: {
        id: string;
        type: string;
        props: {
            url: string;
            width: number;
            height: number;
            caption: string;
        };
    };
}

// Get optimal dimensions for each embed type
function getEmbedDimensions(type: EmbedInfo['type']): { aspectRatio?: string; height?: string } {
    switch (type) {
        case 'spotify':
            return { height: '152px' };
        case 'soundcloud':
            return { height: '166px' };
        case 'twitter':
            return { height: '400px' };
        default:
            return { aspectRatio: '16 / 9' };
    }
}

export function EmbedBlock({ block }: EmbedBlockProps) {
    const editor = useBlockNoteEditor();
    const [inputUrl, setInputUrl] = useState(block.props.url || '');
    const [embedInfo, setEmbedInfo] = useState<EmbedInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (block.props.url) {
            const info = parseEmbedUrl(block.props.url);
            if (info) {
                setEmbedInfo(info);
                setError(null);
                setInputUrl(block.props.url);
            } else {
                setEmbedInfo(null);
                setError('Unsupported URL');
            }
        } else {
            setEmbedInfo(null);
            setError(null);
        }
    }, [block.props.url]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmedUrl = inputUrl.trim();

        if (!trimmedUrl) return;

        const info = parseEmbedUrl(trimmedUrl);
        if (!info) {
            setError('Unsupported URL');
            return;
        }

        editor.updateBlock(block.id, {
            type: 'embed' as any,
            props: { ...block.props, url: trimmedUrl },
        });

        setEmbedInfo(info);
        setError(null);
    }, [editor, block.id, block.props, inputUrl]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    const handleBlur = useCallback(() => {
        if (inputUrl.trim() && inputUrl !== block.props.url) {
            handleSubmit();
        }
    }, [inputUrl, block.props.url, handleSubmit]);

    // URL input mode
    if (!embedInfo) {
        return (
            <div
                className="embed-block-input"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    border: `1px solid ${error ? '#ef4444' : 'var(--chat-border)'}`,
                    borderRadius: '8px',
                    backgroundColor: 'var(--chat-bg)',
                    width: '70%',
                    margin: '0 auto',
                }}
            >
                <span style={{ fontSize: '16px', opacity: 0.6 }}>🔗</span>
                <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => {
                        setInputUrl(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    placeholder="Paste YouTube, Vimeo, Spotify, or other embed URL..."
                    autoFocus
                    style={{
                        flex: 1,
                        padding: '6px 0',
                        fontSize: '14px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--chat-text)',
                        outline: 'none',
                    }}
                />
                {inputUrl && (
                    <button
                        type="button"
                        onClick={() => handleSubmit()}
                        style={{
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: 500,
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: '#646cff',
                            color: 'white',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Embed
                    </button>
                )}
            </div>
        );
    }

    const dimensions = getEmbedDimensions(embedInfo.type);
    const containerMaxWidth = embedInfo.type === 'twitter' ? 550 : (block.props.width || 640);

    return (
        <div
            className="embed-block"
            style={{
                width: '100%',
                maxWidth: containerMaxWidth,
                margin: '0 auto',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: dimensions.aspectRatio,
                    height: dimensions.height,
                    borderRadius: '12px',
                    overflow: 'hidden',
                }}
            >
                <iframe
                    src={embedInfo.embedUrl}
                    title={`${getEmbedTypeName(embedInfo.type)} embed`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{
                        position: dimensions.aspectRatio ? 'absolute' : 'relative',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: '12px',
                    }}
                />
            </div>

            {block.props.caption && (
                <p
                    style={{
                        marginTop: '8px',
                        fontSize: '13px',
                        color: 'var(--chat-text-secondary)',
                        textAlign: 'center',
                        fontStyle: 'italic',
                    }}
                >
                    {block.props.caption}
                </p>
            )}
        </div>
    );
}
