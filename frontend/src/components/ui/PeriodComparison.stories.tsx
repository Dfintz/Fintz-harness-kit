import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { PeriodComparison } from './PeriodComparison';

export const meta: Meta<typeof PeriodComparison> = {
  title: 'Components/UI/PeriodComparison',
  component: PeriodComparison,
  decorators: [
    Story => (
      <ThemeProvider theme={theme}>
        <div
          style={{
            padding: '24px',
            background: 'linear-gradient(180deg, #0a1628 0%, #0f1d35 100%)',
            color: '#ffffff',
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
          'Compare values across time periods with automatic trend calculation and formatting.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    current: {
      control: 'number',
      description: 'Current period value',
    },
    previous: {
      control: 'number',
      description: 'Previous period value',
    },
    period: {
      control: 'select',
      options: ['hour', 'day', 'week', 'month', 'quarter', 'year', 'custom'],
      description: 'Period being compared',
    },
    customPeriodLabel: {
      control: 'text',
      description: 'Custom period label (used when period is "custom")',
    },
    format: {
      control: 'select',
      options: ['number', 'currency', 'percent'],
      description: 'Format for displaying values',
    },
    currencySymbol: {
      control: 'text',
      description: 'Currency symbol for currency format',
    },
    decimals: {
      control: { type: 'number', min: 0, max: 4 },
      description: 'Decimal places for percentage display',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    decreaseIsGood: {
      control: 'boolean',
      description: 'Whether decrease is good (inverts colors)',
    },
    showPreviousValue: {
      control: 'boolean',
      description: 'Show the previous value',
    },
  },
};

type Story = StoryObj<typeof meta>;

/**
 * Default comparison showing increase
 */
export const Default: Story = {
  args: {
    current: 125,
    previous: 100,
    period: 'week',
  },
};

/**
 * Comparison showing increase (vs last week)
 */
export const Increase: Story = {
  args: {
    current: 150,
    previous: 120,
    period: 'week',
  },
};

/**
 * Comparison showing decrease
 */
export const Decrease: Story = {
  args: {
    current: 80,
    previous: 100,
    period: 'month',
  },
};

/**
 * No change (neutral)
 */
export const NoChange: Story = {
  args: {
    current: 100,
    previous: 100,
    period: 'day',
  },
};

/**
 * Currency format
 */
export const CurrencyFormat: Story = {
  args: {
    current: 2500000,
    previous: 2100000,
    period: 'quarter',
    format: 'currency',
    showPreviousValue: true,
  },
};

/**
 * Currency format with Euro symbol
 */
export const EuroCurrency: Story = {
  args: {
    current: 1850,
    previous: 1500,
    period: 'month',
    format: 'currency',
    currencySymbol: '€',
    showPreviousValue: true,
  },
};

/**
 * Showing previous value
 */
export const WithPreviousValue: Story = {
  args: {
    current: 42,
    previous: 35,
    period: 'week',
    showPreviousValue: true,
  },
};

/**
 * Different time periods
 */
export const HourlyComparison: Story = {
  args: {
    current: 156,
    previous: 142,
    period: 'hour',
  },
};

/**
 * Daily comparison
 */
export const DailyComparison: Story = {
  args: {
    current: 1250,
    previous: 1180,
    period: 'day',
  },
};

/**
 * Monthly comparison
 */
export const MonthlyComparison: Story = {
  args: {
    current: 45000,
    previous: 38000,
    period: 'month',
  },
};

/**
 * Yearly comparison
 */
export const YearlyComparison: Story = {
  args: {
    current: 525000,
    previous: 480000,
    period: 'year',
  },
};

/**
 * Custom period label
 */
export const CustomPeriod: Story = {
  args: {
    current: 89,
    previous: 76,
    period: 'custom',
    customPeriodLabel: 'vs last sprint',
  },
};

/**
 * Decrease is good (e.g., errors, bugs, costs)
 */
export const DecreaseIsGood: Story = {
  args: {
    current: 12,
    previous: 18,
    period: 'day',
    decreaseIsGood: true,
  },
};

/**
 * Small size
 */
export const SmallSize: Story = {
  args: {
    current: 125,
    previous: 100,
    period: 'week',
    size: 'sm',
  },
};

/**
 * Large size
 */
export const LargeSize: Story = {
  args: {
    current: 125,
    previous: 100,
    period: 'week',
    size: 'lg',
  },
};

/**
 * More decimal places
 */
export const MoreDecimals: Story = {
  args: {
    current: 123.456,
    previous: 100,
    period: 'week',
    decimals: 2,
  },
};

/**
 * All sizes comparison
 */
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PeriodComparison current={125} previous={100} period="week" size="sm" />
      <PeriodComparison current={125} previous={100} period="week" size="md" />
      <PeriodComparison current={125} previous={100} period="week" size="lg" />
    </div>
  ),
};

/**
 * All periods comparison
 */
export const AllPeriods: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <PeriodComparison current={110} previous={100} period="hour" />
      <PeriodComparison current={120} previous={100} period="day" />
      <PeriodComparison current={130} previous={100} period="week" />
      <PeriodComparison current={140} previous={100} period="month" />
      <PeriodComparison current={150} previous={100} period="quarter" />
      <PeriodComparison current={160} previous={100} period="year" />
    </div>
  ),
};
