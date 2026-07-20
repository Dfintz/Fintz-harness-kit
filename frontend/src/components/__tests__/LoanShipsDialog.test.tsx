import { useUserShips } from '@/hooks/queries';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { LoanShipsDialog } from '../LoanShipsDialog';

// Mock useUserShips and useAuthStore
const mockUserShips = [
  { id: 'ship-1', shipName: 'My Cutlass', manufacturer: 'Drake' },
  {
    id: 'ship-2',
    shipName: 'Big Connie',
    manufacturer: 'RSI',
  },
  { id: 'ship-3', shipName: 'Space Truck', manufacturer: 'MISC' },
];

jest.mock('@/hooks/queries', () => ({
  useUserShips: jest.fn(() => ({ data: mockUserShips, isLoading: false })),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'user-1' } })
  ),
}));

const mockedUseUserShips = useUserShips as jest.Mock;

describe('LoanShipsDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onLoan: jest.fn(),
    isLoaning: false,
    activityTitle: 'Test Activity',
    existingShipIds: [] as string[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseUserShips.mockReturnValue({ data: mockUserShips, isLoading: false });
  });

  it('renders dialog with title', () => {
    render(<LoanShipsDialog {...defaultProps} />);
    expect(screen.getByText('Loan Ships')).toBeInTheDocument();
    expect(screen.getByText(/Select ships to loan to "Test Activity"/)).toBeInTheDocument();
  });

  it('renders ship list from user hangar', () => {
    render(<LoanShipsDialog {...defaultProps} />);
    expect(screen.getByText('My Cutlass')).toBeInTheDocument();
    expect(screen.getByText('Big Connie')).toBeInTheDocument();
    expect(screen.getByText('Space Truck')).toBeInTheDocument();
  });

  it('shows manufacturer in secondary text', () => {
    render(<LoanShipsDialog {...defaultProps} />);
    expect(screen.getByText('Drake')).toBeInTheDocument();
    expect(screen.getByText('RSI')).toBeInTheDocument();
  });

  it('shows selection count', () => {
    render(<LoanShipsDialog {...defaultProps} />);
    expect(screen.getByText('0 of 3 selected')).toBeInTheDocument();
  });

  it('loan button is disabled when no ships selected', () => {
    render(<LoanShipsDialog {...defaultProps} />);
    const loanBtn = screen.getByRole('button', { name: /Loan 0 Ship/i });
    expect(loanBtn).toBeDisabled();
  });

  it('toggles ship selection on click', async () => {
    const user = userEvent.setup();
    render(<LoanShipsDialog {...defaultProps} />);

    await user.click(screen.getByText('My Cutlass'));
    expect(screen.getByText('1 of 3 selected')).toBeInTheDocument();

    const loanBtn = screen.getByRole('button', { name: /Loan 1 Ship$/i });
    expect(loanBtn).toBeEnabled();
  });

  it('selects multiple ships', async () => {
    const user = userEvent.setup();
    render(<LoanShipsDialog {...defaultProps} />);

    await user.click(screen.getByText('My Cutlass'));
    await user.click(screen.getByText('Big Connie'));
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Loan 2 Ships/i })).toBeEnabled();
  });

  it('calls onLoan with selected ships', async () => {
    const user = userEvent.setup();
    const onLoan = jest.fn();
    render(<LoanShipsDialog {...defaultProps} onLoan={onLoan} />);

    await user.click(screen.getByText('My Cutlass'));
    await user.click(screen.getByText('Space Truck'));

    const loanBtn = screen.getByRole('button', { name: /Loan 2 Ships/i });
    await user.click(loanBtn);

    expect(onLoan).toHaveBeenCalledWith({
      ships: expect.arrayContaining([
        expect.objectContaining({
          shipId: 'ship-1',
          shipType: 'My Cutlass',
          shipName: 'My Cutlass',
        }),
        expect.objectContaining({
          shipId: 'ship-3',
          shipType: 'Space Truck',
          shipName: 'Space Truck',
        }),
      ]),
    });
  });

  it('filters out ships already assigned', () => {
    render(<LoanShipsDialog {...defaultProps} existingShipIds={['ship-1', 'ship-3']} />);
    expect(screen.queryByText('My Cutlass')).not.toBeInTheDocument();
    expect(screen.queryByText('Space Truck')).not.toBeInTheDocument();
    expect(screen.getByText('Big Connie')).toBeInTheDocument();
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
  });

  it('filters bundled ship variants from activity/event selectors', () => {
    mockedUseUserShips.mockReturnValue({
      data: [
        {
          id: 'bundle-1',
          shipName: 'Carrack Expedition with Pisces Expedition',
          manufacturer: 'Anvil',
        },
        {
          id: 'ship-2',
          shipName: 'Big Connie',
          manufacturer: 'RSI',
        },
      ],
      isLoading: false,
    });

    render(<LoanShipsDialog {...defaultProps} />);

    expect(screen.queryByText('Carrack Expedition with Pisces Expedition')).not.toBeInTheDocument();
    expect(screen.getByText('Big Connie')).toBeInTheDocument();
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
  });

  it('shows select all / deselect all toggle', async () => {
    const user = userEvent.setup();
    render(<LoanShipsDialog {...defaultProps} />);

    const selectAllBtn = screen.getByRole('button', { name: /Select All/i });
    await user.click(selectAllBtn);
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deselect All/i })).toBeInTheDocument();
  });

  it('shows loading state when isLoaning', () => {
    render(<LoanShipsDialog {...defaultProps} isLoaning />);
    expect(screen.getByText('Loaning…')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<LoanShipsDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(<LoanShipsDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Loan Ships')).not.toBeInTheDocument();
  });
});
