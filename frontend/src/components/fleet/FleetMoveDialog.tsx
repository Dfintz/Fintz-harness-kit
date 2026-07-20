/**
 * FleetMoveDialog — Select a new parent for a fleet
 * Wave 2.2 — Visual Fleet Organizer
 */

import { HierarchyTreeView } from '@/components/shared/HierarchyTreeView';
import { useMoveFleet } from '@/hooks/queries';
import type { FleetV2 } from '@/types/apiV2';
import { Folder as FolderIcon, Home as RootIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

interface FleetNode extends FleetV2 {
  children?: FleetNode[];
  level?: number;
}

interface FleetMoveDialogProps {
  open: boolean;
  onClose: () => void;
  fleet: FleetNode | null;
  allFleets: FleetNode[];
}

const ROOT_VALUE = '__ROOT__';

/**
 * Collect all descendant IDs of a fleet (to prevent circular moves)
 */
function collectDescendantIds(node: FleetNode): Set<string> {
  const ids = new Set<string>();
  function walk(n: FleetNode) {
    ids.add(n.id);
    for (const child of n.children ?? []) {
      walk(child);
    }
  }
  walk(node);
  return ids;
}

export function FleetMoveDialog({
  open,
  onClose,
  fleet,
  allFleets,
}: Readonly<FleetMoveDialogProps>) {
  const moveFleet = useMoveFleet();
  const [selectedParent, setSelectedParent] = useState<string>(ROOT_VALUE);

  // Compute disabled IDs (self + all descendants)
  const disabledIds = useMemo(() => {
    if (!fleet) return new Set<string>();
    return collectDescendantIds(fleet);
  }, [fleet]);

  // Build set of valid target IDs (exclude self/descendants and deep nodes)
  const validIds = useMemo(() => {
    const ids = new Set<string>();
    function collect(nodes: FleetNode[]) {
      for (const n of nodes) {
        if (!disabledIds.has(n.id) && (n.level ?? 0) < 4) ids.add(n.id);
        if (n.children) collect(n.children);
      }
    }
    collect(allFleets);
    return ids;
  }, [allFleets, disabledIds]);

  const handleSelect = (id: string) => {
    if (validIds.has(id)) setSelectedParent(id);
  };

  const handleConfirm = () => {
    if (!fleet) return;

    const parentFleetId = selectedParent === ROOT_VALUE ? null : selectedParent;
    moveFleet.mutate(
      { fleetId: fleet.id, parentFleetId },
      {
        onSuccess: () => {
          onClose();
          setSelectedParent(ROOT_VALUE);
        },
      }
    );
  };

  const handleClose = () => {
    onClose();
    setSelectedParent(ROOT_VALUE);
  };

  if (!fleet) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move Fleet</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Move <strong>{fleet.name}</strong> to a new parent fleet, or to the root level.
        </Typography>

        <Stack spacing={1}>
          {/* Root Level option */}
          <Button
            variant={selectedParent === ROOT_VALUE ? 'contained' : 'outlined'}
            startIcon={<RootIcon />}
            onClick={() => setSelectedParent(ROOT_VALUE)}
            size="small"
            fullWidth
            sx={{ justifyContent: 'flex-start' }}
          >
            No Parent (Root Level)
          </Button>

          {/* Fleet tree picker */}
          <Box
            sx={{
              maxHeight: 300,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <HierarchyTreeView<FleetNode>
              nodes={allFleets}
              getNodeId={n => n.id}
              getNodeChildren={n => n.children ?? []}
              renderNodeContent={(n, _depth, selected) => (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: selected ? 600 : 400,
                    opacity: validIds.has(n.id) ? 1 : 0.35,
                    textDecoration: disabledIds.has(n.id) ? 'line-through' : 'none',
                  }}
                >
                  {n.name}
                </Typography>
              )}
              renderNodeIcon={n => (
                <FolderIcon
                  fontSize="small"
                  sx={{ color: validIds.has(n.id) ? 'primary.main' : 'grey.600' }}
                />
              )}
              selectedId={selectedParent === ROOT_VALUE ? undefined : selectedParent}
              onSelect={handleSelect}
              defaultExpandDepth={2}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={moveFleet.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={moveFleet.isPending}>
          {moveFleet.isPending ? 'Moving...' : 'Move Fleet'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
