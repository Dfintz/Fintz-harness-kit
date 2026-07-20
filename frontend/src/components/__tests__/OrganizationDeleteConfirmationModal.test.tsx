import { OrganizationDeleteConfirmationModal } from '@/components/OrganizationDeleteConfirmationModal';
import { apiClient } from '@/services/apiClient';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const theme = createTheme();

// Mock apiClient
jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  isApiClientError: jest.fn(),
  getErrorMessage: jest.fn(),
}));

// Mock authStore - user without 2FA
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(selector => {
    const state = { user: { id: 'user-1', twoFactorEnabled: false } };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock 2FA helper
jest.mock('@/utils/twoFactorHelper', () => ({
  executeWith2FA: jest.fn(async (_code: string | null, apiCall: () => Promise<void>) => apiCall()),
  is2FAError: jest.fn(() => false),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Helper to wrap component with Spectrum ThemeProvider
const renderWithThemeProvider = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('OrganizationDeleteConfirmationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps = {
    organizationId: 'org-123',
    organizationName: 'Test Organization',
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    deleteDescendants: false,
  };

  const mockDeletionPreBox = {
    organizationId: 'org-123',
    organizationName: 'Test Organization',
    descendantCount: 2,
    memberCount: 50,
    shipCount: 150,
    estimatedDataSize: '500 KB',
    willDeleteDescendants: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal when isOpen is true', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText('Delete Organization').length).toBeGreaterThan(0);
    });
  });

  it('should not render when isOpen is false', () => {
    renderWithThemeProvider(
      <OrganizationDeleteConfirmationModal {...defaultProps} isOpen={false} />
    );

    // Modal should not be visible
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('should fetch deletion preBox when modal opens', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/organizations/org-123/deletion-preview',
        expect.objectContaining({
          params: { deleteDescendants: false },
        })
      );
    });
  });

  it('should display deletion preBox data', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/50 will lose access/i)).toBeInTheDocument();
      expect(screen.getByText(/150 will be removed/i)).toBeInTheDocument();
      expect(screen.getByText(/500 KB/i)).toBeInTheDocument();
    });
  });

  it('should display loading state while fetching preBox', () => {
    // Never resolving promise to simulate loading state
    (mockedApiClient.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    expect(screen.getByText(/Loading deletion impact/i)).toBeInTheDocument();
  });

  it('should display error when preBox fetch fails', async () => {
    const errorMessage = 'Failed to load preBox';
    (mockedApiClient.get as jest.Mock).mockRejectedValue({
      response: { data: { error: errorMessage } },
    });

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
    });
  });

  it('should require typing DELETE-organization name to confirm', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/50 will lose access/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /Delete Organization/i });

    // Button should be disabled initially
    expect(deleteButton).toBeDisabled();

    // Type incorrect format
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Test Organization');

    // Button should still be disabled
    expect(deleteButton).toBeDisabled();

    // Clear and type correct format
    await userEvent.clear(input);
    await userEvent.type(input, 'DELETE-Test Organization');

    // Button should be enabled
    expect(deleteButton).not.toBeDisabled();
  });

  it('should call onConfirm when delete button is clicked with valid confirmation', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });
    mockOnConfirm.mockResolvedValue(undefined);

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/50 will lose access/i)).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'DELETE-Test Organization');

    const deleteButton = screen.getByRole('button', { name: /Delete Organization/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalled();
    });
  });

  it('should call onClose when cancel button is clicked', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/50 will lose access/i)).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display warning about irreversibility', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Warning: This action cannot be undone!/i)).toBeInTheDocument();
    });
  });

  it('should show descendant count when deleteDescendants is true', async () => {
    const preBoxWithDescendants = {
      ...mockDeletionPreBox,
      willDeleteDescendants: true,
      descendantCount: 3,
    };

    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: preBoxWithDescendants },
    });

    renderWithThemeProvider(
      <OrganizationDeleteConfirmationModal {...defaultProps} deleteDescendants={true} />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 will also be deleted/i)).toBeInTheDocument();
    });
  });

  it('should disable delete button while deleting', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });
    // Never resolving promise to simulate deleting state
    mockOnConfirm.mockImplementation(() => new Promise(() => {}));

    renderWithThemeProvider(<OrganizationDeleteConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/50 will lose access/i)).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'DELETE-Test Organization');

    const deleteButton = screen.getByRole('button', { name: /Delete Organization/i });
    await userEvent.click(deleteButton);

    // Button should show "Deleting..." and be disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Deleting.../i })).toBeDisabled();
    });
  });

  it('should reset confirmation text when modal closes and reopens', async () => {
    (mockedApiClient.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: mockDeletionPreBox },
    });

    const { rerender } = renderWithThemeProvider(
      <OrganizationDeleteConfirmationModal {...defaultProps} />
    );

    await waitFor(() => {
      expect(screen.getByText(/50 will lose access/i)).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Test Organization');

    // Close modal
    rerender(
      <ThemeProvider theme={theme}>
        <OrganizationDeleteConfirmationModal {...defaultProps} isOpen={false} />
      </ThemeProvider>
    );

    // Reopen modal
    rerender(
      <ThemeProvider theme={theme}>
        <OrganizationDeleteConfirmationModal {...defaultProps} isOpen={true} />
      </ThemeProvider>
    );

    await waitFor(() => {
      const newInput = screen.getByRole('textbox');
      expect(newInput).toHaveValue('');
    });
  });
});
