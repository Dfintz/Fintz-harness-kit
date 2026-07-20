import { render, screen, waitFor } from '@/test-utils/test-utils';
import { userEvent } from '@testing-library/user-event';

import type { ActivityTemplate } from '@/types/apiV2';
import { ActivityTemplateCategory } from '@/types/apiV2';

// ── Mock hooks ──────────────────────────────────────────────────────────

const mockApplyMutateAsync = jest.fn();
const mockUseApplyActivityTemplate = jest.fn();

jest.mock('../../hooks/queries/useActivityTemplateQueries', () => ({
  useApplyActivityTemplate: () => mockUseApplyActivityTemplate(),
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
  tags: ['mining'],
  isPublic: true,
  isActive: true,
  usageCount: 3,
  organizationId: 'org-1',
  createdBy: 'user-1',
  createdByName: null,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-16T00:00:00Z',
  templateData: { estimatedDuration: 120, maxParticipants: 10 },
};

// ── Import component AFTER mocks ────────────────────────────────────────

import { ApplyActivityTemplateDialog } from '../ApplyActivityTemplateDialog';

// ── Helpers ─────────────────────────────────────────────────────────────

function setupDefaultMocks(overrides?: { isPending?: boolean }) {
  const { isPending = false } = overrides ?? {};
  mockUseApplyActivityTemplate.mockReturnValue({
    mutateAsync: mockApplyMutateAsync,
    isPending,
  });
}

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  template: mockTemplate,
};

// ── Tests ───────────────────────────────────────────────────────────────

describe('ApplyActivityTemplateDialog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupDefaultMocks();
    mockApplyMutateAsync.mockResolvedValue({ id: 'activity-1' });
  });

  // ── Rendering ─────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders dialog title', () => {
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByText('Apply Template')).toBeInTheDocument();
    });

    it('shows template name in description', () => {
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByText(/Mining Op Template/)).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByLabelText(/Activity Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Scheduled Start Time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Estimated Duration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Max Participants/i)).toBeInTheDocument();
    });

    it('pre-fills duration from template data', () => {
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByLabelText(/Estimated Duration/i)).toHaveValue(120);
    });

    it('pre-fills max participants from template data', () => {
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByLabelText(/Max Participants/i)).toHaveValue(10);
    });

    it('returns null when template is null', () => {
      const { container } = render(
        <ApplyActivityTemplateDialog open={true} onClose={jest.fn()} template={null} />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  // ── Validation ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('disables submit when title is empty', () => {
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Activity/i });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit when scheduled start time is empty', async () => {
      const user = userEvent.setup();
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Activity Title/i), 'My Activity');

      // Start time is still empty
      const submitButton = screen.getByRole('button', { name: /Create Activity/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit when title and start time are provided', async () => {
      const user = userEvent.setup();
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Activity Title/i), 'My Activity');
      await user.type(screen.getByLabelText(/Scheduled Start Time/i), '2026-02-01T20:00');

      const submitButton = screen.getByRole('button', { name: /Create Activity/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  // ── Submit ────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('calls applyTemplate with correct data', async () => {
      const user = userEvent.setup();
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Activity Title/i), 'Friday Mining');
      await user.type(screen.getByLabelText(/Scheduled Start Time/i), '2026-02-01T20:00');
      await user.click(screen.getByRole('button', { name: /Create Activity/i }));

      await waitFor(() => {
        expect(mockApplyMutateAsync).toHaveBeenCalledWith({
          templateId: 'tpl-1',
          data: expect.objectContaining({ title: 'Friday Mining' }),
        });
      });
    });

    it('calls onClose after successful apply', async () => {
      const user = userEvent.setup();
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Activity Title/i), 'Mining Run');
      await user.type(screen.getByLabelText(/Scheduled Start Time/i), '2026-02-01T20:00');
      await user.click(screen.getByRole('button', { name: /Create Activity/i }));

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows Creating Activity… when pending', () => {
      setupDefaultMocks({ isPending: true });
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Creating Activity…/i })).toBeInTheDocument();
    });
  });

  // ── Cancel ────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('logs error when apply fails', async () => {
      mockApplyMutateAsync.mockRejectedValue(new Error('Apply failed'));
      const { logger } = jest.requireMock('../../utils/logger');
      const user = userEvent.setup();

      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Activity Title/i), 'Mining Run');
      await user.type(screen.getByLabelText(/Scheduled Start Time/i), '2026-02-01T20:00');
      await user.click(screen.getByRole('button', { name: /Create Activity/i }));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('apply'),
          expect.any(Error)
        );
      });
    });

    it('does not close dialog when apply fails', async () => {
      mockApplyMutateAsync.mockRejectedValue(new Error('Apply failed'));
      const user = userEvent.setup();

      render(<ApplyActivityTemplateDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/Activity Title/i), 'Mining Run');
      await user.type(screen.getByLabelText(/Scheduled Start Time/i), '2026-02-01T20:00');
      await user.click(screen.getByRole('button', { name: /Create Activity/i }));

      await waitFor(() => {
        expect(mockApplyMutateAsync).toHaveBeenCalled();
      });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });
});
