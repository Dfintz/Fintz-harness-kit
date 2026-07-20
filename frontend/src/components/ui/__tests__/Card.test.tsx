import { Card } from '@/components/ui/Card';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';

describe('Card Component', () => {
  it('renders children', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('renders with title', () => {
    render(<Card title="Card Title">Content</Card>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders with subtitle', () => {
    render(
      <Card title="Title" subtitle="Subtitle">
        Content
      </Card>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(<Card footer={<div>Footer Content</div>}>Content</Card>);
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  it('renders header action', () => {
    render(
      <Card title="Title" headerAction={<button>Action</button>}>
        Content
      </Card>
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('handles click when interactive', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <Card interactive onClick={handleClick}>
        Content
      </Card>
    );

    await user.click(screen.getByText('Content'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('renders elevated variant', () => {
    render(<Card variant="elevated">Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders outlined variant', () => {
    render(<Card variant="outlined">Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders filled variant', () => {
    render(<Card variant="filled">Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies padding sizes', () => {
    const { rerender } = render(<Card padding="none">None</Card>);
    expect(screen.getByText('None')).toBeInTheDocument();

    rerender(<Card padding="sm">Small</Card>);
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(<Card padding="md">Medium</Card>);
    expect(screen.getByText('Medium')).toBeInTheDocument();

    rerender(<Card padding="lg">Large</Card>);
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('renders complex header with title and action', () => {
    render(
      <Card title="Fleet Status" subtitle="Last updated: 2024" headerAction={<button>Edit</button>}>
        Status content
      </Card>
    );

    expect(screen.getByText('Fleet Status')).toBeInTheDocument();
    expect(screen.getByText('Last updated: 2024')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Status content')).toBeInTheDocument();
  });

  describe('error state', () => {
    it('renders error state with default message and hides children', () => {
      render(<Card error>Card Content</Card>);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.queryByText('Card Content')).not.toBeInTheDocument();
    });

    it('renders error state with custom message', () => {
      render(
        <Card error errorMessage="Failed to load fleet data">
          Content
        </Card>
      );
      expect(screen.getByText('Failed to load fleet data')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', async () => {
      const user = userEvent.setup();
      const handleRetry = jest.fn();
      render(
        <Card error onRetry={handleRetry}>
          Content
        </Card>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      await user.click(retryButton);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render retry button when onRetry is not provided', () => {
      render(<Card error>Content</Card>);
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });
  });
});
