/**
 * WikiRevisionHistory component tests.
 *
 * Tests the revision history dialog: listing, selection, diff display,
 * restore action, and loading / error states.
 */

import { muiTheme } from '@/theme/muiTheme';
import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { WikiRevisionHistory } from '@/components/wiki/WikiRevisionHistory';
import type { WikiPageRevision } from '@sc-fleet-manager/shared-types';

// ─── Mocks ─────────────────────────────────────────────────────

const mockRevisions: WikiPageRevision[] = [
  {
    id: 'rev-3',
    pageId: 'page-1',
    content: '# Current Title\n\nCurrent body',
    editedBy: 'user-a',
    changeDescription: 'Latest update',
    version: 3,
    editedAt: '2026-02-15T10:00:00Z',
  },
  {
    id: 'rev-2',
    pageId: 'page-1',
    content: '# Old Title\n\nOld body',
    editedBy: 'user-b',
    changeDescription: 'Second edit',
    version: 2,
    editedAt: '2026-02-14T09:00:00Z',
  },
  {
    id: 'rev-1',
    pageId: 'page-1',
    content: '# First Title\n\nFirst body',
    editedBy: 'user-a',
    changeDescription: null,
    version: 1,
    editedAt: '2026-02-13T08:00:00Z',
  },
];

// Use a variable for revision data so we can override per test
let mockRevisionsData: WikiPageRevision[] = mockRevisions;
let mockRevisionsLoading = false;
let mockRevisionsError: Error | null = null;
let mockRevisionData: WikiPageRevision | undefined;
let mockRevisionLoading = false;

jest.mock('@/hooks/queries/useWikiQueries', () => ({
  useWikiRevisions: () => ({
    data: mockRevisionsData,
    isLoading: mockRevisionsLoading,
    error: mockRevisionsError,
  }),
  useWikiRevision: (_pageId: string, revisionId: string | undefined) => ({
    data: revisionId ? mockRevisionData : undefined,
    isLoading: mockRevisionLoading && !!revisionId,
  }),
}));

// ─── Helpers ───────────────────────────────────────────────────

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={muiTheme}>{ui}</ThemeProvider>);
}

const defaultProps = {
  pageId: 'page-1',
  currentContent: '# Current Title\n\nCurrent body',
  open: true,
  onClose: jest.fn(),
  onRestore: jest.fn(),
  restoring: false,
};

// ─── Tests ─────────────────────────────────────────────────────

describe('WikiRevisionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRevisionsData = mockRevisions;
    mockRevisionsLoading = false;
    mockRevisionsError = null;
    mockRevisionData = undefined;
    mockRevisionLoading = false;
  });

  it('renders the dialog title', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByText('Revision History')).toBeInTheDocument();
  });

  it('shows revision count', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByText('(3 revisions)')).toBeInTheDocument();
  });

  it('lists all revisions', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('marks the first revision as Current', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('shows change descriptions', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByText(/Latest update/)).toBeInTheDocument();
    expect(screen.getByText(/Second edit/)).toBeInTheDocument();
  });

  it('shows Restore button for non-current revisions', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    // Use getByTestId or filter to actual <button> elements (not ListItemButton divs)
    const allButtons = screen.getAllByRole('button', { name: /Restore/ });
    const restoreButtons = allButtons.filter(el => el.tagName === 'BUTTON');
    // 2 non-current revisions should each have a restore button
    expect(restoreButtons).toHaveLength(2);
  });

  it('does not show Restore button for the current revision', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    // The first list item (current) should NOT contain a Restore button
    const currentBadge = screen.getByText('Current');
    // Get the parent list item button
    const currentRow = currentBadge.closest('[role="button"]') as HTMLElement;
    expect(currentRow).toBeTruthy();
    expect(within(currentRow).queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument();
  });

  it('calls onRestore when Restore button is clicked', async () => {
    const user = userEvent.setup();
    const onRestore = jest.fn();

    renderWithTheme(<WikiRevisionHistory {...defaultProps} onRestore={onRestore} />);

    const allButtons = screen.getAllByRole('button', { name: /Restore/ });
    const restoreButtons = allButtons.filter(el => el.tagName === 'BUTTON');
    await user.click(restoreButtons[0]);

    expect(onRestore).toHaveBeenCalledWith('rev-2');
  });

  it('disables Restore buttons when restoring', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} restoring={true} />);

    const allButtons = screen.getAllByRole('button', { name: /Restore/ });
    const restoreButtons = allButtons.filter(el => el.tagName === 'BUTTON');
    restoreButtons.forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    renderWithTheme(<WikiRevisionHistory {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /Close/ }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    mockRevisionsLoading = true;
    mockRevisionsData = [];

    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockRevisionsError = new Error('Network fail');
    mockRevisionsData = [];

    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByText('Failed to load revisions')).toBeInTheDocument();
  });

  it('shows empty state when no revisions', () => {
    mockRevisionsData = [];

    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    expect(screen.getByText('No revisions yet.')).toBeInTheDocument();
  });

  it('shows diff when a non-current revision is clicked', async () => {
    const user = userEvent.setup();
    // Set up mock to return revision content when selected
    mockRevisionData = mockRevisions[1]; // rev-2

    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    // Click the v2 revision row — find "Click to compare" hint text
    const compareHints = screen.getAllByText('Click to compare');
    await user.click(compareHints[0]); // first non-current revision

    // Diff viewer should render with labels
    expect(screen.getByText(/v2 \(selected\)/)).toBeInTheDocument();
    expect(screen.getByText(/v3 \(current\)/)).toBeInTheDocument();
  });

  it('hides diff when the same revision is clicked again', async () => {
    const user = userEvent.setup();
    mockRevisionData = mockRevisions[1];

    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    const compareHints = screen.getAllByText('Click to compare');
    // Click to open
    await user.click(compareHints[0]);
    expect(screen.getByText(/v2 \(selected\)/)).toBeInTheDocument();

    // Click again to close — the hint should now say "Click to hide diff"
    const hideHint = screen.getByText('Click to hide diff');
    await user.click(hideHint);

    // Diff should be hidden
    expect(screen.queryByText(/v2 \(selected\)/)).not.toBeInTheDocument();
  });

  it('does not open diff for the current revision', async () => {
    const user = userEvent.setup();

    renderWithTheme(<WikiRevisionHistory {...defaultProps} />);

    // The current row should not have a "Click to compare" hint
    const currentBadge = screen.getByText('Current');
    const currentRow = currentBadge.closest('[role="button"]') as HTMLElement;
    expect(within(currentRow).queryByText('Click to compare')).not.toBeInTheDocument();

    // Clicking the current row should not trigger diff
    await user.click(currentRow);
    expect(screen.queryByText(/v3 \(selected\)/)).not.toBeInTheDocument();
  });

  it('does not render dialog when open is false', () => {
    renderWithTheme(<WikiRevisionHistory {...defaultProps} open={false} />);

    expect(screen.queryByText('Revision History')).not.toBeInTheDocument();
  });
});
