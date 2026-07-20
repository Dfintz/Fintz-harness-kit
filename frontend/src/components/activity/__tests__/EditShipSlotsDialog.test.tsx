import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { EditShipSlotsDialog, type SlotRow } from '../EditShipSlotsDialog';

const roleOptions = [
  { value: 'pilot', label: 'Pilot' },
  { value: 'gunner', label: 'Gunner' },
  { value: 'engineer', label: 'Engineer' },
];

describe('EditShipSlotsDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    isSaving: false,
    title: 'Edit Crew Slots',
    roleOptions,
    initialSlots: [{ role: 'pilot', capacity: 1 }] as SlotRow[],
    lockedMinimums: { pilot: 1 },
    shipName: 'Andromeda',
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders the title, ship name, and initial rows', () => {
    render(<EditShipSlotsDialog {...defaultProps} />);
    expect(screen.getByText('Edit Crew Slots')).toBeInTheDocument();
    expect(screen.getByText('Andromeda')).toBeInTheDocument();
    // MUI select renders the chosen option's label as text within the field
    expect(screen.getByText('Pilot')).toBeInTheDocument();
  });

  it('adds a new role row using the first unused role', async () => {
    const user = userEvent.setup();
    render(<EditShipSlotsDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Add Role/i }));
    // The new row defaults to the first unused role (Gunner)
    expect(screen.getByText('Gunner')).toBeInTheDocument();
  });

  it('locks removal of a role that still has filled seats', () => {
    render(<EditShipSlotsDialog {...defaultProps} />);
    expect(screen.getByLabelText(/Remove Pilot slot/i)).toBeDisabled();
  });

  it('saves the current rows', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(<EditShipSlotsDialog {...defaultProps} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /Save Slots/i }));
    expect(onSave).toHaveBeenCalledWith([{ role: 'pilot', capacity: 1 }]);
  });

  it('blocks saving when a capacity is below its locked minimum', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(
      <EditShipSlotsDialog
        {...defaultProps}
        onSave={onSave}
        initialSlots={[{ role: 'pilot', capacity: 1 }]}
        lockedMinimums={{ pilot: 1 }}
      />
    );

    const seats = screen.getByLabelText('Seats');
    await user.clear(seats);
    await user.type(seats, '0');

    expect(screen.getByText(/can't be below 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Slots/i })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a saving state on the action button', () => {
    render(<EditShipSlotsDialog {...defaultProps} isSaving />);
    expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
  });
});
