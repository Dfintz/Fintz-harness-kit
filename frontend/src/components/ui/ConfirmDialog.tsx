import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

/**
 * Props for the ConfirmDialog component
 */
export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Title displayed in the dialog header */
  title?: string;
  /** Message displayed in the dialog body */
  message: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Color of the confirm button */
  confirmColor?: 'error' | 'primary' | 'warning' | 'success';
  /** Whether the confirm action is in progress */
  loading?: boolean;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Callback when user cancels or closes the dialog */
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog component.
 *
 * Replaces browser-native `window.confirm()` with an accessible MUI dialog.
 * Supports loading state for async confirm actions.
 *
 * @example
 * ```tsx
 * const [confirmOpen, setConfirmOpen] = useState(false);
 *
 * <ConfirmDialog
 *   open={confirmOpen}
 *   title="Delete Item"
 *   message="Are you sure you want to delete this item?"
 *   confirmLabel="Delete"
 *   confirmColor="error"
 *   onConfirm={() => { handleDelete(); setConfirmOpen(false); }}
 *   onCancel={() => setConfirmOpen(false)}
 * />
 * ```
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'error',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading}
          autoFocus
        >
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Hook for managing confirm dialog state.
 *
 * Returns state and helpers to open/close a confirm dialog with
 * an associated data payload (e.g., the ID of the item to delete).
 *
 * @example
 * ```tsx
 * const { dialogProps, openDialog, pendingData } = useConfirmDialog<string>();
 *
 * const handleDelete = (id: string) => {
 *   openDialog(id);
 * };
 *
 * const onConfirm = async () => {
 *   if (pendingData) await deleteItem(pendingData);
 *   dialogProps.onCancel(); // close
 * };
 *
 * <ConfirmDialog {...dialogProps} onConfirm={onConfirm} message="Delete?" />
 * ```
 */
export function useConfirmDialog<T = void>() {
  const [open, setOpen] = React.useState(false);
  const [pendingData, setPendingData] = React.useState<T | null>(null);

  const openDialog = React.useCallback((data?: T) => {
    setPendingData(data ?? null);
    setOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setOpen(false);
    setPendingData(null);
  }, []);

  return {
    open,
    pendingData,
    openDialog,
    closeDialog,
    dialogProps: {
      open,
      onCancel: closeDialog,
    },
  };
}
