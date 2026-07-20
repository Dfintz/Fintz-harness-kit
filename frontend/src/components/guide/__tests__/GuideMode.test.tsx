import React from 'react';
import { render, screen, waitFor } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';

import { GuideModeProvider, useGuideMode } from '../GuideMode';
import { GuideLauncherButton } from '../GuideLauncherButton';
import { DEFAULT_GUIDE_SCRIPT, GuideScript } from '../guideScript';

// Small harness that exposes the guide controls through buttons.
const Harness: React.FC<{ script?: GuideScript }> = ({ script }) => {
  const guide = useGuideMode();
  return (
    <div>
      <button onClick={() => guide.start(script)}>start-tour</button>
      <span data-testid="active">{String(guide.isActive)}</span>
      <span data-testid="idx">{guide.index}</span>
    </div>
  );
};

const shortScript: GuideScript = {
  id: 'test',
  title: 'Test',
  steps: [
    { id: 'a', scene: 'One', title: 'First step', body: 'first body' },
    { id: 'b', scene: 'Two', title: 'Second step', body: 'second body' },
  ],
};

describe('GuideMode', () => {
  it('does not render the overlay until started', () => {
    render(
      <GuideModeProvider script={shortScript}>
        <Harness script={shortScript} />
      </GuideModeProvider>
    );
    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('active')).toHaveTextContent('false');
  });

  it('starts, advances, and finishes the tour', async () => {
    const user = userEvent.setup();
    render(
      <GuideModeProvider script={shortScript}>
        <Harness script={shortScript} />
      </GuideModeProvider>
    );

    await user.click(screen.getByText('start-tour'));
    expect(await screen.findByTestId('guide-overlay')).toBeInTheDocument();
    expect(screen.getByText('First step')).toBeInTheDocument();

    // Advance to the last step.
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Second step')).toBeInTheDocument();

    // Finishing closes the overlay.
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument());
  });

  it('exits when the Exit control is used', async () => {
    const user = userEvent.setup();
    render(
      <GuideModeProvider script={shortScript}>
        <Harness script={shortScript} />
      </GuideModeProvider>
    );

    await user.click(screen.getByText('start-tour'));
    expect(await screen.findByTestId('guide-overlay')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /exit guide/i }));
    await waitFor(() => expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument());
  });

  it('launcher button starts the default tour', async () => {
    const user = userEvent.setup();
    render(
      <GuideModeProvider>
        <GuideLauncherButton />
      </GuideModeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Start guided tour' }));
    expect(await screen.findByTestId('guide-overlay')).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_GUIDE_SCRIPT.steps[0].title)).toBeInTheDocument();
  });

  it('renders nothing for the launcher outside a provider', () => {
    render(<GuideLauncherButton />);
    expect(screen.queryByRole('button', { name: 'Start guided tour' })).not.toBeInTheDocument();
  });
});
