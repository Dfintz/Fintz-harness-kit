import { act, render, screen, waitFor } from '@testing-library/react';
import { shipCatalogueService } from '@/services/shipCatalogueService';
import { AddShipDialog } from '@/components/AddShipDialog';

// Mock the ship catalogue service
jest.mock('../../services/shipCatalogueService', () => ({
  shipCatalogueService: {
    getManufacturers: jest.fn(),
    getShips: jest.fn(),
    searchShips: jest.fn(),
    getShipById: jest.fn(),
  },
}));

// Helper to render with ThemeProviders

describe('AddShipDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnAddShip = jest.fn();
  const mockOnImportShips = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAddShip.mockResolvedValue(undefined);
    mockOnImportShips.mockResolvedValue(undefined);

    // Mock ship catalogue service responses
    (shipCatalogueService.getManufacturers as jest.Mock).mockResolvedValue([
      'Aegis Dynamics',
      'Anvil Aerospace',
      'MISC',
    ]);
    (shipCatalogueService.getShips as jest.Mock).mockResolvedValue({
      items: [
        {
          id: '1',
          name: 'Cutlass Black',
          manufacturer: 'Drake Interplanetary',
          size: 'medium',
          role: 'Combat',
        },
        {
          id: '2',
          name: 'Aurora MR',
          manufacturer: 'Roberts Space Industries',
          size: 'small',
          role: 'Starter',
        },
      ],
      total: 2,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
  });

  it('renders dialog when open', async () => {
    await act(async () => {
      render(
        <AddShipDialog
          isOpen={true}
          onClose={mockOnClose}
          onAddShip={mockOnAddShip}
          onImportShips={mockOnImportShips}
        />
      );
    });

    expect(screen.getByText('Add Ships to Hangar')).toBeInTheDocument();
  });

  it('does not render dialog when closed', async () => {
    await act(async () => {
      render(
        <AddShipDialog
          isOpen={false}
          onClose={mockOnClose}
          onAddShip={mockOnAddShip}
          onImportShips={mockOnImportShips}
        />
      );
    });

    // Dialog should not be visible when closed
    expect(screen.queryByText('Add Ships to Hangar')).not.toBeInTheDocument();
  });

  it('loads ship catalogue data on open', async () => {
    await act(async () => {
      render(
        <AddShipDialog
          isOpen={true}
          onClose={mockOnClose}
          onAddShip={mockOnAddShip}
          onImportShips={mockOnImportShips}
        />
      );
    });

    await waitFor(
      () => {
        expect(shipCatalogueService.getManufacturers).toHaveBeenCalled();
        expect(shipCatalogueService.getShips).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });

  it('renders close button', async () => {
    await act(async () => {
      render(
        <AddShipDialog
          isOpen={true}
          onClose={mockOnClose}
          onAddShip={mockOnAddShip}
          onImportShips={mockOnImportShips}
        />
      );
    });

    const closeButton = screen.getByRole('button', { name: /Cancel/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('renders add ship button', async () => {
    await act(async () => {
      render(
        <AddShipDialog
          isOpen={true}
          onClose={mockOnClose}
          onAddShip={mockOnAddShip}
          onImportShips={mockOnImportShips}
        />
      );
    });

    const addButton = screen.getByRole('button', { name: /Add Ship to Hangar/i });
    expect(addButton).toBeInTheDocument();
  });

});
