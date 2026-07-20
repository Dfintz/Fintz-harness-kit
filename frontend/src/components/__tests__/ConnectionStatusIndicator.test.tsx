import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';
import { render, screen } from '@/test-utils/test-utils';

describe('ConnectionStatusIndicator', () => {
  it('renders connected status', () => {
    render(<ConnectionStatusIndicator isConnected={true} />);

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders disconnected status', () => {
    render(<ConnectionStatusIndicator isConnected={false} />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders reconnecting status', () => {
    render(<ConnectionStatusIndicator isConnected={false} isReconnecting={true} />);

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });

  it('renders error status with message', () => {
    const errorMessage = 'Network timeout';
    render(<ConnectionStatusIndicator isConnected={false} error={errorMessage} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders compact version when compact prop is true', () => {
    render(<ConnectionStatusIndicator isConnected={true} compact={true} />);

    // Compact version should not have text
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('renders full version by default', () => {
    render(<ConnectionStatusIndicator isConnected={true} />);

    // Full version should have text
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('prioritizes error over other states', () => {
    render(
      <ConnectionStatusIndicator isConnected={true} isReconnecting={true} error="Error message" />
    );

    // Error takes precedence
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument();
  });

  it('prioritizes reconnecting over connected state', () => {
    render(<ConnectionStatusIndicator isConnected={true} isReconnecting={true} />);

    // Reconnecting takes precedence over connected
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });
});
