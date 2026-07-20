import { render, screen, waitFor, within } from '@/test-utils/test-utils';
import { userEvent } from '@testing-library/user-event';

import type { ActivityTemplate } from '@/types/apiV2';

// ── Mock hooks ──────────────────────────────────────────────────────────

const mockUseActivityTemplates = jest.fn();
const mockUseDeleteActivityTemplate = jest.fn();
const mockUseCloneActivityTemplate = jest.fn();

jest.mock('../../hooks/queries/useActivityTemplateQueries', () => ({
  useActivityTemplates: (...args: unknown[]) => mockUseActivityTemplates(...args),
  useDeleteActivityTemplate: () => mockUseDeleteActivityTemplate(),
  useCloneActivityTemplate: () => mockUseCloneActivityTemplate(),
}));

// Mock child dialogs to avoid deep rendering
jest.mock('../CreateActivityTemplateDialog', () => ({
  CreateActivityTemplateDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="create-dialog">
        <button onClick={onClose}>close-create</button>
      </div>
    ) : null,
}));

jest.mock('../ApplyActivityTemplateDialog', () => ({
  ApplyActivityTemplateDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="apply-dialog">
        <button onClick={onClose}>close-apply</button>
      </div>
    ) : null,
}));

// Mock logger to prevent console noise
jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// ── Test data ───────────────────────────────────────────────────────────

const mockTemplate: ActivityTemplate = {
  id: 'tpl-1',
  name: 'Mining Op Template',
  description: 'A reusable mining operation template',
  activityType: 'mining',
  category: 'MINING' as ActivityTemplate['category'],
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

const secondTemplate: ActivityTemplate = {
  id: 'tpl-2',
  name: 'Combat Patrol',
  description: 'Combat patrol template',
  activityType: 'combat',
  category: 'COMBAT' as ActivityTemplate['category'],
  tags: ['combat'],
  isPublic: false,
  isActive: true,
  usageCount: 2,
  organizationId: 'org-1',
  createdBy: 'user-1',
  createdByName: null,
  createdAt: '2026-01-10T00:00:00Z',
  updatedAt: '2026-01-11T00:00:00Z',
  templateData: {},
};

// ── Import page AFTER mocks ─────────────────────────────────────────────

import { ActivityTemplatesPageWithErrorBoundary } from '../ActivityTemplatesPage';

// ── Helpers ─────────────────────────────────────────────────────────────

const deleteMutateAsync = jest.fn();
const cloneMutateAsync = jest.fn();

function setupDefaultMocks(overrides?: {
  templates?: ActivityTemplate[];
  isLoading?: boolean;
  error?: Error | null;
}) {
  const {
    templates = [mockTemplate, secondTemplate],
    isLoading = false,
    error = null,
  } = overrides ?? {};

  mockUseActivityTemplates.mockReturnValue({
    data: templates.length > 0 ? { templates, total: templates.length } : undefined,
    isLoading,
    error,
  });

  mockUseDeleteActivityTemplate.mockReturnValue({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  });

  mockUseCloneActivityTemplate.mockReturnValue({
    mutateAsync: cloneMutateAsync,
    isPending: false,
  });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('ActivityTemplatesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ── Rendering ─────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the page header', async () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Activity Templates')).toBeInTheDocument();
      });
    });

    it('renders the Create Template button', async () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Template/i })).toBeInTheDocument();
      });
    });

    it('renders search and category filter controls', async () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Mining Op Template')).toBeInTheDocument();
      });

      // Search input: MUI TextField
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      // Category select: MUI Select renders as combobox
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders template cards with names', async () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Mining Op Template')).toBeInTheDocument();
        expect(screen.getByText('Combat Patrol')).toBeInTheDocument();
      });
    });

    it('renders template descriptions', async () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('A reusable mining operation template')).toBeInTheDocument();
        expect(screen.getByText('Combat patrol template')).toBeInTheDocument();
      });
    });

    it('renders category chips on template cards', async () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('MINING')).toBeInTheDocument();
        expect(screen.getByText('COMBAT')).toBeInTheDocument();
      });
    });

    it('renders action buttons on each template card', async () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        // Each template card should have Apply, Clone, Edit, Delete buttons
        const applyButtons = screen.getAllByLabelText('Apply template');
        const cloneButtons = screen.getAllByLabelText('Clone');
        const editButtons = screen.getAllByLabelText('Edit');
        const deleteButtons = screen.getAllByLabelText('Delete');

        expect(applyButtons).toHaveLength(2);
        expect(cloneButtons).toHaveLength(2);
        expect(editButtons).toHaveLength(2);
        expect(deleteButtons).toHaveLength(2);
      });
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows CircularProgress when loading', () => {
      setupDefaultMocks({ isLoading: true, templates: [] });
      render(<ActivityTemplatesPageWithErrorBoundary />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('does not render template cards while loading', () => {
      setupDefaultMocks({ isLoading: true, templates: [] });
      render(<ActivityTemplatesPageWithErrorBoundary />);

      expect(screen.queryByText('Mining Op Template')).not.toBeInTheDocument();
    });
  });

  // ── Error state ───────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error alert when query fails', () => {
      setupDefaultMocks({ error: new Error('Network error'), templates: [] });
      render(<ActivityTemplatesPageWithErrorBoundary />);

      expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows info alert when no templates match', () => {
      setupDefaultMocks({ templates: [] });
      render(<ActivityTemplatesPageWithErrorBoundary />);

      expect(screen.getByText(/No templates found/i)).toBeInTheDocument();
    });
  });

  // ── Interactions ──────────────────────────────────────────────────────

  describe('interactions', () => {
    it('opens Create Template dialog when button clicked', async () => {
      const user = userEvent.setup();
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Mining Op Template')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Template/i }));

      expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
    });

    it('calls cloneMutateAsync when clone button clicked', async () => {
      const user = userEvent.setup();
      cloneMutateAsync.mockResolvedValue({ ...mockTemplate, id: 'tpl-cloned' });
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Mining Op Template')).toBeInTheDocument();
      });

      const cloneButtons = screen.getAllByLabelText('Clone');
      await user.click(cloneButtons[0]);

      expect(cloneMutateAsync).toHaveBeenCalledWith('tpl-1');
    });

    it('opens Apply dialog when apply button clicked', async () => {
      const user = userEvent.setup();
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Mining Op Template')).toBeInTheDocument();
      });

      const applyButtons = screen.getAllByLabelText('Apply template');
      await user.click(applyButtons[0]);

      expect(screen.getByTestId('apply-dialog')).toBeInTheDocument();
    });

    it('opens edit dialog when edit button clicked', async () => {
      const user = userEvent.setup();
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Mining Op Template')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByLabelText('Edit');
      await user.click(editButtons[0]);

      // Edit dialog uses the same CreateActivityTemplateDialog
      expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
    });

    it('opens confirm dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      render(<ActivityTemplatesPageWithErrorBoundary />);

      await waitFor(() => {
        expect(screen.getByText('Mining Op Template')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText('Delete');
      await user.click(deleteButtons[0]);

      // ConfirmDialog renders "Delete Template" title
      await waitFor(() => {
        expect(screen.getByText('Delete Template')).toBeInTheDocument();
      });
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────

  describe('pagination', () => {
    it('does not show pagination with few templates', () => {
      setupDefaultMocks({ templates: [mockTemplate] });
      render(<ActivityTemplatesPageWithErrorBoundary />);

      // With 1 template and PAGE_SIZE=12, pagination has 1 page
      const pagination = screen.queryByRole('navigation');
      // Even with 1 page Pagination still renders, but count=1
      if (pagination) {
        const buttons = within(pagination).queryAllByRole('button');
        // Only page 1 (plus prev/next arrows)
        expect(buttons.length).toBeLessThanOrEqual(3);
      }
    });
  });

  // ── Filter integration with hook ──────────────────────────────────────

  describe('filter propagation', () => {
    it('passes filters to useActivityTemplates', () => {
      render(<ActivityTemplatesPageWithErrorBoundary />);

      // On initial render, filters should be the default
      expect(mockUseActivityTemplates).toHaveBeenCalled();

      const lastCallArgs =
        mockUseActivityTemplates.mock.calls[mockUseActivityTemplates.mock.calls.length - 1];
      const filters = lastCallArgs[0];

      // Default: no search, no category filter, page=1
      expect(filters).toMatchObject({
        page: 1,
        limit: 12,
      });
    });
  });
});
