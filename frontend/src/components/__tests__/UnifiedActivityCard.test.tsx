import { render, screen } from '@/test-utils/test-utils';
import type { ActivityCardData } from '@sc-fleet-manager/shared-types';
import { UnifiedActivityCard } from '../activity/UnifiedActivityCard';

// Minimal fixture
const baseCardData: ActivityCardData = {
  id: 'act-001',
  title: 'Bounty Hunt Alpha',
  type: 'bounty',
  status: 'open',
  postedAt: '2026-03-01T10:00:00Z',
};

describe('UnifiedActivityCard', () => {
  describe('rendering', () => {
    it('renders card title', () => {
      render(<UnifiedActivityCard data={baseCardData} />);
      expect(screen.getByText('Bounty Hunt Alpha')).toBeInTheDocument();
    });

    it('renders type badge with config label', () => {
      render(<UnifiedActivityCard data={baseCardData} />);
      const matches = screen.getAllByText(/Bounty/);
      expect(matches.length).toBeGreaterThanOrEqual(2); // title + badge
    });

    it('renders status badge with config label', () => {
      render(<UnifiedActivityCard data={baseCardData} />);
      expect(screen.getByText(/Open/)).toBeInTheDocument();
    });

    it('renders description when not compact', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        description: 'Hunt down the target in Pyro system.',
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Hunt down the target in Pyro system.')).toBeInTheDocument();
    });

    it('hides description in compact mode', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        description: 'Hunt down the target in Pyro system.',
      };
      render(<UnifiedActivityCard data={data} compact />);
      expect(screen.queryByText('Hunt down the target in Pyro system.')).not.toBeInTheDocument();
    });

    it('renders location when provided', () => {
      const data: ActivityCardData = { ...baseCardData, location: 'Grim HEX' };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Grim HEX')).toBeInTheDocument();
    });

    it('renders organization name as subtitle', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        organizationName: 'Star Runners Corp',
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Star Runners Corp')).toBeInTheDocument();
    });

    it('shows visibility label when no organization name', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        visibility: 'public',
      };
      render(<UnifiedActivityCard data={data} />);
      // "Public" appears in both subtitle and visibility badge
      const matches = screen.getAllByText(/Public/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('renders visibility badge chip', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        visibility: 'private',
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Private')).toBeInTheDocument();
    });
  });

  describe('date and time', () => {
    it('renders start date', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        startDate: '2026-04-15T14:00:00Z',
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText(/Apr/)).toBeInTheDocument();
    });

    it('renders duration from estimatedDuration', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        startDate: '2026-04-15T14:00:00Z',
        estimatedDuration: 90,
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });
  });

  describe('participants', () => {
    it('renders participant count and progress bar', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        currentParticipants: 3,
        maxParticipants: 10,
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('7 Open Spots')).toBeInTheDocument();
      expect(screen.getByText('3/10 joined')).toBeInTheDocument();
    });

    it('shows singular "Spot" for 1 open slot', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        currentParticipants: 9,
        maxParticipants: 10,
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('1 Open Spot')).toBeInTheDocument();
    });

    it('shows "Crew Full" when all slots taken', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        currentParticipants: 5,
        maxParticipants: 5,
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Crew Full')).toBeInTheDocument();
    });

    it('hides participant section when maxParticipants is 0', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        maxParticipants: 0,
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.queryByText(/joined/)).not.toBeInTheDocument();
    });
  });

  describe('job listing features', () => {
    it('renders pay display', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        type: 'job_listing',
        payDisplay: '50,000-100,000 aUEC',
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('50,000-100,000 aUEC')).toBeInTheDocument();
    });

    it('renders experience level', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        type: 'job_listing',
        experienceLevel: 3,
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });

    it('renders crew spots when no ship breakdown exists', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        type: 'job_listing',
        crewSpotsTotal: 6,
        crewSpotsFilled: 3,
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('3 Open Positions')).toBeInTheDocument();
      expect(screen.getByText('3/6 filled')).toBeInTheDocument();
    });

    it('renders ship crew breakdown when available', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        type: 'job_listing',
        shipCrewBreakdown: [
          {
            shipName: 'Crusader M2 Hercules',
            crewCapacity: 3,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'CmdrVex' },
              { role: 'gunner', total: 1, filled: 0 },
              { role: 'engineer', total: 1, filled: 0 },
            ],
          },
        ],
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Crusader M2 Hercules')).toBeInTheDocument();
      expect(screen.getByText('2 Open Positions')).toBeInTheDocument();
    });

    it('renders required ships chips', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        type: 'job_listing',
        requiredShips: ['Anvil Spartan', 'Tumbril Nova'],
        shipRequirementType: 'required',
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText('Anvil Spartan')).toBeInTheDocument();
      expect(screen.getByText('Tumbril Nova')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('calls onClick with item id when clicked', () => {
      const handleClick = jest.fn();
      render(<UnifiedActivityCard data={baseCardData} onClick={handleClick} />);

      (screen.getByText('Bounty Hunt Alpha').closest('[class]') as HTMLElement)!.click();
      expect(handleClick).toHaveBeenCalledWith('act-001');
    });
  });

  describe('footer', () => {
    it('shows relative start time when start date exists', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const data: ActivityCardData = {
        ...baseCardData,
        startDate: futureDate.toISOString(),
      };
      render(<UnifiedActivityCard data={data} />);
      expect(screen.getByText(/Starts/)).toBeInTheDocument();
    });

    it('shows relative post time when no start date', () => {
      render(<UnifiedActivityCard data={baseCardData} />);
      expect(screen.getByText(/Posted/)).toBeInTheDocument();
    });
  });

  describe('theme integration', () => {
    it('renders without errors with MUI theme provider', () => {
      const data: ActivityCardData = {
        ...baseCardData,
        description: 'Full card',
        location: 'Port Olisar',
        organizationName: 'Test Org',
        visibility: 'public',
        startDate: '2026-04-15T14:00:00Z',
        estimatedDuration: 120,
        currentParticipants: 3,
        maxParticipants: 8,
        payDisplay: '10k aUEC',
        experienceLevel: 2,
        tags: ['combat', 'escort'],
      };
      const { container } = render(<UnifiedActivityCard data={data} />);
      expect(container.firstChild).toBeTruthy();
    });

    it('renders all activity types without errors', () => {
      const types = ['mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing'];
      for (const type of types) {
        const data: ActivityCardData = {
          ...baseCardData,
          type,
          title: `Test ${type}`,
        };
        const { unmount } = render(<UnifiedActivityCard data={data} />);
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
        const data: ActivityCardData = {
          ...baseCardData,
          status,
          title: `Test ${status}`,
        };
        const { unmount } = render(<UnifiedActivityCard data={data} />);
        expect(screen.getByText(`Test ${status}`)).toBeInTheDocument();
        unmount();
      }
    });
  });
});
