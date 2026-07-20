import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserProfileModal } from '@/components/UserProfileModal';

import { createTheme, ThemeProvider } from '@mui/material';
describe('UserProfileModal Component', () => {
  const mockOnClose = jest.fn();

  const renderModal = (open: boolean = true, userId: string = 'user-123') => {
    return render(<UserProfileModal open={open} onClose={mockOnClose} userId={userId} />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    renderModal(false);

    expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    renderModal(true);

    expect(screen.getByText('User Profile')).toBeInTheDocument();
  });

  it('displays user ID', () => {
    renderModal(true, 'test-user-456');

    expect(screen.getByText('User ID: test-user-456')).toBeInTheDocument();
  });

  it('displays message about unavailable presence feature', () => {
    renderModal(true);

    expect(screen.getByText(/User profile details are not available/)).toBeInTheDocument();
  });

  it('has close button', () => {
    renderModal(true);

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    renderModal(true);

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders with different user IDs', () => {
    const { rerender } = render(
      <UserProfileModal open={true} onClose={mockOnClose} userId="first-user" />
    );

    expect(screen.getByText('User ID: first-user')).toBeInTheDocument();

    rerender(<UserProfileModal open={true} onClose={mockOnClose} userId="second-user" />);

    expect(screen.getByText('User ID: second-user')).toBeInTheDocument();
  });
});
