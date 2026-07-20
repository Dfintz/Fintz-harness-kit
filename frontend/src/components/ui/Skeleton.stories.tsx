import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton, CardSkeleton, TableSkeleton, ListSkeleton, DashboardSkeleton, ProfileSkeleton } from './Skeleton';
import React from 'react';

/**
 * Skeleton loading components for UI placeholders.
 * Use these to replace spinners and provide content placeholders while data loads.
 * 
 * **Best Practices:**
 * - Match skeleton shapes to the actual content structure
 * - Use consistent animation style throughout the app
 * - Consider using reduced motion for users who prefer it
 */
export const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Skeleton loading placeholders that improve perceived performance by showing content structure before data loads.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'rectangular', 'circular', 'card'],
      description: 'The shape variant of the skeleton',
    },
    animation: {
      control: 'select',
      options: ['pulse', 'wave', 'none'],
      description: 'The animation style',
    },
    width: {
      control: 'text',
      description: 'Width (number for px or string for any CSS unit)',
    },
    height: {
      control: 'text',
      description: 'Height (number for px or string for any CSS unit)',
    },
    count: {
      control: 'number',
      description: 'Number of skeleton lines to render',
    },
  },
};

type Story = StoryObj<typeof meta>;

// Background wrapper for dark theme visibility
const DarkBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ 
    padding: '2rem', 
    background: '#1a1a2e',
    '--skeleton-bg': 'rgba(255, 255, 255, 0.1)',
    '--bg-secondary': '#16213e',
    '--border-color': '#0f3460'
  } as React.CSSProperties}>
    {children}
  </div>
);

export const Default: Story = {
  args: {
    variant: 'text',
    animation: 'pulse',
    width: '100%',
    height: '1rem',
  },
  decorators: [(Story) => <DarkBackground><Story /></DarkBackground>],
};

export const TextLines: Story = {
  args: {
    variant: 'text',
    count: 3,
    width: '100%',
    height: '1rem',
  },
  decorators: [(Story) => <DarkBackground><Story /></DarkBackground>],
};

export const Circular: Story = {
  args: {
    variant: 'circular',
    width: 60,
    height: 60,
  },
  decorators: [(Story) => <DarkBackground><Story /></DarkBackground>],
};

export const Rectangular: Story = {
  args: {
    variant: 'rectangular',
    width: '100%',
    height: 200,
  },
  decorators: [(Story) => <DarkBackground><Story /></DarkBackground>],
};

export const WaveAnimation: Story = {
  args: {
    variant: 'rectangular',
    animation: 'wave',
    width: '100%',
    height: 100,
  },
  decorators: [(Story) => <DarkBackground><Story /></DarkBackground>],
};

export const NoAnimation: Story = {
  args: {
    variant: 'rectangular',
    animation: 'none',
    width: '100%',
    height: 100,
  },
  decorators: [(Story) => <DarkBackground><Story /></DarkBackground>],
};

export const Card: Story = {
  render: () => (
    <DarkBackground>
      <CardSkeleton count={2} />
    </DarkBackground>
  ),
};

export const Table: Story = {
  render: () => (
    <DarkBackground>
      <TableSkeleton rows={5} columns={4} />
    </DarkBackground>
  ),
};

export const List: Story = {
  render: () => (
    <DarkBackground>
      <ListSkeleton count={5} />
    </DarkBackground>
  ),
};

export const Dashboard: Story = {
  render: () => (
    <DarkBackground>
      <DashboardSkeleton />
    </DarkBackground>
  ),
};

export const Profile: Story = {
  render: () => (
    <DarkBackground>
      <ProfileSkeleton />
    </DarkBackground>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <DarkBackground>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>Text Skeleton</h3>
          <Skeleton variant="text" count={3} />
        </div>
        
        <div>
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>Circular Skeleton</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={60} height={60} />
            <Skeleton variant="circular" width={80} height={80} />
          </div>
        </div>
        
        <div>
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>Rectangular Skeleton</h3>
          <Skeleton variant="rectangular" width="100%" height={100} />
        </div>
        
        <div>
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>Card Skeleton</h3>
          <CardSkeleton count={1} />
        </div>
      </div>
    </DarkBackground>
  ),
};

export const AnimationComparison: Story = {
  render: () => (
    <DarkBackground>
      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>Pulse</h3>
          <Skeleton animation="pulse" variant="rectangular" height={100} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>Wave</h3>
          <Skeleton animation="wave" variant="rectangular" height={100} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'white', marginBottom: '1rem' }}>None</h3>
          <Skeleton animation="none" variant="rectangular" height={100} />
        </div>
      </div>
    </DarkBackground>
  ),
};
