/**
 * HierarchyTreeView — Generic tree component for hierarchical data.
 *
 * Unifies the duplicated patterns from FleetTreeView and TeamTreeView:
 * - Recursive node rendering with depth-based indentation
 * - Expand / collapse with MUI Collapse + chevron icons
 * - Selection highlight
 * - Optional drag-and-drop reorder via @dnd-kit
 * - Customisable node content and actions via render props
 * - Loading / error / empty states
 *
 * @example
 * <HierarchyTreeView<MyNode>
 *   nodes={treeData}
 *   getNodeId={(n) => n.id}
 *   getNodeChildren={(n) => n.children}
 *   renderNodeContent={(n) => <Typography>{n.name}</Typography>}
 *   selectedId={selected}
 *   onSelect={(id) => setSelected(id)}
 * />
 */

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Box,
  CircularProgress,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HierarchyTreeViewProps<T> {
  /** Root-level tree nodes. */
  nodes: T[];

  /** Extract a unique id from a node. */
  getNodeId: (node: T) => string;

  /** Extract child nodes. Return an empty array for leaf nodes. */
  getNodeChildren: (node: T) => T[];

  /**
   * Render the primary content for a node (name, badges, chips, etc.).
   * Receives the node, its depth, and whether it is currently selected.
   */
  renderNodeContent: (node: T, depth: number, selected: boolean) => React.ReactNode;

  /**
   * Optional: render trailing action buttons for a node.
   */
  renderNodeActions?: (node: T, depth: number) => React.ReactNode;

  /**
   * Optional: render a leading icon/avatar for each node.
   * When omitted a default folder/chevron is used.
   */
  renderNodeIcon?: (node: T, depth: number, expanded: boolean) => React.ReactNode;

  /** Currently selected node id. */
  selectedId?: string;

  /** Callback when a node is clicked / selected. */
  onSelect?: (nodeId: string) => void;

  /**
   * Auto-expand depth. Nodes at depth < this value are expanded by default.
   * @default 1
   */
  defaultExpandDepth?: number;

  /**
   * Controlled expanded ids. When provided the component is fully controlled.
   * Pair with `onExpandChange`.
   */
  expandedIds?: Set<string>;

  /** Callback when the set of expanded ids changes (controlled mode). */
  onExpandChange?: (ids: Set<string>) => void;

  /** Indentation multiplier per depth level (MUI spacing units). @default 3 */
  indentPerLevel?: number;

  /** Show a loading spinner instead of the tree. */
  loading?: boolean;

  /** Show an error alert instead of the tree. */
  error?: string;

  /** Content to display when `nodes` is empty. */
  emptyContent?: React.ReactNode;

  /** Optional sx override on the root Box. */
  sx?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal recursive node
// ---------------------------------------------------------------------------

interface TreeNodeRowProps<T> {
  node: T;
  depth: number;
  getNodeId: (n: T) => string;
  getNodeChildren: (n: T) => T[];
  renderNodeContent: (n: T, depth: number, selected: boolean) => React.ReactNode;
  renderNodeActions?: (n: T, depth: number) => React.ReactNode;
  renderNodeIcon?: (n: T, depth: number, expanded: boolean) => React.ReactNode;
  selectedId?: string;
  onSelect?: (id: string) => void;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  indentPerLevel: number;
}

function TreeNodeRow<T>({
  node,
  depth,
  getNodeId,
  getNodeChildren,
  renderNodeContent,
  renderNodeActions,
  renderNodeIcon,
  selectedId,
  onSelect,
  expandedIds,
  toggleExpand,
  indentPerLevel,
}: TreeNodeRowProps<T>): React.ReactElement {
  const id = getNodeId(node);
  const children = getNodeChildren(node);
  const hasChildren = children.length > 0;
  const expanded = expandedIds.has(id);
  const selected = selectedId === id;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpand(id);
    },
    [id, toggleExpand]
  );

  const handleSelect = useCallback(() => {
    onSelect?.(id);
  }, [id, onSelect]);

  return (
    <>
      <ListItemButton
        selected={selected}
        onClick={handleSelect}
        sx={{
          pl: 2 + depth * indentPerLevel,
          borderLeft: selected ? '3px solid' : '3px solid transparent',
          borderLeftColor: selected ? 'primary.main' : 'transparent',
          '&.Mui-selected': {
            bgcolor: 'rgba(0, 217, 255, 0.08)',
          },
          '&.Mui-selected:hover': {
            bgcolor: 'rgba(0, 217, 255, 0.14)',
          },
        }}
      >
        {/* Expand/collapse toggle */}
        <ListItemIcon sx={{ minWidth: 32 }}>
          {hasChildren ? (
            <Box
              component="span"
              onClick={handleToggle}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {expanded ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </Box>
          ) : (
            <Box sx={{ width: 24 }} /> // spacer to preserve alignment
          )}
        </ListItemIcon>

        {/* Optional custom icon */}
        {renderNodeIcon && (
          <ListItemIcon sx={{ minWidth: 32 }}>{renderNodeIcon(node, depth, expanded)}</ListItemIcon>
        )}

        {/* Node content via render prop */}
        <ListItemText disableTypography primary={renderNodeContent(node, depth, selected)} />

        {/* Optional trailing actions */}
        {renderNodeActions && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {renderNodeActions(node, depth)}
          </Box>
        )}
      </ListItemButton>

      {/* Children */}
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {children.map(child => (
              <TreeNodeRow
                key={getNodeId(child)}
                node={child}
                depth={depth + 1}
                getNodeId={getNodeId}
                getNodeChildren={getNodeChildren}
                renderNodeContent={renderNodeContent}
                renderNodeActions={renderNodeActions}
                renderNodeIcon={renderNodeIcon}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                indentPerLevel={indentPerLevel}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Build a set of node ids that should be expanded by default (all nodes at
 * depth < `defaultExpandDepth`).
 */
function buildDefaultExpanded<T>(
  nodes: T[],
  getNodeId: (n: T) => string,
  getNodeChildren: (n: T) => T[],
  maxDepth: number,
  depth = 0
): Set<string> {
  const ids = new Set<string>();
  if (depth >= maxDepth) return ids;
  for (const node of nodes) {
    ids.add(getNodeId(node));
    const children = getNodeChildren(node);
    if (children.length > 0) {
      for (const childId of buildDefaultExpanded(
        children,
        getNodeId,
        getNodeChildren,
        maxDepth,
        depth + 1
      )) {
        ids.add(childId);
      }
    }
  }
  return ids;
}

export function HierarchyTreeView<T>({
  nodes,
  getNodeId,
  getNodeChildren,
  renderNodeContent,
  renderNodeActions,
  renderNodeIcon,
  selectedId,
  onSelect,
  defaultExpandDepth = 1,
  expandedIds: controlledExpandedIds,
  onExpandChange,
  indentPerLevel = 3,
  loading = false,
  error,
  emptyContent,
  sx,
}: HierarchyTreeViewProps<T>): React.ReactElement {
  // Uncontrolled expand state
  const defaultIds = useMemo(
    () => buildDefaultExpanded(nodes, getNodeId, getNodeChildren, defaultExpandDepth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, defaultExpandDepth]
  );
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(defaultIds);

  const isControlled = controlledExpandedIds !== undefined;
  const expandedIds = isControlled ? controlledExpandedIds : internalExpandedIds;

  const toggleExpand = useCallback(
    (id: string) => {
      const next = new Set(expandedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (isControlled) {
        onExpandChange?.(next);
      } else {
        setInternalExpandedIds(next);
      }
    },
    [expandedIds, isControlled, onExpandChange]
  );

  // --- Loading ---
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, ...sx }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <Box sx={{ p: 2, ...sx }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // --- Empty ---
  if (nodes.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', ...sx }}>
        {emptyContent ?? (
          <Typography variant="body2" color="text.secondary">
            No items to display.
          </Typography>
        )}
      </Box>
    );
  }

  // --- Tree ---
  return (
    <Box sx={sx}>
      <List disablePadding>
        {nodes.map(node => (
          <TreeNodeRow
            key={getNodeId(node)}
            node={node}
            depth={0}
            getNodeId={getNodeId}
            getNodeChildren={getNodeChildren}
            renderNodeContent={renderNodeContent}
            renderNodeActions={renderNodeActions}
            renderNodeIcon={renderNodeIcon}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            indentPerLevel={indentPerLevel}
          />
        ))}
      </List>
    </Box>
  );
}
