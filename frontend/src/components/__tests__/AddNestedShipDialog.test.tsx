import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';

import { AddNestedShipDialog } from '@/components/AddNestedShipDialog';

// Mock the ship catalogue hook
const mockCatalogueData = {
  items: [
    { id: 's1', name: 'Gladius', manufacturer: 'Aegis', size: 'small', role: 'Light Fighter', crew: 1, isVehicle: false },
    { id: 's2', name: 'Vanguard', manufacturer: 'Aegis', size: 'medium', role: 'Heavy Fighter', crew: 2, isVehicle: false },
    { id: 's3', name: 'Hammerhead', manufacturer: 'Aegis', size: 'large', role: 'Combat', crew: 8, isVehicle: false },
    { id: 'v1', name: 'Ursa Rover', manufacturer: 'RSI', size: 'small', role: 'Ground Vehicle', crew: 1, isVehicle: true },
    { id: 'v2', name: 'Cyclone', manufacturer: 'Tumbril', size: 'small', role: 'Ground Vehicle', crew: 1, isVehicle: true },
  ],
  total: 5,
  page: 1,
  limit: 100,
  totalPages: 1,
};

jest.mock('@/hooks/queries/useShipCatalogueQueries', () => ({
  useShipCatalogue: () => ({
    data: mockCatalogueData,
    isLoading: false,
  }),
  useShipRoles: () => ({ data: [], isLoading: false }),
}));

describe('AddNestedShipDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onAdd: jest.fn(),
    isAdding: false,
    parentShipId: 'ship-1',
    parentShipName: 'Carrack',
    transportType: 'hangar' as const,
    hangarSize: 'medium',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hangar mode', () => {
    it('renders dialog title for hangar mode', () => {
      render(<AddNestedShipDialog {...defaultProps} />);
      expect(screen.getByText('Add Ship to Carrack Hangar')).toBeInTheDocument();
    });

    it('shows description with hangar size', () => {
      render(<AddNestedShipDialog {...defaultProps} />);
      expect(
        screen.getByText(
          "Select a ship to carry in Carrack's hangar (fits up to medium size)."
        )
      ).toBeInTheDocument();
    });

    it('filters out vehicles in hangar mode', () => {
      render(<AddNestedShipDialog {...defaultProps} />);
      const input = screen.getByLabelText('Ship');
      expect(input).toBeInTheDocument();
      // Vehicles should not appear in the autocomplete
    });

    it('filters ships by hangar size', () => {
      // hangarSize is "medium", so large ships should be filtered out
      render(<AddNestedShipDialog {...defaultProps} hangarSize="small" />);
      // Only small ships should be available — Gladius fits, Vanguard doesn't
      expect(screen.getByLabelText('Ship')).toBeInTheDocument();
    });

    it('shows hangar description without size when hangarSize is undefined', () => {
      render(<AddNestedShipDialog {...defaultProps} hangarSize={undefined} />);
      expect(
        screen.getByText("Select a ship to carry in Carrack's hangar.")
      ).toBeInTheDocument();
    });
  });

  describe('cargo mode', () => {
    it('renders dialog title for cargo mode', () => {
      render(
        <AddNestedShipDialog {...defaultProps} transportType="cargo" />
      );
      expect(screen.getByText('Add Vehicle to Carrack')).toBeInTheDocument();
    });

    it('shows cargo description', () => {
      render(
        <AddNestedShipDialog {...defaultProps} transportType="cargo" />
      );
      expect(
        screen.getByText("Select a ground vehicle to load into Carrack's cargo bay.")
      ).toBeInTheDocument();
    });

    it('labels input as Vehicle in cargo mode', () => {
      render(
        <AddNestedShipDialog {...defaultProps} transportType="cargo" />
      );
      expect(screen.getByLabelText('Vehicle')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('disables Add button when no ship selected', () => {
      render(<AddNestedShipDialog {...defaultProps} />);
      const addBtn = screen.getByRole('button', { name: 'Add' });
      expect(addBtn).toBeDisabled();
    });

    it('shows loading state when isAdding is true', () => {
      render(<AddNestedShipDialog {...defaultProps} isAdding />);
      expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    });

    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<AddNestedShipDialog {...defaultProps} />);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render when open is false', () => {
      render(<AddNestedShipDialog {...defaultProps} open={false} />);
      expect(screen.queryByText('Add Ship to Carrack Hangar')).not.toBeInTheDocument();
    });
  });
});
