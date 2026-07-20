/**
 * TeamTreeView — Wave 2.6 Teams/Squads System
 *
 * Hierarchical team display with drag-and-drop reordering via @dnd-kit.
 * Follows the FleetTreeView pattern: standalone DnD tree with sortable nodes,
 * drag overlay, and automatic reorder mutation on drop.
 */

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { TeamTreeNode } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useMemo, useState } from 'react';

import { HierarchyTreeView } from '@/components/shared/HierarchyTreeView';
import { useReorderTeams } from '@/hooks/queries/useTeamQueries';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx, getStatusColor } from '@/utils/statusStyles';

// ============================================================================
// Types
// ============================================================================

interface TeamTreeViewProps {
  /** Flat or root-level tree nodes. When `organizationId` is given, reorder is enabled. */
  tree: TeamTreeNode[];
  onSelectTeam: (teamId: string) => void;
  selectedTeamId?: string;
  /** Required for reorder mutations. Without it, drag-and-drop is disabled. */
  organizationId?: string;
  /** Show a loading spinner instead of the tree. */
  loading?: boolean;
  /** Show an error message instead of the tree. */
  error?: string;
}

// ============================================================================
// Sortable Tree Node
// ============================================================================

interface SortableNodeProps {
  readonly node: TeamTreeNode;
  readonly depth: number;
  readonly expandedIds: Set<string>;
  readonly selectedTeamId?: string;
  readonly onToggle: (id: string) => void;
  readonly onSelect: (id: string) => void;
  readonly dndEnabled: boolean;
}

function SortableTeamNode({
  node,
  depth,
  expandedIds,
  selectedTeamId,
  onToggle,
  onSelect,
  dndEnabled,
}: SortableNodeProps) {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !dndEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedTeamId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <Box ref={setNodeRef} style={style}>
      {/* Node row */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={() => onSelect(node.id)}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id);
          }
          if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
            e.preventDefault();
            onToggle(node.id);
          }
          if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
            e.preventDefault();
            onToggle(node.id);
          }
        }}
        sx={{
          pl: depth * 3,
          pr: 1,
          py: 0.5,
          cursor: 'pointer',
          borderRadius: 1,
          backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
          '&:hover': {
            backgroundColor: isSelected
              ? alpha(theme.palette.primary.main, 0.16)
              : alpha(theme.palette.common.white, 0.04),
          },
          borderLeft: isSelected
            ? `3px solid ${theme.palette.primary.main}`
            : '3px solid transparent',
          transition: theme.transitions.create(['background-color', 'border-color'], {
            duration: 150,
          }),
          opacity: node.isActive ? 1 : 0.5,
        }}
      >
        {/* Drag handle */}
        {dndEnabled && (
          <Box
            {...attributes}
            {...listeners}
            sx={{ cursor: 'grab', display: 'flex', color: 'grey.600' }}
            aria-label={`Drag to reorder ${node.name}`}
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>
        )}

        {/* Expand/collapse */}
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={e => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            sx={{ p: 0.25 }}
          >
            {isExpanded ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 28 }} /> // spacer
        )}

        {/* Group icon */}
        <GroupIcon fontSize="small" sx={{ color: getStatusColor(node.type, theme) }} />

        {/* Emblem (if uploaded) */}
        {node.emblem && (
          <Avatar
            src={sanitizeImageUrl(node.emblem) || undefined}
            variant="rounded"
            sx={{ width: 20, height: 20, bgcolor: 'action.hover' }}
          />
        )}

        {/* Team name */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: isSelected ? 600 : 400,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.name}
        </Typography>

        {/* Type chip */}
        <Chip
          label={node.type}
          size="small"
          sx={{
            ...getStatusChipSx(node.type, theme),
            height: 18,
            fontSize: '0.65rem',
          }}
        />

        {/* Member count */}
        <Chip
          icon={<GroupIcon sx={{ fontSize: 14 }} />}
          label={`${node.memberCount}/${node.maxMembers}`}
          size="small"
          variant="outlined"
          sx={{
            height: 22,
            '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' },
          }}
        />
      </Stack>

      {/* Children (collapsible) */}
      {hasChildren && (
        <Collapse in={isExpanded}>
          {node.children.map((child: TeamTreeNode) => (
            <SortableTeamNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedTeamId={selectedTeamId}
              onToggle={onToggle}
              onSelect={onSelect}
              dndEnabled={dndEnabled}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

// ============================================================================
// Main TeamTreeView
// ============================================================================

export const TeamTreeView: React.FC<TeamTreeViewProps> = ({
  tree,
  onSelectTeam,
  selectedTeamId,
  organizationId,
  loading,
  error,
}) => {
  const reorderMutation = useReorderTeams(organizationId ?? '');
  const dndEnabled = !!organizationId;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Auto-expand first level
    const initial = new Set<string>();
    for (const node of tree) {
      if (node.children.length > 0) initial.add(node.id);
    }
    return initial;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const theme = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Flatten tree to get all node IDs for SortableContext
  const allIds = useMemo(() => {
    const ids: string[] = [];
    function collect(nodes: TeamTreeNode[]) {
      for (const n of nodes) {
        ids.push(n.id);
        if (n.children.length > 0) collect(n.children);
      }
    }
    collect(tree);
    return ids;
  }, [tree]);

  // Find the active node for drag overlay
  const activeNode = useMemo(() => {
    if (!activeId) return null;
    function find(nodes: TeamTreeNode[]): TeamTreeNode | null {
      for (const n of nodes) {
        if (n.id === activeId) return n;
        const found = find(n.children);
        if (found) return found;
      }
      return null;
    }
    return find(tree);
  }, [activeId, tree]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id || !organizationId) return;

      const overId = over.id as string;

      // Find the parent that contains both active and over nodes at the same level
      function findSiblingGroup(
        nodes: TeamTreeNode[],
        parentId: string | null
      ): { ids: string[]; parentId: string | null } | null {
        const nodeIds = nodes.map(n => n.id);
        if (nodeIds.includes(active.id as string) && nodeIds.includes(overId)) {
          return { ids: nodeIds, parentId };
        }
        for (const node of nodes) {
          if (node.children.length > 0) {
            const found = findSiblingGroup(node.children, node.id);
            if (found) return found;
          }
        }
        return null;
      }

      const group = findSiblingGroup(tree, null);
      if (!group) return; // Nodes are not siblings — no cross-parent reorder

      const { ids: siblingIds, parentId } = group;
      const oldIndex = siblingIds.indexOf(active.id as string);
      const newIndex = siblingIds.indexOf(overId);
      if (oldIndex === newIndex) return;

      const newOrder = [...siblingIds];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);

      reorderMutation.mutate({
        orderedIds: newOrder,
        parentTeamId: parentId,
      });
    },
    [tree, organizationId, reorderMutation]
  );

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load teams: {error}
      </Alert>
    );
  }

  // Empty state
  if (tree.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'grey.500' }}>
        <GroupIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          No teams yet. Create your first team to get started.
        </Typography>
      </Box>
    );
  }

  const treeContent = (
    <Box
      role="tree"
      aria-label="Team hierarchy"
      sx={{
        backgroundColor: 'background.default',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        py: 1,
      }}
    >
      {tree.map(node => (
        <SortableTeamNode
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          selectedTeamId={selectedTeamId}
          onToggle={toggleExpand}
          onSelect={onSelectTeam}
          dndEnabled={dndEnabled}
        />
      ))}
    </Box>
  );

  // Without an orgId, render read-only tree via HierarchyTreeView
  if (!dndEnabled) {
    return (
      <HierarchyTreeView<TeamTreeNode>
        nodes={tree}
        getNodeId={n => n.id}
        getNodeChildren={n => n.children}
        renderNodeContent={(n, _depth, selected) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: selected ? 600 : 400,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: n.isActive ? 1 : 0.5,
            }}
          >
            {n.name}
          </Typography>
        )}
        renderNodeIcon={n => (
          <GroupIcon fontSize="small" sx={{ color: getStatusColor(n.type, theme) }} />
        )}
        renderNodeActions={n => (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip
              label={n.type}
              size="small"
              sx={{
                ...getStatusChipSx(n.type, theme),
                height: 18,
                fontSize: '0.65rem',
              }}
            />
            <Chip
              icon={<GroupIcon sx={{ fontSize: 14 }} />}
              label={`${n.memberCount}/${n.maxMembers}`}
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' },
              }}
            />
          </Stack>
        )}
        selectedId={selectedTeamId}
        onSelect={onSelectTeam}
        loading={loading}
        error={error}
        emptyContent={
          <Box sx={{ textAlign: 'center', py: 4, color: 'grey.500' }}>
            <GroupIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              No teams yet. Create your first team to get started.
            </Typography>
          </Box>
        }
        sx={{
          backgroundColor: 'background.default',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          py: 1,
        }}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
        {treeContent}
      </SortableContext>

      <DragOverlay>
        {activeNode ? (
          <Box
            sx={{
              px: 2,
              py: 1,
              backgroundColor: 'background.paper',
              borderRadius: 1,
              border: 1,
              borderColor: `${getStatusColor(activeNode.type, theme)}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <GroupIcon fontSize="small" sx={{ color: getStatusColor(activeNode.type, theme) }} />
            <Typography variant="body2" fontWeight={500}>
              {activeNode.name}
            </Typography>
            <Chip
              label={activeNode.type}
              size="small"
              sx={{
                ...getStatusChipSx(activeNode.type, theme),
                height: 18,
                fontSize: '0.65rem',
              }}
            />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
