/**
 * WikiPage — Main page for the organization wiki.
 *
 * Layout:
 *   [Left sidebar: WikiTreeSidebar]  |  [Right content: Viewer / Editor / Welcome]
 *
 * Routes:
 *   /wiki           → shows tree sidebar + welcome state (or first page)
 *   /wiki/:pageId   → shows tree sidebar + selected page (view or edit mode)
 *
 * On mobile the sidebar collapses into a drawer.
 *
 * @module wiki
 */

import MenuIcon from '@mui/icons-material/Menu';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {
  Alert,
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { CreateWikiPageRequest, UpdateWikiPageRequest } from '@sc-fleet-manager/shared-types';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { WikiPageEditor } from '@/components/wiki/WikiPageEditor';
import { WikiPageViewer } from '@/components/wiki/WikiPageViewer';
import { WikiRevisionHistory } from '@/components/wiki/WikiRevisionHistory';
import { WikiTreeSidebar } from '@/components/wiki/WikiTreeSidebar';
import {
  useCreateWikiPage,
  useDeleteWikiPage,
  useRestoreWikiRevision,
  useUpdateWikiPage,
  useWikiPage,
} from '@/hooks/queries/useWikiQueries';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';

// ─── Constants ─────────────────────────────────────────────────

const SIDEBAR_WIDTH = 300;

// ─── Component ─────────────────────────────────────────────────

const WikiPage: React.FC = () => {
  const { pageId } = useParams<{ pageId?: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const notification = useNotification();

  // ── Local state ──────────────────────────────────────────────

  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Queries & mutations ──────────────────────────────────────

  const { data: page, isLoading: pageLoading, error: pageError } = useWikiPage(pageId);

  const createPage = useCreateWikiPage();
  const updatePage = useUpdateWikiPage();
  const deletePage = useDeleteWikiPage();
  const restoreRevision = useRestoreWikiRevision();

  // ── Confirm dialog for delete ────────────────────────────────

  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  // ── Handlers ─────────────────────────────────────────────────

  const handleSelectPage = useCallback(
    (id: string) => {
      setEditing(false);
      setCreating(false);
      navigate(`/wiki/${id}`);
      if (isMobile) setMobileDrawerOpen(false);
    },
    [navigate, isMobile]
  );

  const handleCreatePage = useCallback(() => {
    setCreating(true);
    setEditing(false);
    if (isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  const handleEdit = useCallback(() => {
    setEditing(true);
    setCreating(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setCreating(false);
  }, []);

  const handleSave = useCallback(
    async (data: CreateWikiPageRequest | UpdateWikiPageRequest) => {
      try {
        if (creating) {
          const newPage = await createPage.mutateAsync(data as CreateWikiPageRequest);
          notification.success('Page created');
          setCreating(false);
          navigate(`/wiki/${newPage.id}`);
        } else if (pageId) {
          await updatePage.mutateAsync({
            pageId,
            data: data as UpdateWikiPageRequest,
          });
          notification.success('Page saved');
          setEditing(false);
        }
      } catch (err) {
        logger.error(
          'Failed to save wiki page',
          err instanceof Error ? err : new Error(String(err))
        );
        notification.error('Failed to save page');
      }
    },
    [creating, pageId, createPage, updatePage, navigate, notification]
  );

  const handleDeleteClick = useCallback(() => {
    if (pageId) openDialog(pageId);
  }, [pageId, openDialog]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingData) return;
    try {
      await deletePage.mutateAsync(pendingData);
      notification.success('Page deleted');
      closeDialog();
      navigate('/wiki');
    } catch (err) {
      logger.error(
        'Failed to delete wiki page',
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error('Failed to delete page');
    }
  }, [pendingData, deletePage, navigate, closeDialog, notification]);

  const handleRestore = useCallback(
    async (revisionId: string) => {
      if (!pageId) return;
      try {
        await restoreRevision.mutateAsync({ pageId, revisionId });
        notification.success('Revision restored');
        setHistoryOpen(false);
      } catch (err) {
        logger.error(
          'Failed to restore revision',
          err instanceof Error ? err : new Error(String(err))
        );
        notification.error('Failed to restore revision');
      }
    },
    [pageId, restoreRevision, notification]
  );

  // ── Sidebar content ──────────────────────────────────────────

  const sidebarContent = (
    <WikiTreeSidebar
      selectedPageId={pageId}
      onSelectPage={handleSelectPage}
      onCreatePage={handleCreatePage}
    />
  );

  // ── Right pane content ───────────────────────────────────────

  const renderContent = () => {
    // Creating a new page
    if (creating) {
      return (
        <WikiPageEditor
          onSave={handleSave}
          onCancel={handleCancelEdit}
          saving={createPage.isPending}
        />
      );
    }

    // No page selected → welcome state
    if (!pageId) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: 400,
            px: 4,
          }}
        >
          <MenuBookIcon sx={{ fontSize: 72, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h5" color="text.secondary" gutterBottom>
            Organization Wiki
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            sx={{ maxWidth: 480 }}
          >
            Select a page from the sidebar to start reading, or create a new page to begin
            documenting your organization&apos;s knowledge.
          </Typography>
        </Box>
      );
    }

    // Loading
    if (pageLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      );
    }

    // Error
    if (pageError) {
      return (
        <Box sx={{ p: 4 }}>
          <Alert severity="error">Failed to load page. It may have been deleted or moved.</Alert>
        </Box>
      );
    }

    // Page not found
    if (!page) {
      return (
        <Box sx={{ p: 4 }}>
          <Alert severity="warning">Page not found.</Alert>
        </Box>
      );
    }

    // Editing
    if (editing) {
      return (
        <WikiPageEditor
          page={page}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          saving={updatePage.isPending}
        />
      );
    }

    // Viewing
    return (
      <WikiPageViewer
        page={page}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onHistory={() => setHistoryOpen(true)}
      />
    );
  };

  // ── Layout ───────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Mobile: hamburger + drawer */}
      {isMobile ? (
        <>
          <IconButton
            onClick={() => setMobileDrawerOpen(true)}
            sx={{ position: 'fixed', top: 72, left: 8, zIndex: theme.zIndex.drawer + 1 }}
          >
            <MenuIcon />
          </IconButton>
          <Drawer
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH } } }}
          >
            {sidebarContent}
          </Drawer>
        </>
      ) : (
        /* Desktop: persistent sidebar */
        <Box
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            height: '100%',
          }}
        >
          {sidebarContent}
        </Box>
      )}

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          ml: isMobile ? 0 : undefined,
        }}
      >
        {renderContent()}
      </Box>

      {/* Revision history dialog */}
      {pageId && (
        <WikiRevisionHistory
          pageId={pageId}
          currentContent={page?.content ?? ''}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestore}
          restoring={restoreRevision.isPending}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        {...dialogProps}
        title="Delete Wiki Page"
        message="Are you sure you want to delete this page? This action cannot be undone. All child pages will also be deleted."
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

// ─── Error Boundary Wrapper ────────────────────────────────────

export const WikiPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Wiki">
    <WikiPage />
  </FeatureErrorBoundary>
);

export { WikiPage };
