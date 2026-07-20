import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { TrendIndicator } from './TrendIndicator';

export const meta: Meta<typeof TrendIndicator> = {
  title: 'Components/UI/TrendIndicator',
  component: TrendIndicator,
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
          'Visual indicator for trend direction with animated arrows and percentage display.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: 'select',
      options: ['up', 'down', 'neutral'],
      description: 'Trend direction',
    },
    value: {
      control: 'text',
      description: 'Value to display (e.g., "15%" or "+12.5%")',
    },
    label: {
      control: 'text',
      description: 'Optional label (e.g., "vs last week")',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    showIcon: {
      control: 'boolean',
      description: 'Whether to show the arrow icon',
    },
    animated: {
      control: 'boolean',
      description: 'Whether to animate the icon',
    },
    color: {
      control: 'color',
      description: 'Override automatic color based on direction',
    },
    invertColors: {
      control: 'boolean',
      description: 'Invert colors (make down green for metrics where decrease is good)',
    },
  },
};

type Story = StoryObj<typeof meta>;

/**
 * Default upward trend indicator
 */
export const Default: Story = {
  args: {
    direction: 'up',
    value: '15%',
  },
};

/**
 * Upward trend with label
 */
export const UpTrendWithLabel: Story = {
  args: {
    direction: 'up',
    value: '12.5%',
    label: 'vs last week',
  },
};

/**
 * Downward trend
 */
export const DownTrend: Story = {
  args: {
    direction: 'down',
    value: '8.3%',
    label: 'vs last month',
  },
};

/**
 * Neutral trend (no change)
 */
export const NeutralTrend: Story = {
  args: {
    direction: 'neutral',
    value: '0%',
    label: 'no change',
  },
};

/**
 * Small size
 */
export const SmallSize: Story = {
  args: {
    direction: 'up',
    value: '5%',
    size: 'sm',
  },
};

/**
 * Medium size (default)
 */
export const MediumSize: Story = {
  args: {
    direction: 'up',
    value: '10%',
    size: 'md',
  },
};

/**
 * Large size
 */
export const LargeSize: Story = {
  args: {
    direction: 'up',
    value: '25%',
    size: 'lg',
    label: 'vs last quarter',
  },
};

/**
 * Without icon (value only)
 */
export const NoIcon: Story = {
  args: {
    direction: 'up',
    value: '+15%',
    showIcon: false,
  },
};

/**
 * Without animation
 */
export const NoAnimation: Story = {
  args: {
    direction: 'up',
    value: '15%',
    animated: false,
  },
};

/**
 * Custom color
 */
export const CustomColor: Story = {
  args: {
    direction: 'up',
    value: '15%',
    color: '#00d9ff',
  },
};

/**
 * Inverted colors - useful for metrics where decrease is positive
 * (e.g., errors, bugs, costs)
 */
export const InvertedColors: Story = {
  args: {
    direction: 'down',
    value: '12%',
    label: 'fewer errors',
    invertColors: true,
  },
};

/**
 * Inverted colors - upward trend shown as negative
 * (e.g., costs increased)
 */
export const InvertedColorsUp: Story = {
  args: {
    direction: 'up',
    value: '8%',
    label: 'cost increase',
    invertColors: true,
  },
};

/**
 * Icon only (no value)
 */
export const IconOnly: Story = {
  args: {
    direction: 'up',
    showIcon: true,
  },
};

/**
 * All sizes comparison
 */
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <TrendIndicator direction="up" value="5%" size="sm" label="small" />
      <TrendIndicator direction="up" value="10%" size="md" label="medium" />
      <TrendIndicator direction="up" value="15%" size="lg" label="large" />
    </div>
  ),
};

/**
 * All directions comparison
 */
export const AllDirections: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <TrendIndicator direction="up" value="15%" label="increasing" />
      <TrendIndicator direction="down" value="8%" label="decreasing" />
      <TrendIndicator direction="neutral" value="0%" label="stable" />
    </div>
  ),
};
