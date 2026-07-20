import { AboutModal } from '@/components/AboutModal';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';

describe('AboutModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders when open', () => {
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('About Fringe Core')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<AboutModal isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByText('About Fringe Core')).not.toBeInTheDocument();
  });

  it('displays integration information', () => {
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText(/Erkul/i)).toBeInTheDocument();
    expect(screen.getByText(/Ship Performance Viewer/i)).toBeInTheDocument();
    expect(screen.getByText(/Cornerstone/i)).toBeInTheDocument();
    expect(screen.getByText(/UEX Corp/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
