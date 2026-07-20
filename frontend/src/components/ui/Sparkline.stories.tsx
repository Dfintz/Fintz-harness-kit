import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { theme } from '@/theme';
import { Sparkline, generateSparklineData } from './Sparkline';

export const meta: Meta<typeof Sparkline> = {
  title: 'Components/UI/Sparkline',
  component: Sparkline,
  decorators: [
    Story => (
      <ThemeProvider theme={theme}>
        <div
          style={{
            width: '200px',
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
          'A lightweight sparkline chart for visualizing trends in compact spaces like dashboard cards.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      control: 'object',
      description: 'Array of data points with x and y values',
    },
    width: {
      control: 'text',
      description: 'Width of the sparkline container',
    },
    height: {
      control: { type: 'number', min: 20, max: 100 },
      description: 'Height of the sparkline in pixels',
    },
    color: {
      control: 'color',
      description: 'Color of the line/area',
    },
    showArea: {
      control: 'boolean',
      description: 'Whether to show as filled area chart',
    },
    showReference: {
      control: 'boolean',
      description: 'Whether to show a reference line at the first value',
    },
    showDots: {
      control: 'boolean',
      description: 'Whether to show dots on data points',
    },
    strokeWidth: {
      control: { type: 'number', min: 1, max: 5 },
      description: 'Line thickness',
    },
    animate: {
      control: 'boolean',
      description: 'Whether to animate on initial render',
    },
    animationDuration: {
      control: { type: 'number', min: 100, max: 2000 },
      description: 'Animation duration in milliseconds',
    },
  },
};

type Story = StoryObj<typeof meta>;

// Sample data for stories
const upTrendData = [
  { x: 0, y: 10 },
  { x: 1, y: 12 },
  { x: 2, y: 11 },
  { x: 3, y: 15 },
  { x: 4, y: 18 },
  { x: 5, y: 17 },
  { x: 6, y: 22 },
];

const downTrendData = [
  { x: 0, y: 25 },
  { x: 1, y: 23 },
  { x: 2, y: 24 },
  { x: 3, y: 20 },
  { x: 4, y: 18 },
  { x: 5, y: 15 },
  { x: 6, y: 12 },
];

const neutralTrendData = [
  { x: 0, y: 15 },
  { x: 1, y: 16 },
  { x: 2, y: 14 },
  { x: 3, y: 15 },
  { x: 4, y: 16 },
  { x: 5, y: 14 },
  { x: 6, y: 15 },
];

/**
 * Default sparkline with upward trend
 */
export const Default: Story = {
  args: {
    data: upTrendData,
    height: 32,
  },
};

/**
 * Sparkline showing upward trend (automatically colored green)
 */
export const UpTrend: Story = {
  args: {
    data: upTrendData,
    height: 40,
    showArea: true,
  },
};

/**
 * Sparkline showing downward trend (automatically colored red)
 */
export const DownTrend: Story = {
  args: {
    data: downTrendData,
    height: 40,
    showArea: true,
  },
};

/**
 * Sparkline with neutral/flat trend
 */
export const NeutralTrend: Story = {
  args: {
    data: neutralTrendData,
    height: 40,
    showArea: true,
  },
};

/**
 * Sparkline with custom color
 */
export const CustomColor: Story = {
  args: {
    data: upTrendData,
    height: 40,
    color: '#00d9ff',
    showArea: true,
  },
};

/**
 * Sparkline with area fill
 */
export const WithArea: Story = {
  args: {
    data: generateSparklineData(7, 100, 20),
    height: 48,
    showArea: true,
    color: '#00ff88',
  },
};

/**
 * Line only (no area fill)
 */
export const LineOnly: Story = {
  args: {
    data: upTrendData,
    height: 32,
    showArea: false,
    strokeWidth: 2,
  },
};

/**
 * Sparkline with data point dots
 */
export const WithDots: Story = {
  args: {
    data: upTrendData,
    height: 40,
    showDots: true,
    showArea: true,
  },
};

/**
 * Sparkline with reference line at starting value
 */
export const WithReferenceLine: Story = {
  args: {
    data: upTrendData,
    height: 48,
    showReference: true,
    showArea: true,
  },
};

/**
 * Smaller sparkline for tight spaces
 */
export const Small: Story = {
  args: {
    data: upTrendData,
    height: 24,
    strokeWidth: 1,
  },
};

/**
 * Larger sparkline for featured metrics
 */
export const Large: Story = {
  args: {
    data: upTrendData,
    height: 60,
    showArea: true,
    showDots: true,
    strokeWidth: 3,
  },
};

/**
 * Using the generateSparklineData helper
 */
export const RandomData: Story = {
  args: {
    data: generateSparklineData(10, 50, 15),
    height: 40,
    showArea: true,
  },
};

/**
 * No animation
 */
export const NoAnimation: Story = {
  args: {
    data: upTrendData,
    height: 40,
    animate: false,
    showArea: true,
  },
};

/**
 * Slow animation
 */
export const SlowAnimation: Story = {
  args: {
    data: upTrendData,
    height: 40,
    animationDuration: 1500,
    showArea: true,
  },
};
