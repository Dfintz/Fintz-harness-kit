import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { JoinAsPassengerDialog, type AvailablePassengerSlot } from '../JoinAsPassengerDialog';

const slots: AvailablePassengerSlot[] = [
  {
    shipId: 'ship-1',
    shipType: 'Anvil Valkyrie',
    shipName: 'Valk',
    ownerName: 'Owner A',
    role: 'marine',
    availableSlots: 2,
  },
  {
    shipId: 'ship-2',
    shipType: 'Drake Cutlass',
    shipName: 'Cutty',
    ownerName: 'Owner B',
    role: 'medic',
    availableSlots: 0, // full — must be hidden
  },
];

describe('JoinAsPassengerDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onJoin: jest.fn(),
    isJoining: false,
    slots,
    isLoading: false,
    activityTitle: 'Drop Op',
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders the title and only open seats', () => {
    render(<JoinAsPassengerDialog {...defaultProps} />);
    expect(screen.getByText('Join as Passenger')).toBeInTheDocument();
    expect(screen.getByText(/Marine — Valk/)).toBeInTheDocument();
    // The full medic slot is filtered out
    expect(screen.queryByText(/Medic — Cutty/)).not.toBeInTheDocument();
  });

  it('disables Join until a seat is selected, then submits the identifier + role', async () => {
    const user = userEvent.setup();
    const onJoin = jest.fn();
    render(<JoinAsPassengerDialog {...defaultProps} onJoin={onJoin} />);

    const joinBtn = screen.getByRole('button', { name: /Join Seat/i });
    expect(joinBtn).toBeDisabled();

    await user.click(screen.getByText(/Marine — Valk/));
    expect(joinBtn).toBeEnabled();

    await user.click(joinBtn);
    expect(onJoin).toHaveBeenCalledWith({ shipId: 'ship-1', passengerRole: 'marine' });
  });

  it('shows an empty state when there are no open seats', () => {
    render(<JoinAsPassengerDialog {...defaultProps} slots={[]} />);
    expect(screen.getByText(/No open passenger seats/i)).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    render(<JoinAsPassengerDialog {...defaultProps} isLoading slots={[]} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows a joining state on the action button', () => {
    render(<JoinAsPassengerDialog {...defaultProps} isJoining />);
    expect(screen.getByRole('button', { name: /Joining/i })).toBeDisabled();
  });
});
