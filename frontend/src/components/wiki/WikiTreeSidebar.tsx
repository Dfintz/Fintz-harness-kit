/**
 * WikiTreeSidebar — Sidebar navigation for the organization wiki.
 *
 * Wraps HierarchyTreeView with a search bar and "New Page" button.
 * Shows the page tree with expand/collapse, and inline search results
 * when the user types a query.
 *
 * @module wiki
 */

import AddIcon from '@mui/icons-material/Add';
import ArticleIcon from '@mui/icons-material/Article';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

import type { WikiTreeNode } from '@sc-fleet-manager/shared-types';

import { HierarchyTreeView } from '@/components/shared/HierarchyTreeView';
import { useWikiSearch, useWikiTree } from '@/hooks/queries/useWikiQueries';

// ─── Props ─────────────────────────────────────────────────────

export interface WikiTreeSidebarProps {
  /** Currently selected page id. */
  selectedPageId?: string;
  /** Called when a page is selected in the tree or search results. */
  onSelectPage: (pageId: string) => void;
  /** Called when the user clicks "New Page". */
  onCreatePage: () => void;
}

// ─── Component ─────────────────────────────────────────────────

export const WikiTreeSidebar: React.FC<Readonly<WikiTreeSidebarProps>> = ({
  selectedPageId,
  onSelectPage,
  onCreatePage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: treeNodes = [], isLoading: treeLoading, error: treeError } = useWikiTree();
  const { data: searchResults = [], isLoading: searchLoading } = useWikiSearch(searchQuery);

  const isSearching = searchQuery.trim().length >= 2;

  // ── Tree helpers ─────────────────────────────────────────────

  const getNodeId = useCallback((node: WikiTreeNode) => node.id, []);
  const getNodeChildren = useCallback((node: WikiTreeNode) => node.children ?? [], []);

  const renderNodeContent = useCallback(
    (node: WikiTreeNode, _depth: number, _selected: boolean) => (
      <Typography variant="body2" noWrap>
        {node.title}
      </Typography>
    ),
    []
  );

  const renderNodeIcon = useCallback(
    (_node: WikiTreeNode, _depth: number, _expanded: boolean) => <ArticleIcon fontSize="small" />,
    []
  );

  // ── Render ───────────────────────────────────────────────────

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <MenuBookIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            Wiki
          </Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onCreatePage}>
            New Page
          </Button>
        </Box>

        {/* Search */}
        <TextField
          size="small"
          fullWidth
          placeholder="Search pages…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Divider />

      {/* Content: search results or page tree */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 0.5 }}>
        {isSearching ? (
          // ── Search results ───────────────────────────────────
          <Box sx={{ p: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
              Search results
            </Typography>
            {searchLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : searchResults.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No pages found for &quot;{searchQuery}&quot;
              </Typography>
            ) : (
              <List dense disablePadding>
                {searchResults.map(result => (
                  <ListItemButton
                    key={result.id}
                    selected={result.id === selectedPageId}
                    onClick={() => onSelectPage(result.id)}
                    sx={{ borderRadius: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ArticleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={result.title}
                      secondary={result.snippet}
                      primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        noWrap: true,
                        sx: { maxWidth: '100%' },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        ) : (
          // ── Page tree ────────────────────────────────────────
          <HierarchyTreeView<WikiTreeNode>
            nodes={treeNodes}
            getNodeId={getNodeId}
            getNodeChildren={getNodeChildren}
            renderNodeContent={renderNodeContent}
            renderNodeIcon={renderNodeIcon}
            selectedId={selectedPageId}
            onSelect={onSelectPage}
            defaultExpandDepth={2}
            loading={treeLoading}
            error={treeError ? 'Failed to load wiki pages' : undefined}
            emptyContent={
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <MenuBookIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No wiki pages yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Click &quot;New Page&quot; to get started
                </Typography>
              </Box>
            }
          />
        )}
      </Box>
    </Paper>
  );
};
