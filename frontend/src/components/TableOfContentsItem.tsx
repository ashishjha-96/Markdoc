import type { HeadingNode } from "../hooks/useTableOfContents";

interface TableOfContentsItemProps {
  node: HeadingNode;
  activeHeadingId: string | null;
  onNavigate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  depth: number;
}

export function TableOfContentsItem({
  node,
  activeHeadingId,
  onNavigate,
  onToggleCollapse,
  depth,
}: TableOfContentsItemProps) {
  const hasChildren = node.children.length > 0;
  const isActive = activeHeadingId === node.id;
  const shouldShowChildren = hasChildren && !node.isCollapsed;

  const headingItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 8px",
    paddingLeft: `${(node.level - 1) * 12 + 8}px`,
    paddingRight: isActive ? "20px" : "8px",
    fontSize:
      node.level === 1 ? "12px" : node.level === 2 ? "11px" : "10px",
    fontWeight: isActive ? 600 : node.level === 1 ? 500 : 400,
    color: isActive ? "#646cff" : "var(--page-text)",
    backgroundColor: isActive ? "var(--block-selection-bg)" : "transparent",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    borderLeft: isActive ? "2px solid #646cff" : "2px solid transparent",
    marginBottom: "2px",
    position: "relative",
  };

  const collapseButtonStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0 2px",
    fontSize: "8px",
    color: "var(--chat-text-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "12px",
    height: "12px",
    flexShrink: 0,
  };

  return (
    <div>
      <div
        className="toc-heading-item"
        style={headingItemStyle}
        onClick={() => onNavigate(node.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
            style={collapseButtonStyle}
            aria-label={node.isCollapsed ? "Expand section" : "Collapse section"}
          >
            {node.isCollapsed ? "▶" : "▼"}
          </button>
        )}

        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.text}
        </span>

        {isActive && (
          <span
            style={{
              position: "absolute",
              right: "6px",
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: "#646cff",
              animation: "pulseActive 2s ease-in-out infinite",
            }}
            aria-label="Current section"
          />
        )}
      </div>

      {shouldShowChildren && (
        <div>
          {node.children.map((child) => (
            <TableOfContentsItem
              key={child.id}
              node={child}
              activeHeadingId={activeHeadingId}
              onNavigate={onNavigate}
              onToggleCollapse={onToggleCollapse}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
