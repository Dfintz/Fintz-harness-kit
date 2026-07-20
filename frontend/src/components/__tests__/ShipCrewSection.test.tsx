import { render, screen } from '@/test-utils/test-utils';
import type { ShipCrewBreakdownCardEntry } from '@sc-fleet-manager/shared-types';
import { RoleSlotChip, ShipCrewSection } from '../activity/ShipCrewSection';

const mockBreakdown: ShipCrewBreakdownCardEntry[] = [
  {
    shipName: 'Crusader M2 Hercules',
    crewCapacity: 3,
    roles: [
      { role: 'pilot', total: 1, filled: 1, assignedUserName: 'CmdrVex' },
      { role: 'gunner', total: 1, filled: 0 },
      { role: 'engineer', total: 1, filled: 0 },
    ],
  },
  {
    shipName: 'Tumbril Nova',
    crewCapacity: 2,
    roles: [
      { role: 'pilot', total: 1, filled: 1, assignedUserName: 'TankDriver' },
      { role: 'gunner', total: 1, filled: 0 },
    ],
    isTransported: true,
    transportType: 'cargo',
  },
];

describe('ShipCrewSection', () => {
  it('renders ship names', () => {
    render(<ShipCrewSection breakdown={mockBreakdown} />);
    expect(screen.getByText('Crusader M2 Hercules')).toBeInTheDocument();
    expect(screen.getByText('Tumbril Nova')).toBeInTheDocument();
  });

  it('shows aggregate open positions', () => {
    render(<ShipCrewSection breakdown={mockBreakdown} />);
    expect(screen.getByText('3 Open Positions')).toBeInTheDocument();
  });

  it('shows aggregate filled count', () => {
    render(<ShipCrewSection breakdown={mockBreakdown} />);
    expect(screen.getByText('2/5 filled')).toBeInTheDocument();
  });

  it('renders cargo transport badge for transported ship', () => {
    render(<ShipCrewSection breakdown={mockBreakdown} />);
    expect(screen.getByText('Cargo')).toBeInTheDocument();
  });

  it('shows overflow text when more ships than maxShipsShown', () => {
    const largeBreakdown: ShipCrewBreakdownCardEntry[] = [
      ...mockBreakdown,
      {
        shipName: 'Anvil Spartan',
        crewCapacity: 1,
        roles: [{ role: 'pilot', total: 1, filled: 0 }],
      },
      {
        shipName: 'RSI Aurora',
        crewCapacity: 1,
        roles: [{ role: 'pilot', total: 1, filled: 0 }],
      },
    ];
    render(<ShipCrewSection breakdown={largeBreakdown} maxShipsShown={2} />);
    expect(screen.getByText('+2 more ships')).toBeInTheDocument();
  });

  it('shows Crew Full when all positions filled', () => {
    const fullBreakdown: ShipCrewBreakdownCardEntry[] = [
      {
        shipName: 'Drake Cutlass',
        crewCapacity: 2,
        roles: [
          { role: 'pilot', total: 1, filled: 1 },
          { role: 'gunner', total: 1, filled: 1 },
        ],
      },
    ];
    render(<ShipCrewSection breakdown={fullBreakdown} />);
    expect(screen.getByText('Crew Full')).toBeInTheDocument();
  });

  it('renders loaner badge when ship is loaner', () => {
    const loanerBreakdown: ShipCrewBreakdownCardEntry[] = [
      {
        shipName: 'Loaner Ship',
        crewCapacity: 1,
        roles: [{ role: 'pilot', total: 1, filled: 0 }],
        isLoaner: true,
        contributedByUserName: 'TestUser',
      },
    ];
    render(<ShipCrewSection breakdown={loanerBreakdown} />);
    // "Loaner" appears in chip label and tooltip
    const matches = screen.getAllByText(/Loaner/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders passengers section', () => {
    const withPassengers: ShipCrewBreakdownCardEntry[] = [
      {
        shipName: 'APC Ship',
        crewCapacity: 1,
        roles: [{ role: 'pilot', total: 1, filled: 1 }],
        passengers: [{ role: 'marine', capacity: 8, filled: 4 }],
      },
    ];
    render(<ShipCrewSection breakdown={withPassengers} />);
    expect(screen.getByText(/Marines/)).toBeInTheDocument();
    expect(screen.getByText('4/8')).toBeInTheDocument();
  });
});

describe('RoleSlotChip', () => {
  it('renders filled role with assigned user name', () => {
    render(
      <RoleSlotChip role={{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'CmdrVex' }} />
    );
    expect(screen.getByText(/CmdrVex/)).toBeInTheDocument();
  });

  it('renders open role with "(Open)" suffix', () => {
    render(<RoleSlotChip role={{ role: 'gunner', total: 1, filled: 0 }} />);
    expect(screen.getByText(/Gunner \(Open\)/)).toBeInTheDocument();
  });
});
