/**
 * ConsentWithdrawalDialog Component Tests
 */

import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ConsentType } from '@/services/consentService';
import { theme } from '@/theme';
import { ConsentWithdrawalDialog } from '@/components/ConsentWithdrawalDialog';
// Mock the consent service
jest.mock('../../services/consentService', () => ({
  consentService: {
    withdrawConsent: jest.fn().mockResolvedValue({ message: 'Success' }),
    withdrawAllConsents: jest.fn().mockResolvedValue(undefined),
    requestAccountDeletion: jest.fn().mockResolvedValue({ message: 'Success' }),
    downloadUserData: jest.fn().mockResolvedValue(undefined),
  },
  ConsentType: {
    ESSENTIAL: 'essential',
    ANALYTICS: 'analytics',
    MARKETING: 'marketing',
    THIRD_PARTY: 'third_party',
    DATA_PROCESSING: 'data_processing',
  },
}));

// Wrapper with Spectrum ThemeProvider
const renderWithThemeProvider = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('ConsentWithdrawalDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Consent Withdrawal', () => {
    it('should render the dialog when open', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog
          open={true}
          onClose={mockOnClose}
          withdrawalType="consent"
          consentType={ConsentType.ANALYTICS}
        />
      );

      expect(screen.getByText('Withdraw Consent')).toBeInTheDocument();
    });

    it('should display information step first', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog
          open={true}
          onClose={mockOnClose}
          withdrawalType="consent"
          consentType={ConsentType.ANALYTICS}
        />
      );

      expect(screen.getByText(/You are withdrawing consent for:/)).toBeInTheDocument();
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('should proceed to confirmation step when Continue is clicked', async () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog
          open={true}
          onClose={mockOnClose}
          withdrawalType="consent"
          consentType={ConsentType.ANALYTICS}
        />
      );

      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText(/Please confirm your action/)).toBeInTheDocument();
      });
    });

    it('should call onClose when Cancel is clicked', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={true} onClose={mockOnClose} withdrawalType="consent" />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not render when closed', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={false} onClose={mockOnClose} withdrawalType="consent" />
      );

      expect(screen.queryByText('Withdraw Consent')).not.toBeInTheDocument();
    });
  });

  describe('Account Deletion', () => {
    it('should show account deletion warning', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={true} onClose={mockOnClose} withdrawalType="account" />
      );

      expect(screen.getByText('Delete Account')).toBeInTheDocument();
      expect(screen.getByText(/Account deletion is permanent/)).toBeInTheDocument();
    });

    it('should show download data button for account deletion', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={true} onClose={mockOnClose} withdrawalType="account" />
      );

      expect(screen.getByText('Download My Data')).toBeInTheDocument();
    });

    it('should list what will be deleted', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={true} onClose={mockOnClose} withdrawalType="account" />
      );

      expect(screen.getByText(/All your personal data will be deleted/)).toBeInTheDocument();
      expect(screen.getByText(/Organization memberships will be removed/)).toBeInTheDocument();
    });
  });

  describe('Confirmation Flow', () => {
    it('should require checkbox and confirmation text', async () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={true} onClose={mockOnClose} withdrawalType="consent" />
      );

      // Go to confirmation step
      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        // React Spectrum buttons are disabled differently
        const confirmButton = screen.getByRole('button', { name: /Confirm/ });
        expect(confirmButton).toHaveAttribute('disabled');
      });
    });

    it('should show stepper with three steps', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={true} onClose={mockOnClose} withdrawalType="consent" />
      );

      expect(screen.getByText('Information')).toBeInTheDocument();
      expect(screen.getByText('Confirmation')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog structure', () => {
      renderWithThemeProvider(
        <ConsentWithdrawalDialog open={true} onClose={mockOnClose} withdrawalType="consent" />
      );

      // React Spectrum Dialog has different aria attributes
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
