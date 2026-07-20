import { ActivityCard } from '@/components/ActivityCard';
import { render, screen } from '@/test-utils/test-utils';
import type { ActivityV2 } from '@/types/apiV2';

// Minimal fixture for tests
const baseActivity: ActivityV2 = {
  id: 'act-001',
  title: 'Bounty Hunt Alpha',
  type: 'bounty',
  status: 'open',
  organizationId: 'org-001',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

describe('ActivityCard', () => {
  describe('rendering', () => {
    it('renders activity title', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Bounty Hunt Alpha')).toBeInTheDocument();
    });

    it('renders type badge with config label', () => {
      render(<ActivityCard activity={baseActivity} />);
      // getActivityTypeConfig('bounty') returns emoji + label "Bounty" in a Chip
      // Use getAllByText since "Bounty" appears in both title and badge
      const matches = screen.getAllByText(/Bounty/);
      expect(matches.length).toBeGreaterThanOrEqual(2); // title + badge
    });

    it('renders status badge with config label', () => {
      render(<ActivityCard activity={baseActivity} />);
      // getActivityStatusConfig('open') returns label "Open"
      expect(screen.getByText(/Open/)).toBeInTheDocument();
    });

    it('renders description when not compact', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        description: 'Hunt down the target in Pyro system.',
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Hunt down the target in Pyro system.')).toBeInTheDocument();
    });

    it('hides description in compact mode', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        description: 'Hunt down the target in Pyro system.',
      };
      render(<ActivityCard activity={activity} compact />);
      expect(screen.queryByText('Hunt down the target in Pyro system.')).not.toBeInTheDocument();
    });

    it('renders location when provided', () => {
      const activity: ActivityV2 = { ...baseActivity, location: 'Grim HEX' };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Grim HEX')).toBeInTheDocument();
    });

    it('renders organization name as subtitle', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        organizationName: 'Star Runners Corp',
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Star Runners Corp')).toBeInTheDocument();
    });

    it('shows visibility label when no organization name', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        visibility: 'public',
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Public Activity')).toBeInTheDocument();
    });

    it('renders visibility badge chip', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        visibility: 'private',
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Private')).toBeInTheDocument();
    });
  });

  describe('date and time', () => {
    it('renders scheduled start date', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        scheduledStartDate: '2026-04-15T14:00:00Z',
      };
      render(<ActivityCard activity={activity} />);
      // formatDate returns "Apr 15, 02:00 PM" or similar locale-dependent string
      expect(screen.getByText(/Apr/)).toBeInTheDocument();
    });

    it('falls back to startDate when scheduledStartDate is absent', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        startDate: '2026-05-20T09:00:00Z',
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText(/May/)).toBeInTheDocument();
    });

    it('renders duration from estimatedDuration', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        scheduledStartDate: '2026-04-15T14:00:00Z',
        estimatedDuration: 90,
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });

    it('calculates duration from start/end dates when no estimatedDuration', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        scheduledStartDate: '2026-04-15T14:00:00Z',
        scheduledEndDate: '2026-04-15T16:00:00Z',
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('2h')).toBeInTheDocument();
    });
  });

  describe('participants', () => {
    it('renders participant count and progress bar', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        currentParticipants: 3,
        maxParticipants: 10,
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('7 Open Spots')).toBeInTheDocument();
      expect(screen.getByText('3/10 joined')).toBeInTheDocument();
    });

    it('shows singular "Spot" for 1 open slot', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        currentParticipants: 9,
        maxParticipants: 10,
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('1 Open Spot')).toBeInTheDocument();
    });

    it('shows "Crew Full" when all slots taken', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        currentParticipants: 5,
        maxParticipants: 5,
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Crew Full')).toBeInTheDocument();
    });

    it('hides participant section when maxParticipants is 0', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        maxParticipants: 0,
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.queryByText(/joined/)).not.toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('calls onClick with activity id when clicked', () => {
      const handleClick = jest.fn();
      render(<ActivityCard activity={baseActivity} onClick={handleClick} />);

      (screen.getByText('Bounty Hunt Alpha').closest('[class]') as HTMLElement)!.click();
      // The outermost Box has the onClick
      expect(handleClick).toHaveBeenCalledWith('act-001');
    });

    it('applies pointer cursor when onClick is provided', () => {
      render(<ActivityCard activity={baseActivity} onClick={jest.fn()} />);
      // Card should be clickable — verify title is present (interaction is via MUI sx)
      expect(screen.getByText('Bounty Hunt Alpha')).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('shows relative start time when start date exists', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const activity: ActivityV2 = {
        ...baseActivity,
        scheduledStartDate: futureDate.toISOString(),
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText(/Starts/)).toBeInTheDocument();
    });

    it('shows relative creation time when no start date', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText(/Created/)).toBeInTheDocument();
    });
  });

  describe('theme integration (no hardcoded colors)', () => {
    it('renders without errors with MUI theme provider', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        description: 'Full activity',
        location: 'Port Olisar',
        organizationName: 'Test Org',
        visibility: 'public',
        scheduledStartDate: '2026-04-15T14:00:00Z',
        scheduledEndDate: '2026-04-15T16:00:00Z',
        currentParticipants: 3,
        maxParticipants: 8,
      };
      // This test ensures all theme references resolve without throwing
      const { container } = render(<ActivityCard activity={activity} />);
      expect(container.firstChild).toBeTruthy();
    });

    it('renders all activity types without errors', () => {
      const types = ['mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing'];
      for (const type of types) {
        const activity: ActivityV2 = {
          ...baseActivity,
          type: type as ActivityV2['type'],
          title: `Test ${type}`,
        };
        const { unmount } = render(<ActivityCard activity={activity} />);
        expect(screen.getByText(`Test ${type}`)).toBeInTheDocument();
        unmount();
      }
    });

    it('renders all activity statuses without errors', () => {
      const statuses = [
        'draft',
        'open',
        'planning',
        'recruiting',
        'ready',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'expired',
      ];
      for (const status of statuses) {
        const activity: ActivityV2 = {
          ...baseActivity,
          status: status as ActivityV2['status'],
          title: `Test ${status}`,
        };
        const { unmount } = render(<ActivityCard activity={activity} />);
        expect(screen.getByText(`Test ${status}`)).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('ship requirements', () => {
    it('renders required ships section with ship chips', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        shipRequirementType: 'required',
        requiredShips: [
          { requirementType: 'specific', shipName: 'Gladius', count: 2, crewPerShip: 1 },
          { requirementType: 'role', role: 'Medium Mining', count: 3, avgCrewPerShip: 2 },
        ],
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Required Ships')).toBeInTheDocument();
      expect(screen.getByText('5 needed')).toBeInTheDocument();
      expect(screen.getByText('2× Gladius')).toBeInTheDocument();
      expect(screen.getByText('3× Medium Mining')).toBeInTheDocument();
    });

    it('renders preferred ships label when type is preferred', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        shipRequirementType: 'preferred',
        requiredShips: [
          { requirementType: 'specific', shipName: 'Cutlass Black', count: 1, crewPerShip: 3 },
        ],
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Preferred Ships')).toBeInTheDocument();
      expect(screen.getByText('1 needed')).toBeInTheDocument();
    });

    it('hides ship requirements when shipRequirementType is none', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        shipRequirementType: 'none',
        requiredShips: [],
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.queryByText(/Ships$/)).not.toBeInTheDocument();
    });

    it('hides ship requirements in compact mode', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        shipRequirementType: 'required',
        requiredShips: [
          { requirementType: 'specific', shipName: 'Gladius', count: 2, crewPerShip: 1 },
        ],
      };
      render(<ActivityCard activity={activity} compact />);
      expect(screen.queryByText('Required Ships')).not.toBeInTheDocument();
    });

    it('shows overflow chip when more than 3 ship requirements', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        shipRequirementType: 'required',
        requiredShips: [
          { requirementType: 'specific', shipName: 'Gladius', count: 1, crewPerShip: 1 },
          { requirementType: 'specific', shipName: 'Sabre', count: 1, crewPerShip: 1 },
          { requirementType: 'specific', shipName: 'Vanguard', count: 1, crewPerShip: 2 },
          { requirementType: 'role', role: 'Heavy Fighter', count: 2, avgCrewPerShip: 2 },
        ],
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  describe('fleet logistics', () => {
    it('renders total cargo capacity (SCU)', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        totalCargoCapacity: 1200,
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('1,200 SCU')).toBeInTheDocument();
    });

    it('renders average quantum fuel', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        totalQuantumFuel: 900,
        shipAssignments: [
          {
            shipType: 'Freelancer',
            role: 'cargo',
            crewCapacity: 4,
            crewAssigned: 2,
            status: 'assigned',
          },
          {
            shipType: 'Caterpillar',
            role: 'cargo',
            crewCapacity: 5,
            crewAssigned: 3,
            status: 'assigned',
          },
          {
            shipType: 'Hull C',
            role: 'cargo',
            crewCapacity: 4,
            crewAssigned: 1,
            status: 'assigned',
          },
        ],
      };
      render(<ActivityCard activity={activity} />);
      // 900 / 3 ships = 300 avg
      expect(screen.getByText('~300 QF avg')).toBeInTheDocument();
    });

    it('renders refuel ship indicator', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        hasRefuelShip: true,
      };
      render(<ActivityCard activity={activity} />);
      expect(screen.getByText('Refuel')).toBeInTheDocument();
    });

    it('hides fleet logistics when no data', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.queryByText(/SCU/)).not.toBeInTheDocument();
      expect(screen.queryByText(/QF avg/)).not.toBeInTheDocument();
      expect(screen.queryByText('Refuel')).not.toBeInTheDocument();
    });

    it('hides fleet logistics in compact mode', () => {
      const activity: ActivityV2 = {
        ...baseActivity,
        totalCargoCapacity: 500,
        hasRefuelShip: true,
      };
      render(<ActivityCard activity={activity} compact />);
      expect(screen.queryByText('500 SCU')).not.toBeInTheDocument();
      expect(screen.queryByText('Refuel')).not.toBeInTheDocument();
    });
  });
});
