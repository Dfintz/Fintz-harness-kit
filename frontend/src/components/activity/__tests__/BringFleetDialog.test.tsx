import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { BringFleetDialog } from '../BringFleetDialog';

const fleets = [
  { id: 'fleet-1', name: 'Combat Fleet' },
  { id: 'fleet-2', name: 'Mining Fleet' },
];

const ships = [
  { id: 's1', name: 'Cutlass Black' },
  { id: 's2', name: 'Gladius' },
];

describe('BringFleetDialog', () => {
  const baseProps = {
    open: true,
    onClose: jest.fn(),
    onBring: jest.fn(),
    isBringing: false,
    fleets,
    fleetsLoading: false,
    ships,
    shipsLoading: false,
    selectedFleetId: 'fleet-1',
    onSelectFleet: jest.fn(),
    activityTitle: 'Op Night',
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders the title and fleet selector', () => {
    render(<BringFleetDialog {...baseProps} />);
    expect(screen.getByText('Bring a Fleet')).toBeInTheDocument();
    expect(screen.getByText(/Add fleet ships to "Op Night"/)).toBeInTheDocument();
  });

  it('brings all ships by default (no shipIds in payload)', async () => {
    const user = userEvent.setup();
    const onBring = jest.fn();
    render(<BringFleetDialog {...baseProps} onBring={onBring} />);

    await user.click(screen.getByRole('button', { name: /Bring 2 Ships/i }));
    expect(onBring).toHaveBeenCalledWith({ fleetId: 'fleet-1', shipIds: undefined });
  });

  it('lets the user pick a subset when "bring all" is unchecked', async () => {
    const user = userEvent.setup();
    const onBring = jest.fn();
    render(<BringFleetDialog {...baseProps} onBring={onBring} />);

    // Uncheck "bring all"
    await user.click(screen.getByLabelText(/Bring all ships/i));
    // Pick one ship
    await user.click(screen.getByText('Gladius'));

    await user.click(screen.getByRole('button', { name: /Bring 1 Ship/i }));
    expect(onBring).toHaveBeenCalledWith({ fleetId: 'fleet-1', shipIds: ['s2'] });
  });

  it('shows an empty state when the leader has no fleets', () => {
    render(<BringFleetDialog {...baseProps} fleets={[]} selectedFleetId={null} />);
    expect(screen.getByText(/don't lead any fleets/i)).toBeInTheDocument();
  });

  it('disables the action while bringing', () => {
    render(<BringFleetDialog {...baseProps} isBringing />);
    expect(screen.getByRole('button', { name: /Bringing/i })).toBeDisabled();
  });
});
