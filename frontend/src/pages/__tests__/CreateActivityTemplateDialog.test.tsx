import { render, screen, waitFor } from '@/test-utils/test-utils';
import { userEvent } from '@testing-library/user-event';

import type { ActivityTemplate } from '@/types/apiV2';
import { ActivityTemplateCategory } from '@/types/apiV2';

// ── Mock hooks ──────────────────────────────────────────────────────────

const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();

const mockUseCreateActivityTemplate = jest.fn();
const mockUseUpdateActivityTemplate = jest.fn();

jest.mock('../../hooks/queries/useActivityTemplateQueries', () => ({
  useCreateActivityTemplate: () => mockUseCreateActivityTemplate(),
  useUpdateActivityTemplate: () => mockUseUpdateActivityTemplate(),
}));

jest.mock('../../hooks/queries/useShipCatalogueQueries', () => ({
  useShipCatalogue: () => ({ data: { items: [] }, isLoading: false }),
}));

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// ── Test data ───────────────────────────────────────────────────────────

const mockTemplate: ActivityTemplate = {
  id: 'tpl-1',
  name: 'Mining Op Template',
  description: 'A reusable mining operation template',
  activityType: 'mining',
  category: ActivityTemplateCategory.MINING,
  tags: ['mining', 'group'],
  isPublic: true,
  isActive: true,
  usageCount: 5,
  organizationId: 'org-1',
  createdBy: 'user-1',
  createdByName: null,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-16T00:00:00Z',
  templateData: {},
};

// ── Import component AFTER mocks ────────────────────────────────────────

import { CreateActivityTemplateDialog } from '../CreateActivityTemplateDialog';

// ── Helpers ─────────────────────────────────────────────────────────────

function setupDefaultMocks(overrides?: { createPending?: boolean; updatePending?: boolean }) {
  const { createPending = false, updatePending = false } = overrides ?? {};

  mockUseCreateActivityTemplate.mockReturnValue({
    mutateAsync: mockCreateMutateAsync,
    isPending: createPending,
  });

  mockUseUpdateActivityTemplate.mockReturnValue({
    mutateAsync: mockUpdateMutateAsync,
    isPending: updatePending,
  });
}

const defaultProps = {
  open: true,
  onClose: jest.fn(),
};

// ── Tests ───────────────────────────────────────────────────────────────

describe('CreateActivityTemplateDialog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupDefaultMocks();
    mockCreateMutateAsync.mockResolvedValue({ id: 'new-tpl' });
    mockUpdateMutateAsync.mockResolvedValue({ id: 'tpl-1' });
  });

  // ── Create mode rendering ─────────────────────────────────────────────

  describe('create mode', () => {
    it('renders create dialog title', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByText('Create Activity Template')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByLabelText(/Template Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tags/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Make template public/i)).toBeInTheDocument();
    });

    it('renders Create Template button', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Create Template/i })).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('disables submit when name is empty', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Template/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit when name is provided', async () => {
      const user = userEvent.setup();
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/Template Name/i);
      await user.type(nameInput, 'My Template');

      const submitButton = screen.getByRole('button', { name: /Create Template/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('calls createTemplate on submit', async () => {
      const user = userEvent.setup();
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Template Name/i), 'My Template');
      await user.click(screen.getByRole('button', { name: /Create Template/i }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'My Template' })
        );
      });
    });

    it('calls onClose after successful create', async () => {
      const user = userEvent.setup();
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Template Name/i), 'My Template');
      await user.click(screen.getByRole('button', { name: /Create Template/i }));

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows Creating… when pending', () => {
      setupDefaultMocks({ createPending: true });
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Creating…/i })).toBeInTheDocument();
    });
  });

  // ── Edit mode rendering ───────────────────────────────────────────────

  describe('edit mode', () => {
    it('renders Edit Template title when template is provided', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} template={mockTemplate} />);

      expect(screen.getByText('Edit Template')).toBeInTheDocument();
    });

    it('pre-fills form with template data', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} template={mockTemplate} />);

      expect(screen.getByLabelText(/Template Name/i)).toHaveValue('Mining Op Template');
      expect(screen.getByLabelText(/Description/i)).toHaveValue(
        'A reusable mining operation template'
      );
    });

    it('renders Save Changes button in edit mode', () => {
      render(<CreateActivityTemplateDialog {...defaultProps} template={mockTemplate} />);

      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    it('calls updateTemplate on submit in edit mode', async () => {
      const user = userEvent.setup();
      render(<CreateActivityTemplateDialog {...defaultProps} template={mockTemplate} />);

      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            templateId: 'tpl-1',
            data: expect.objectContaining({ name: 'Mining Op Template' }),
          })
        );
      });
    });

    it('shows Saving… when update is pending', () => {
      setupDefaultMocks({ updatePending: true });
      render(<CreateActivityTemplateDialog {...defaultProps} template={mockTemplate} />);

      expect(screen.getByRole('button', { name: /Saving…/i })).toBeInTheDocument();
    });
  });

  // ── Cancel / close ────────────────────────────────────────────────────

  describe('cancel and close', () => {
    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateActivityTemplateDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not render when open is false', () => {
      const { container } = render(
        <CreateActivityTemplateDialog open={false} onClose={jest.fn()} />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('logs error when create fails', async () => {
      mockCreateMutateAsync.mockRejectedValue(new Error('Network error'));
      const { logger } = jest.requireMock('../../utils/logger');
      const user = userEvent.setup();

      render(<CreateActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Template Name/i), 'My Template');
      await user.click(screen.getByRole('button', { name: /Create Template/i }));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('create'),
          expect.any(Error)
        );
      });
    });

    it('does not close dialog when create fails', async () => {
      mockCreateMutateAsync.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();

      render(<CreateActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Template Name/i), 'My Template');
      await user.click(screen.getByRole('button', { name: /Create Template/i }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalled();
      });

      // onClose should NOT be called when create fails
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });
});
