import { Add, ChevronRight, Delete } from '@mui/icons-material';
import type { Meta, StoryObj } from '@storybook/react';
import { GlassButton } from './GlassButton';
export const meta: Meta<typeof GlassButton> = {
  title: 'Components/UI/GlassButton',
  component: GlassButton,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a1628' },
        { name: 'light', value: '#f5f5f5' },
      ],
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'accent', 'ghost', 'danger', 'success'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    loading: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    fullWidth: {
      control: 'boolean',
    },
    pulse: {
      control: 'boolean',
    },
  },
  decorators: [
    Story => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
};

type Story = StoryObj<typeof GlassButton>;

// Default story
export const Default: Story = {
  args: {
    children: 'Glass Button',
    variant: 'primary',
    size: 'md',
  },
};

// All variants
export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <GlassButton variant="primary">Primary</GlassButton>
      <GlassButton variant="secondary">Secondary</GlassButton>
      <GlassButton variant="accent">Accent</GlassButton>
      <GlassButton variant="ghost">Ghost</GlassButton>
      <GlassButton variant="danger">Danger</GlassButton>
      <GlassButton variant="success">Success</GlassButton>
    </div>
  ),
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <GlassButton size="sm">Small</GlassButton>
      <GlassButton size="md">Medium</GlassButton>
      <GlassButton size="lg">Large</GlassButton>
    </div>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <GlassButton icon={<Add />}>Add Item</GlassButton>
      <GlassButton iconEnd={<ChevronRight />}>Continue</GlassButton>
      <GlassButton icon={<Add />} iconEnd={<ChevronRight />}>
        Both Icons
      </GlassButton>
      <GlassButton variant="danger" icon={<Delete />}>
        Delete
      </GlassButton>
    </div>
  ),
};

// Loading states
export const Loading: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <GlassButton loading>Loading</GlassButton>
      <GlassButton variant="accent" loading>
        Processing
      </GlassButton>
      <GlassButton variant="success" loading size="lg">
        Please Wait
      </GlassButton>
    </div>
  ),
};

// Disabled state
export const Disabled: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <GlassButton disabled>Disabled Primary</GlassButton>
      <GlassButton variant="accent" disabled>
        Disabled Accent
      </GlassButton>
      <GlassButton variant="danger" disabled>
        Disabled Danger
      </GlassButton>
    </div>
  ),
};

// Full width
export const FullWidth: Story = {
  render: () => (
    <div style={{ width: '300px' }}>
      <GlassButton fullWidth>Full Width Button</GlassButton>
      <div style={{ marginTop: '1rem' }}>
        <GlassButton variant="accent" fullWidth icon={<Add />}>
          Full Width with Icon
        </GlassButton>
      </div>
    </div>
  ),
};

// Pulse animation
export const Pulse: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <GlassButton pulse>Attention</GlassButton>
      <GlassButton variant="success" pulse>
        New Feature
      </GlassButton>
      <GlassButton variant="danger" pulse>
        Alert
      </GlassButton>
    </div>
  ),
};

// Custom glow color
export const CustomGlow: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <GlassButton glowColor="rgba(255, 0, 255, 0.4)">Purple Glow</GlassButton>
      <GlassButton glowColor="rgba(255, 215, 0, 0.4)">Gold Glow</GlassButton>
      <GlassButton glowColor="rgba(0, 255, 255, 0.4)">Cyan Glow</GlassButton>
    </div>
  ),
};

// Interactive demo
export const Interactive: Story = {
  args: {
    children: 'Click Me',
    variant: 'primary',
    size: 'md',
    onClick: () => alert('Button clicked!'),
  },
};
