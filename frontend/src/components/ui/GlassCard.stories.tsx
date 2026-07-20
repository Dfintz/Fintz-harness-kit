import type { Meta, StoryObj } from '@storybook/react';
import { GlassCard } from './GlassCard';

export const meta: Meta<typeof GlassCard> = {
  title: 'UI/Glass/GlassCard',
  component: GlassCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a1628' },
        { name: 'gradient', value: 'linear-gradient(135deg, #0a1628 0%, #1a2744 100%)' },
      ],
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['clear', 'frosted', 'tinted'],
      description: 'Glass variant style',
    },
    glowColor: {
      control: 'select',
      options: ['none', 'cyan', 'purple', 'green', 'orange'],
      description: 'Glow color for border effect',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Card size (affects padding)',
    },
    interactive: {
      control: 'boolean',
      description: 'Whether the card is interactive (hoverable)',
    },
    selected: {
      control: 'boolean',
      description: 'Whether the card is selected',
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          padding: '40px',
          background: 'linear-gradient(135deg, #0a1628 0%, #1a2744 100%)',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

type Story = StoryObj<typeof GlassCard>;

/**
 * Default frosted glass card with cyan glow
 */
export const Default: Story = {
  args: {
    title: 'Fleet Overview',
    subtitle: 'Current fleet statistics',
    children: (
      <div>
        <p style={{ margin: '0 0 12px 0' }}>Total Ships: 24</p>
        <p style={{ margin: '0 0 12px 0' }}>Active Pilots: 18</p>
        <p style={{ margin: '0' }}>Value: 125,000,000 aUEC</p>
      </div>
    ),
  },
};

/**
 * Clear variant - more transparent
 */
export const Clear: Story = {
  args: {
    variant: 'clear',
    title: 'Clear Glass',
    children: <p>More transparent background with stronger blur effect.</p>,
  },
};

/**
 * Tinted variant - colored tint
 */
export const Tinted: Story = {
  args: {
    variant: 'tinted',
    glowColor: 'purple',
    title: 'Tinted Glass',
    children: <p>Colored tint with glass blur for accent areas.</p>,
  },
};

/**
 * Different glow colors
 */
export const GlowColors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      <GlassCard glowColor="cyan" title="Cyan Glow" size="sm">
        <p>Default accent color</p>
      </GlassCard>
      <GlassCard glowColor="purple" title="Purple Glow" size="sm">
        <p>Alternative accent</p>
      </GlassCard>
      <GlassCard glowColor="green" title="Green Glow" size="sm">
        <p>Success indicator</p>
      </GlassCard>
      <GlassCard glowColor="orange" title="Orange Glow" size="sm">
        <p>Warning indicator</p>
      </GlassCard>
      <GlassCard glowColor="none" title="No Glow" size="sm">
        <p>Minimal style</p>
      </GlassCard>
    </div>
  ),
};

/**
 * Interactive card with hover effects
 */
export const Interactive: Story = {
  args: {
    title: 'Interactive Card',
    subtitle: 'Click or hover me',
    interactive: true,
    onClick: () => alert('Card clicked!'),
    children: (
      <p>
        This card has hover effects and can be clicked. It includes proper keyboard navigation
        support.
      </p>
    ),
  },
};

/**
 * Selected state
 */
export const Selected: Story = {
  args: {
    title: 'Selected Card',
    interactive: true,
    selected: true,
    glowColor: 'green',
    children: <p>This card is in a selected state with enhanced glow.</p>,
  },
};

/**
 * Size variants
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <GlassCard size="sm" title="Small">
        <p>Compact padding</p>
      </GlassCard>
      <GlassCard size="md" title="Medium">
        <p>Default padding</p>
      </GlassCard>
      <GlassCard size="lg" title="Large">
        <p>Spacious padding</p>
      </GlassCard>
    </div>
  ),
};

/**
 * With header action
 */
export const WithHeaderAction: Story = {
  args: {
    title: 'Ship Details',
    subtitle: 'Carrack - Expedition',
    headerAction: (
      <button
        style={{
          padding: '6px 12px',
          background: 'rgba(0, 217, 255, 0.2)',
          border: '1px solid rgba(0, 217, 255, 0.3)',
          borderRadius: '6px',
          color: '#00d9ff',
          cursor: 'pointer',
        }}
      >
        Edit
      </button>
    ),
    children: (
      <div>
        <p style={{ margin: '0 0 8px 0' }}>Status: Active</p>
        <p style={{ margin: '0 0 8px 0' }}>Crew: 6/8</p>
        <p style={{ margin: '0' }}>Location: Stanton System</p>
      </div>
    ),
  },
};

/**
 * With footer
 */
export const WithFooter: Story = {
  args: {
    title: 'Mission Briefing',
    children: (
      <p>
        Transport cargo from Port Olisar to Area 18. Estimated time: 45 minutes. Payment: 15,000
        aUEC.
      </p>
    ),
    footer: (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: '#8a9eb5',
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
        <button
          style={{
            padding: '8px 16px',
            background: 'rgba(0, 217, 255, 0.2)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
            borderRadius: '6px',
            color: '#00d9ff',
            cursor: 'pointer',
          }}
        >
          Accept
        </button>
      </div>
    ),
  },
};

/**
 * Grid layout example
 */
export const GridLayout: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        width: '800px',
      }}
    >
      <GlassCard title="Ships" glowColor="cyan" interactive>
        <p style={{ fontSize: '2rem', margin: '8px 0', fontWeight: 600, color: '#00d9ff' }}>24</p>
        <p style={{ margin: 0, color: '#8a9eb5' }}>Total fleet size</p>
      </GlassCard>
      <GlassCard title="Members" glowColor="purple" interactive>
        <p style={{ fontSize: '2rem', margin: '8px 0', fontWeight: 600, color: '#a855f7' }}>156</p>
        <p style={{ margin: 0, color: '#8a9eb5' }}>Active pilots</p>
      </GlassCard>
      <GlassCard title="Value" glowColor="green" interactive>
        <p style={{ fontSize: '2rem', margin: '8px 0', fontWeight: 600, color: '#00ff88' }}>1.2B</p>
        <p style={{ margin: 0, color: '#8a9eb5' }}>Total aUEC</p>
      </GlassCard>
    </div>
  ),
};
