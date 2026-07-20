/**
 * WikiDiffViewer component tests.
 *
 * Tests side-by-side diff rendering, stats, edge cases (identical, empty).
 */

import { muiTheme } from '@/theme/muiTheme';
import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { WikiDiffViewer } from '@/components/wiki/WikiDiffViewer';

// ─── Helpers ───────────────────────────────────────────────────

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={muiTheme}>{ui}</ThemeProvider>);
}

// ─── Tests ─────────────────────────────────────────────────────

describe('WikiDiffViewer', () => {
  it('renders header labels', () => {
    renderWithTheme(
      <WikiDiffViewer oldLabel="v1" newLabel="v2" oldContent="hello" newContent="hello world" />
    );

    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('shows diff stats for additions', () => {
    renderWithTheme(
      <WikiDiffViewer
        oldLabel="Old"
        newLabel="New"
        oldContent="line one"
        newContent="line one\nline two"
      />
    );

    // Should show at least one addition
    expect(screen.getByText(/\+\d+ added/)).toBeInTheDocument();
  });

  it('shows diff stats for removals', () => {
    renderWithTheme(
      <WikiDiffViewer
        oldLabel="Old"
        newLabel="New"
        oldContent="line one\nline two"
        newContent="line one"
      />
    );

    expect(screen.getByText(/-\d+ removed/)).toBeInTheDocument();
  });

  it('shows "No changes" when content is identical', () => {
    renderWithTheme(
      <WikiDiffViewer
        oldLabel="Old"
        newLabel="New"
        oldContent="same content"
        newContent="same content"
      />
    );

    expect(screen.getByText('No differences')).toBeInTheDocument();
  });

  it('handles empty strings', () => {
    renderWithTheme(<WikiDiffViewer oldLabel="Old" newLabel="New" oldContent="" newContent="" />);

    expect(screen.getByText('No differences')).toBeInTheDocument();
  });

  it('handles completely new content (old is empty)', () => {
    renderWithTheme(
      <WikiDiffViewer
        oldLabel="Old"
        newLabel="New"
        oldContent=""
        newContent="brand new content\nsecond line"
      />
    );

    expect(screen.getByText(/\+\d+ added/)).toBeInTheDocument();
    // No removals chip should appear (or it should say 0)
    expect(screen.queryByText(/-[1-9]\d* removed/)).not.toBeInTheDocument();
  });

  it('handles completely deleted content (new is empty)', () => {
    renderWithTheme(
      <WikiDiffViewer
        oldLabel="Old"
        newLabel="New"
        oldContent="gone content\nsecond line"
        newContent=""
      />
    );

    expect(screen.getByText(/-\d+ removed/)).toBeInTheDocument();
  });

  it('renders added lines with the new content text', () => {
    renderWithTheme(
      <WikiDiffViewer
        oldLabel="Old"
        newLabel="New"
        oldContent="line one"
        newContent="line one\nadded line"
      />
    );

    expect(screen.getByText(/added line/)).toBeInTheDocument();
  });

  it('renders removed lines with the old content text', () => {
    renderWithTheme(
      <WikiDiffViewer
        oldLabel="Old"
        newLabel="New"
        oldContent="line one\nremoved line"
        newContent="line one"
      />
    );

    expect(screen.getByText(/removed line/)).toBeInTheDocument();
  });

  it('renders multi-line diffs with mixed changes', () => {
    const oldContent = ['# Title', 'paragraph one', 'paragraph two', 'footer'].join('\n');
    const newContent = ['# Title', 'paragraph one modified', 'paragraph three', 'footer'].join(
      '\n'
    );

    renderWithTheme(
      <WikiDiffViewer oldLabel="v1" newLabel="v2" oldContent={oldContent} newContent={newContent} />
    );

    // Stats should show both add and remove
    expect(screen.getByText(/\+\d+ added/)).toBeInTheDocument();
    expect(screen.getByText(/-\d+ removed/)).toBeInTheDocument();
  });
});
