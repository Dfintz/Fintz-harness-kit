/**
 * FleetTreeView — Hierarchical fleet display with drag-and-drop reordering
 * Wave 2.2 — Visual Fleet Organizer
 */

import { useFleetHealth, useFleetTree, useReorderFleets } from '@/hooks/queries';
import type { FleetV2 } from '@/types/apiV2';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight as ChevronRightIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
  Favorite as FavoriteIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  DriveFileMove as MoveIcon,
  People as PeopleIcon,
  RocketLaunch as ShipIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useMemo, useState } from 'react';

// Fleet node with children for tree rendering
interface FleetNode extends FleetV2 {
  children?: FleetNode[];
  color?: string;
}

interface FleetTreeViewProps {
  organizationId: string;
  onFleetSelect?: (fleetId: string) => void;
  onMoveFleet?: (fleet: FleetNode) => void;
  selectedFleetId?: string;
}

/** Small inline badge showing fleet health score. */
function TreeNodeHealthBadge({ fleetId }: Readonly<{ fleetId: string }>) {
  const { data: health } = useFleetHealth(fleetId);
  const theme = useTheme();

  if (!health) return null;

  const score = health.healthScore;
  let color = theme.palette.error.main;
  if (score >= 75) color = theme.palette.success.main;
  else if (score >= 50) color = theme.palette.warning.main;

  return (
    <Tooltip title={`Readiness: ${score}%`}>
      <Chip
        icon={<FavoriteIcon sx={{ fontSize: 14 }} />}
        label={`${score}%`}
        size="small"
        sx={{
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 600,
          bgcolor: alpha(color, 0.12),
          color,
          border: `1px solid ${alpha(color, 0.3)}`,
          '& .MuiChip-label': { px: 0.5 },
        }}
      />
    </Tooltip>
  );
}

// ============================================================================
// Sortable Tree Node
// ============================================================================

interface TreeNodeProps {
  node: FleetNode;
  depth: number;
  expandedIds: Set<string>;
  selectedFleetId?: string;
  onToggle: (id: string) => void;
  onSelect?: (id: string) => void;
  onMove?: (fleet: FleetNode) => void;
}

function SortableTreeNode({
  node,
  depth,
  expandedIds,
  selectedFleetId,
  onToggle,
  onSelect,
  onMove,
}: Readonly<TreeNodeProps>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedFleetId === node.id;
  const hasChildren = (node.children?.length ?? 0) > 0;
  const theme = useTheme();

  return (
    <Box ref={setNodeRef} style={style}>
      {/* Node row */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={() => onSelect?.(node.id)}
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
        }}
      >
        {/* Drag handle */}
        <Box
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', display: 'flex', color: 'grey.600' }}
        >
          <DragIcon fontSize="small" />
        </Box>

        {/* Expand/collapse */}
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={e => {
              e.stopPropagation();
              onToggle(node.id);
            }}
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

        {/* Folder icon */}
        {isExpanded && hasChildren ? (
          <FolderOpenIcon
            fontSize="small"
            sx={{ color: node.color || theme.palette.primary.main }}
          />
        ) : (
          <FolderIcon fontSize="small" sx={{ color: node.color || theme.palette.primary.main }} />
        )}

        {/* Fleet name */}
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

        {/* Badges */}
        <Tooltip title="Ships">
          <Chip
            icon={<ShipIcon sx={{ fontSize: 14 }} />}
            label={node.shipCount ?? 0}
            size="small"
            variant="outlined"
            sx={{ height: 22, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
          />
        </Tooltip>

        <Tooltip title="Members">
          <Chip
            icon={<PeopleIcon sx={{ fontSize: 14 }} />}
            label={node.memberCount ?? 0}
            size="small"
            variant="outlined"
            sx={{ height: 22, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
          />
        </Tooltip>

        <TreeNodeHealthBadge fleetId={node.id} />

        {/* Move button */}
        {onMove && (
          <Tooltip title="Move fleet">
            <IconButton
              size="small"
              onClick={e => {
                e.stopPropagation();
                onMove(node);
              }}
              sx={{ p: 0.25 }}
            >
              <MoveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Children (collapsible) */}
      {hasChildren && (
        <Collapse in={isExpanded}>
          {node.children!.map(child => (
            <SortableTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedFleetId={selectedFleetId}
              onToggle={onToggle}
              onSelect={onSelect}
              onMove={onMove}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

// ============================================================================
// Main FleetTreeView
// ============================================================================

export function FleetTreeView({
  organizationId,
  onFleetSelect,
  onMoveFleet,
  selectedFleetId,
}: Readonly<FleetTreeViewProps>) {
  const { data, isLoading, error } = useFleetTree(organizationId);
  const reorderMutation = useReorderFleets();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Flatten tree to get all node IDs for SortableContext
  const allIds = useMemo(() => {
    const ids: string[] = [];
    function collect(nodes: FleetNode[]) {
      for (const node of nodes) {
        ids.push(node.id);
        if (node.children) collect(node.children);
      }
    }
    if (data?.tree) collect(data.tree as FleetNode[]);
    return ids;
  }, [data]);

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
      if (!over || active.id === over.id) return;

      // For now, reorder at root level — full parent-move via FleetMoveDialog
      const tree = (data?.tree ?? []) as FleetNode[];
      const rootIds = tree.map(n => n.id);

      if (rootIds.includes(active.id as string) && rootIds.includes(over.id as string)) {
        const oldIndex = rootIds.indexOf(active.id as string);
        const newIndex = rootIds.indexOf(over.id as string);
        if (oldIndex !== newIndex) {
          const newOrder = [...rootIds];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, active.id as string);
          reorderMutation.mutate({
            organizationId,
            orderedIds: newOrder,
            parentFleetId: null,
          });
        }
      }
    },
    [data, organizationId, reorderMutation]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load fleet tree: {error.message}
      </Alert>
    );
  }

  const tree = (data?.tree ?? []) as FleetNode[];

  if (tree.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'grey.500' }}>
        <FolderIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
        <Typography variant="body2">No fleets found. Create a fleet to get started.</Typography>
      </Box>
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
        <Box
          sx={{
            backgroundColor: 'background.default',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            py: 1,
          }}
        >
          {tree.map(node => (
            <SortableTreeNode
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              selectedFleetId={selectedFleetId}
              onToggle={toggleExpand}
              onSelect={onFleetSelect}
              onMove={onMoveFleet}
            />
          ))}
        </Box>
      </SortableContext>

      <DragOverlay>
        {activeId ? (
          <Box
            sx={{
              px: 2,
              py: 1,
              backgroundColor: 'background.paper',
              borderRadius: 1,
              border: 1,
              borderColor: 'primary.main',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            <Typography variant="body2" fontWeight={500}>
              {allIds.includes(activeId) ? 'Moving fleet...' : activeId}
            </Typography>
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
