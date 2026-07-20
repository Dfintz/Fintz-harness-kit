/**
 * Modal Component - Unified modal/dialog component for the SC Fleet Manager Design System
 *
 * This component provides a consistent modal interface using MUI's
 * Dialog component for accessible, modern modals.
 */

import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from '@mui/material';
import React from 'react';
import { IconButton } from './IconButton';

export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Title of the modal */
  title?: React.ReactNode;
  /** Content to display in the modal footer */
  footer?: React.ReactNode;
  /** Size of the modal */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether to show a close button in the header */
  showCloseButton?: boolean;
  /** Whether clicking outside the modal closes it */
  closeOnOverlayClick?: boolean;
  /** Modal content */
  children?: React.ReactNode;
}

// Map our size names to Spectrum sizes
const getSizeStyles = (size: string): React.CSSProperties => {
  switch (size) {
    case 'sm':
      return { maxWidth: '400px' };
    case 'md':
      return { maxWidth: '600px' };
    case 'lg':
      return { maxWidth: '800px' };
    case 'xl':
      return { maxWidth: '1000px' };
    case 'full':
      return { width: '95vw', maxWidth: '95vw' };
    default:
      return { maxWidth: '600px' };
  }
};

/**
 * Modal component with consistent styling across the application.
 *
 * @example
 * // Basic modal
 * <Modal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   footer={
 *     <>
 *       <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
 *       <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
 *     </>
 *   }
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  footer,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  children,
}: Readonly<ModalProps>): React.ReactElement {
  const sizeStyles = getSizeStyles(size);

  return (
    <Dialog
      open={isOpen}
      onClose={closeOnOverlayClick ? onClose : undefined}
      maxWidth={false}
      disableRestoreFocus
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(4px)',
          },
        },
        paper: {
          sx: {
            ...sizeStyles,
            bgcolor: 'background.paper',
            color: 'common.white',
          },
        },
      }}
    >
      {title && (
        <>
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography sx={{ margin: 0, color: 'primary.main' }}>{title}</Typography>
              {showCloseButton && (
                <IconButton
                  isQuiet
                  onClick={onClose}
                  aria-label="Close"
                  sx={{ marginRight: '-8px' }}
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Box>
          </DialogTitle>
          <Divider />
        </>
      )}
      <DialogContent sx={{ paddingTop: title ? '16px' : undefined }}>{children}</DialogContent>
      {footer && (
        <>
          <Divider />
          <DialogActions sx={{ paddingTop: '16px' }}>{footer}</DialogActions>
        </>
      )}
    </Dialog>
  );
}
