import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test-utils/test-utils';
import { Modal } from '@/components/ui/Modal';

describe('Modal Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders when open', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        Modal Content
      </Modal>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={mockOnClose}>
        Modal Content
      </Modal>
    );
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Modal Title">
        Content
      </Modal>
    );
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} footer={<button>Save</button>}>
        Content
      </Modal>
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('shows close button by default', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test">
        Content
      </Modal>
    );
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test" showCloseButton>
        Content
      </Modal>
    );

    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders different sizes', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose} size="sm">
        Small
      </Modal>
    );
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={mockOnClose} size="md">
        Medium
      </Modal>
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={mockOnClose} size="lg">
        Large
      </Modal>
    );
    expect(screen.getByText('Large')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={mockOnClose} size="xl">
        Extra Large
      </Modal>
    );
    expect(screen.getByText('Extra Large')).toBeInTheDocument();
  });

  it('renders modal with title and footer', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Confirm Action"
        footer={
          <div>
            <button>Cancel</button>
            <button>Confirm</button>
          </div>
        }
      >
        Are you sure?
      </Modal>
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });
});
