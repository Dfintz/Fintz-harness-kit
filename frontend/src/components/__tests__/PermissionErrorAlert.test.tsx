/**
 * PermissionErrorAlert Component Tests
 *
 * Tests for:
 * - Component rendering with permission context
 * - Helper functions (extractPermissionContext, formatPermissionKey)
 * - User interactions (contact admin, help dialog)
 * - Fallbacks for missing context
 */

import { ApiClientError } from '@/services/apiClient';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  PermissionErrorAlert,
  extractPermissionContext,
  formatPermissionKey,
} from '../PermissionErrorAlert';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

/**
 * Helper to create mock ApiClientError
 */
function createPermissionError(
  resource: string = 'fleet',
  action: string = 'edit',
  message: string = 'Access denied'
): ApiClientError {
  return new ApiClientError(message, 'FORBIDDEN', 403, 'req-123', {
    permission: { resource, action, scope: 'org-123' },
    requiredPermission: `${resource}:${action}`,
  } as Record<string, unknown>);
}

describe('PermissionErrorAlert', () => {
  describe('Component Rendering', () => {
    it('renders alert with permission context', () => {
      const error = createPermissionError('fleet', 'edit');
      renderWithTheme(<PermissionErrorAlert error={error} />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText(/required permission/i)).toBeInTheDocument();
      expect(screen.getByText('Fleet: Edit')).toBeInTheDocument();
    });

    it('renders generic alert when missing permission context', () => {
      const error = new ApiClientError('Access denied', 'FORBIDDEN', 403);
      renderWithTheme(<PermissionErrorAlert error={error} />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      // Error message (lowercase 'd') rendered separately from AlertTitle
      expect(screen.getByText('Access denied')).toBeInTheDocument();
    });

    it('displays custom title', () => {
      const error = createPermissionError('fleet', 'delete');
      renderWithTheme(<PermissionErrorAlert error={error} title="Custom Access Denied" />);

      expect(screen.getByText('Custom Access Denied')).toBeInTheDocument();
    });

    it('displays custom message', () => {
      const error = createPermissionError('ship', 'manage');
      const customMsg = 'This action requires admin privileges';
      renderWithTheme(<PermissionErrorAlert error={error} message={customMsg} />);

      expect(screen.getByText(customMsg)).toBeInTheDocument();
    });
  });

  describe('Button Interactions', () => {
    it('calls onContactAdmin when button clicked', () => {
      const onContactAdmin = jest.fn();
      const error = createPermissionError();
      renderWithTheme(<PermissionErrorAlert error={error} onContactAdmin={onContactAdmin} />);

      const requestButton = screen.getByRole('button', { name: /request access/i });
      fireEvent.click(requestButton);

      expect(onContactAdmin).toHaveBeenCalled();
    });

    it('calls onDismiss when dismiss triggered', () => {
      const onDismiss = jest.fn();
      const error = createPermissionError();
      renderWithTheme(<PermissionErrorAlert error={error} onDismiss={onDismiss} />);

      // MUI Alert's close button has aria-label="Close"
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalled();
    });

    it('only shows request button when onContactAdmin is provided', () => {
      const error = createPermissionError();
      renderWithTheme(<PermissionErrorAlert error={error} />);

      expect(screen.queryByRole('button', { name: /request access/i })).not.toBeInTheDocument();
    });

    it('shows email link when contactEmail is provided', () => {
      const error = createPermissionError();
      const contactEmail = 'admin@fleet.com';
      renderWithTheme(<PermissionErrorAlert error={error} contactEmail={contactEmail} />);

      const emailLink = screen.getByRole('link', { name: /email admin/i });
      expect(emailLink).toHaveAttribute('href', expect.stringContaining(`mailto:${contactEmail}`));
    });
  });

  describe('Help Dialog', () => {
    it('opens help dialog when Learn More clicked', async () => {
      const error = createPermissionError('activity', 'create');
      renderWithTheme(<PermissionErrorAlert error={error} showHelpOption={true} />);

      const learnMoreButton = screen.getByRole('button', { name: /learn more/i });
      fireEvent.click(learnMoreButton);

      expect(await screen.findByText(/Permission Denied/i)).toBeInTheDocument();
      expect(await screen.findByText(/How to Get Access/i)).toBeInTheDocument();
    });

    it('does not show help button when showHelpOption is false', () => {
      const error = createPermissionError();
      renderWithTheme(<PermissionErrorAlert error={error} showHelpOption={false} />);

      expect(screen.queryByRole('button', { name: /learn more/i })).not.toBeInTheDocument();
    });

    it('closes help dialog when Close button clicked', async () => {
      const error = createPermissionError('fleet', 'edit');
      renderWithTheme(<PermissionErrorAlert error={error} showHelpOption={true} />);

      const learnMoreButton = screen.getByRole('button', { name: /learn more/i });
      fireEvent.click(learnMoreButton);

      const closeButton = await screen.findByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      // Dialog should be hidden (wait for MUI transition)
      await waitFor(() => {
        expect(screen.queryByText(/How to Get Access/i)).not.toBeInTheDocument();
      });
    });

    it('help dialog includes resource ID when available', async () => {
      const error = new ApiClientError('Access denied', 'FORBIDDEN', 403, 'req-123', {
        permission: {
          resource: 'fleet',
          action: 'edit',
          scope: 'org-123',
          resourceId: 'fleet-456',
        },
      } as Record<string, unknown>);

      renderWithTheme(<PermissionErrorAlert error={error} showHelpOption={true} />);

      const learnMoreButton = screen.getByRole('button', { name: /learn more/i });
      fireEvent.click(learnMoreButton);

      expect(await screen.findByText('fleet-456')).toBeInTheDocument();
    });
  });

  describe('Helper Functions', () => {
    describe('extractPermissionContext', () => {
      it('extracts permission context from error', () => {
        const error = createPermissionError('ship', 'delete');
        const context = extractPermissionContext(error);

        expect(context).toEqual({
          resource: 'ship',
          action: 'delete',
          scope: 'org-123',
        });
      });

      it('returns null for non-403 errors', () => {
        const error = new ApiClientError('Not found', 'NOT_FOUND', 404);
        const context = extractPermissionContext(error);

        expect(context).toBeNull();
      });

      it('returns null when details missing', () => {
        const error = new ApiClientError('Access denied', 'FORBIDDEN', 403);
        const context = extractPermissionContext(error);

        expect(context).toBeNull();
      });

      it('returns null when permission field missing', () => {
        const error = new ApiClientError('Access denied', 'FORBIDDEN', 403, 'req-123', {
          other: 'data',
        } as Record<string, unknown>);
        const context = extractPermissionContext(error);

        expect(context).toBeNull();
      });
    });

    describe('formatPermissionKey', () => {
      it('formats single word resource and action', () => {
        const result = formatPermissionKey('fleet', 'edit');
        expect(result).toBe('Fleet: Edit');
      });

      it('capitalizes first letter', () => {
        expect(formatPermissionKey('ship', 'delete')).toBe('Ship: Delete');
        expect(formatPermissionKey('activity', 'create')).toBe('Activity: Create');
      });

      it('handles compound words', () => {
        expect(formatPermissionKey('organization', 'manage')).toBe('Organization: Manage');
        expect(formatPermissionKey('recruitment', 'approve')).toBe('Recruitment: Approve');
      });
    });
  });

  describe('Accessibility', () => {
    it('renders semantic alert role', () => {
      const error = createPermissionError();
      const { container } = renderWithTheme(<PermissionErrorAlert error={error} />);

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toBeInTheDocument();
    });

    it('provides descriptive button labels', () => {
      const error = createPermissionError();
      renderWithTheme(
        <PermissionErrorAlert error={error} onContactAdmin={() => {}} showHelpOption={true} />
      );

      expect(screen.getByRole('button', { name: /request access/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty resource name gracefully', () => {
      const error = new ApiClientError('Access denied', 'FORBIDDEN', 403, 'req-123', {
        permission: { resource: '', action: 'edit' },
      } as Record<string, unknown>);

      renderWithTheme(<PermissionErrorAlert error={error} />);

      expect(screen.getByText(': Edit')).toBeInTheDocument();
    });

    it('applies custom CSS class', () => {
      const error = createPermissionError();
      const { container } = renderWithTheme(
        <PermissionErrorAlert error={error} className="custom-class" />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });
});
