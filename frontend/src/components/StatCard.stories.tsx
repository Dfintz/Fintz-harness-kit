import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { theme } from '@/theme';
import { StatCard } from './StatCard';
import { generateSparklineData } from './ui/Sparkline';

export const meta: Meta<typeof StatCard> = {
  title: 'Components/StatCard',
  component: StatCard,
  decorators: [
    Story => (
      <ThemeProvider theme={theme}>
        <div
          style={{
            width: '300px',
            padding: '24px',
            background: 'linear-gradient(180deg, #0a1628 0%, #0f1d35 100%)',
          }}
        >
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Statistics card component for displaying key metrics on dashboards with sparkline trends and period comparisons.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'The label/title of the stat card',
    },
    value: {
      control: 'text',
      description: 'The main value to display',
    },
    subtitle: {
      control: 'text',
      description: 'Optional subtitle text',
    },
    color: {
      control: 'color',
      description: 'Accent color for the card',
    },
    trend: {
      control: 'select',
      options: ['up', 'down', 'neutral'],
      description: 'Trend direction indicator (legacy)',
    },
    trendValue: {
      control: 'text',
      description: 'Trend value text (legacy, e.g., "+12%")',
    },
    sparklineData: {
      control: 'object',
      description: 'Data points for sparkline visualization',
    },
    previousValue: {
      control: 'number',
      description: 'Previous period value for automatic comparison',
    },
    comparisonPeriod: {
      control: 'select',
      options: ['hour', 'day', 'week', 'month', 'quarter', 'year'],
      description: 'Period for comparison label',
    },
    decreaseIsGood: {
      control: 'boolean',
      description: 'Whether decrease is positive (for metrics like errors)',
    },
    sparklineArea: {
      control: 'boolean',
      description: 'Whether to show area fill in sparkline',
    },
  },
};

type Story = StoryObj<typeof meta>;

/**
 * Default stat card
 */
export const Default: Story = {
  args: {
    label: 'Total Ships',
    value: '42',
  },
};

/**
 * Stat card with subtitle
 */
export const WithSubtitle: Story = {
  args: {
    label: 'Active Fleets',
    value: '8',
    subtitle: 'Across 3 organizations',
  },
};

/**
 * Stat card with upward trend
 */
export const TrendUp: Story = {
  args: {
    label: 'Fleet Value',
    value: '$2.5M',
    subtitle: 'Total ship value',
    trend: 'up',
    trendValue: '+15%',
  },
};

/**
 * Stat card with downward trend
 */
export const TrendDown: Story = {
  args: {
    label: 'Pending Repairs',
    value: '3',
    subtitle: 'Ships needing maintenance',
    trend: 'down',
    trendValue: '-25%',
  },
};

/**
 * Stat card with neutral trend
 */
export const TrendNeutral: Story = {
  args: {
    label: 'Active Members',
    value: '156',
    subtitle: 'Online now',
    trend: 'neutral',
    trendValue: '0%',
  },
};

/**
 * Fleet count card with cyan accent
 */
export const FleetCount: Story = {
  args: {
    label: 'Fleet Strength',
    value: '24',
    subtitle: 'Combat-ready ships',
    color: '#00d9ff',
    trend: 'up',
    trendValue: '+4',
  },
};

/**
 * Credits card with gold accent
 */
export const Credits: Story = {
  args: {
    label: 'Organization Credits',
    value: '12.5M aUEC',
    subtitle: 'Available balance',
    color: '#ffd700',
    trend: 'up',
    trendValue: '+2.3M',
  },
};

/**
 * Intel entries card with purple accent
 */
export const IntelEntries: Story = {
  args: {
    label: 'Intel Entries',
    value: '847',
    subtitle: 'Total intelligence records',
    color: '#9333ea',
    trend: 'up',
    trendValue: '+23 this week',
  },
};

/**
 * Events card with green accent
 */
export const UpcomingEvents: Story = {
  args: {
    label: 'Scheduled Events',
    value: '12',
    subtitle: 'This week',
    color: '#22c55e',
    trend: 'neutral',
    trendValue: 'Same as last week',
  },
};

/**
 * Alert card with red accent
 */
export const AlertCard: Story = {
  args: {
    label: 'Security Alerts',
    value: '5',
    subtitle: 'Require attention',
    color: '#ef4444',
    trend: 'up',
    trendValue: '+2 new',
  },
};

/**
 * Large number value
 */
export const LargeValue: Story = {
  args: {
    label: 'Total Operations',
    value: '1,247,892',
    subtitle: 'All-time operations completed',
  },
};

// Sample sparkline data
const upTrendSparkline = [
  { x: 0, y: 35 },
  { x: 1, y: 38 },
  { x: 2, y: 36 },
  { x: 3, y: 40 },
  { x: 4, y: 39 },
  { x: 5, y: 42 },
  { x: 6, y: 48 },
];

const downTrendSparkline = [
  { x: 0, y: 55 },
  { x: 1, y: 52 },
  { x: 2, y: 48 },
  { x: 3, y: 50 },
  { x: 4, y: 45 },
  { x: 5, y: 42 },
  { x: 6, y: 38 },
];

/**
 * Stat card with sparkline showing upward trend
 */
export const WithSparklineUp: Story = {
  args: {
    label: 'Active Members',
    value: 48,
    subtitle: 'Online this week',
    color: '#00d9ff',
    sparklineData: upTrendSparkline,
    previousValue: 35,
    comparisonPeriod: 'week',
  },
};

/**
 * Stat card with sparkline showing downward trend
 */
export const WithSparklineDown: Story = {
  args: {
    label: 'Pending Repairs',
    value: 8,
    subtitle: 'Ships needing maintenance',
    color: '#ffaa00',
    sparklineData: downTrendSparkline,
    previousValue: 15,
    comparisonPeriod: 'week',
    decreaseIsGood: true,
  },
};

/**
 * Stat card with generated random sparkline data
 */
export const WithGeneratedSparkline: Story = {
  args: {
    label: 'Fleet Operations',
    value: 156,
    subtitle: 'Completed missions',
    color: '#00ff88',
    sparklineData: generateSparklineData(7, 156, 20),
    previousValue: 142,
    comparisonPeriod: 'month',
  },
};

/**
 * Stat card with line-only sparkline (no area fill)
 */
export const SparklineLineOnly: Story = {
  args: {
    label: 'Trading Volume',
    value: '2.4M aUEC',
    subtitle: 'Last 7 days',
    color: '#ffd700',
    sparklineData: upTrendSparkline,
    sparklineArea: false,
    previousValue: 1800000,
    comparisonPeriod: 'week',
  },
};

/**
 * Fleet strength with period comparison
 */
export const FleetWithComparison: Story = {
  args: {
    label: 'Fleet Size',
    value: 24,
    subtitle: 'Combat-ready ships',
    color: '#00d9ff',
    sparklineData: generateSparklineData(7, 24, 3),
    previousValue: 20,
    comparisonPeriod: 'month',
  },
};

/**
 * Errors metric where decrease is good
 */
export const ErrorsDecreaseGood: Story = {
  args: {
    label: 'System Errors',
    value: 3,
    subtitle: 'Last 24 hours',
    color: '#ef4444',
    sparklineData: downTrendSparkline,
    previousValue: 12,
    comparisonPeriod: 'day',
    decreaseIsGood: true,
  },
};

/**
 * Multiple cards in a row
 */
export const CardRow: Story = {
  decorators: [
    Story => (
      <ThemeProvider theme={theme}>
        <div
          style={{
            display: 'Stack',
            gap: '16px',
            padding: '24px',
            background: 'linear-gradient(180deg, #0a1628 0%, #0f1d35 100%)',
          }}
        >
          <StatCard
            label="Members"
            value={156}
            subtitle="Active users"
            color="#00d9ff"
            sparklineData={generateSparklineData(7, 156, 15)}
            previousValue={142}
            comparisonPeriod="week"
          />
          <StatCard
            label="Ships"
            value={48}
            subtitle="In fleet"
            color="#00ff88"
            sparklineData={generateSparklineData(7, 48, 8)}
            previousValue={44}
            comparisonPeriod="month"
          />
          <StatCard
            label="Credits"
            value="12.5M"
            subtitle="aUEC balance"
            color="#ffd700"
            sparklineData={generateSparklineData(7, 12500000, 1500000)}
            previousValue={10200000}
            comparisonPeriod="week"
          />
        </div>
      </ThemeProvider>
    ),
  ],
  render: () => <></>,
};
