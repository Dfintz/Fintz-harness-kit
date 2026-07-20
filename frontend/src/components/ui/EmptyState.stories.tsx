/**
 * Storybook Stories for EmptyState Component
 *
 * Demonstrates the various configurations and use cases for the
 * EmptyState component with illustrations and CTAs.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';

export const meta: Meta<typeof EmptyState> = {
  title: 'Components/UI/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0d1117' },
        { name: 'darker', value: '#010409' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    docs: {
      description: {
        component:
          'An engaging empty state component with custom illustrations and call-to-action buttons. Supports presets for common scenarios and custom configurations.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    preset: {
      control: 'select',
      options: [undefined, 'fleet', 'ships', 'members', 'events', 'search', 'inventory', 'data', 'error', 'success'],
      description: 'Preset configuration for common empty state scenarios',
    },
    illustration: {
      control: 'select',
      options: ['ships', 'fleet', 'members', 'users', 'events', 'calendar', 'search', 'data', 'general', 'error', 'success', 'inventory', 'logistics'],
      description: 'The illustration to display',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    title: {
      control: 'text',
      description: 'Title text (overrides preset)',
    },
    description: {
      control: 'text',
      description: 'Description text (overrides preset)',
    },
  },
};

type Story = StoryObj<typeof meta>;

// ============================================
// Preset Stories
// ============================================

export const FleetPreset: Story = {
  name: 'Preset: Fleet',
  args: {
    preset: 'fleet',
    primaryAction: {
      label: 'Add Ship',
      onClick: () => console.log('Add ship clicked'),
    },
    secondaryAction: {
      label: 'Import from RSI',
      onClick: () => console.log('Import clicked'),
    },
  },
};

export const ShipsPreset: Story = {
  name: 'Preset: Ships',
  args: {
    preset: 'ships',
    primaryAction: {
      label: 'Register Ship',
      onClick: () => console.log('Register ship clicked'),
    },
  },
};

export const MembersPreset: Story = {
  name: 'Preset: Members',
  args: {
    preset: 'members',
    primaryAction: {
      label: 'Invite Pilots',
      onClick: () => console.log('Invite clicked'),
    },
    secondaryAction: {
      label: 'Learn More',
      onClick: () => console.log('Learn more clicked'),
    },
  },
};

export const EventsPreset: Story = {
  name: 'Preset: Events',
  args: {
    preset: 'events',
    primaryAction: {
      label: 'Schedule Operation',
      onClick: () => console.log('Schedule clicked'),
    },
  },
};

export const SearchPreset: Story = {
  name: 'Preset: Search',
  args: {
    preset: 'search',
    primaryAction: {
      label: 'Clear Filters',
      onClick: () => console.log('Clear filters clicked'),
    },
    secondaryAction: {
      label: 'Search Tips',
      onClick: () => console.log('Tips clicked'),
    },
  },
};

export const InventoryPreset: Story = {
  name: 'Preset: Inventory',
  args: {
    preset: 'inventory',
    primaryAction: {
      label: 'Add Item',
      onClick: () => console.log('Add item clicked'),
    },
  },
};

export const DataPreset: Story = {
  name: 'Preset: Data',
  args: {
    preset: 'data',
  },
};

export const ErrorPreset: Story = {
  name: 'Preset: Error',
  args: {
    preset: 'error',
    primaryAction: {
      label: 'Try Again',
      onClick: () => console.log('Retry clicked'),
    },
    secondaryAction: {
      label: 'Contact Support',
      onClick: () => console.log('Support clicked'),
    },
  },
};

export const SuccessPreset: Story = {
  name: 'Preset: Success',
  args: {
    preset: 'success',
    primaryAction: {
      label: 'Continue',
      onClick: () => console.log('Continue clicked'),
    },
  },
};

// ============================================
// Size Variants
// ============================================

export const SmallSize: Story = {
  name: 'Size: Small',
  args: {
    preset: 'fleet',
    size: 'sm',
    primaryAction: {
      label: 'Add Ship',
      onClick: () => console.log('Clicked'),
    },
  },
};

export const MediumSize: Story = {
  name: 'Size: Medium (Default)',
  args: {
    preset: 'fleet',
    size: 'md',
    primaryAction: {
      label: 'Add Ship',
      onClick: () => console.log('Clicked'),
    },
  },
};

export const LargeSize: Story = {
  name: 'Size: Large',
  args: {
    preset: 'fleet',
    size: 'lg',
    primaryAction: {
      label: 'Add Ship',
      onClick: () => console.log('Clicked'),
    },
    secondaryAction: {
      label: 'Learn More',
      onClick: () => console.log('Clicked'),
    },
  },
};

// ============================================
// Custom Configurations
// ============================================

export const CustomContent: Story = {
  name: 'Custom Content',
  args: {
    illustration: 'search',
    title: 'No Matches Found',
    description: 'Your search criteria returned no results. Try broadening your filters.',
    primaryAction: {
      label: 'Reset Search',
      onClick: () => console.log('Reset clicked'),
    },
  },
};

export const NoActions: Story = {
  name: 'Without Actions',
  args: {
    preset: 'data',
  },
};

export const PrimaryActionOnly: Story = {
  name: 'Primary Action Only',
  args: {
    preset: 'ships',
    primaryAction: {
      label: 'Add Your First Ship',
      onClick: () => console.log('Clicked'),
    },
  },
};

export const DisabledActions: Story = {
  name: 'Disabled Actions',
  args: {
    preset: 'members',
    primaryAction: {
      label: 'Invite Members',
      onClick: () => console.log('Clicked'),
      disabled: true,
    },
    secondaryAction: {
      label: 'Upgrade Plan',
      onClick: () => console.log('Clicked'),
    },
  },
};

// ============================================
// All Illustrations
// ============================================

export const AllIllustrations: Story = {
  name: 'All Illustrations Gallery',
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', padding: '32px' }}>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="ships"
          title="Ships/Fleet"
          description="Ship and fleet related empty states"
          size="sm"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="members"
          title="Members/Users"
          description="User and member related empty states"
          size="sm"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="events"
          title="Events/Calendar"
          description="Event and scheduling empty states"
          size="sm"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="search"
          title="Search"
          description="No search results found"
          size="sm"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="data"
          title="Data"
          description="General empty data state"
          size="sm"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="inventory"
          title="Inventory"
          description="Empty inventory/logistics"
          size="sm"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="error"
          title="Error"
          description="Error/problem state"
          size="sm"
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <EmptyState
          illustration="success"
          title="Success"
          description="Completion/success state"
          size="sm"
        />
      </div>
    </div>
  ),
};

// ============================================
// Interactive States
// ============================================

export const Interactive: Story = {
  name: 'Interactive Demo',
  args: {
    preset: 'fleet',
    size: 'md',
    primaryAction: {
      label: 'Add Ship',
      onClick: () => alert('Primary action clicked!'),
    },
    secondaryAction: {
      label: 'Import Ships',
      onClick: () => alert('Secondary action clicked!'),
    },
  },
};

// ============================================
// Real-World Examples
// ============================================

export const DashboardEmpty: Story = {
  name: 'Example: Empty Dashboard',
  args: {
    illustration: 'ships',
    title: 'Welcome, Commander!',
    description: "Your fleet awaits. Add your first ship to get started with fleet management and tracking.",
    size: 'lg',
    primaryAction: {
      label: 'Add Your First Ship',
      onClick: () => console.log('Add ship'),
    },
    secondaryAction: {
      label: 'Take a Tour',
      onClick: () => console.log('Tour'),
    },
  },
};

export const MemberSearchEmpty: Story = {
  name: 'Example: Member Search Empty',
  args: {
    illustration: 'search',
    title: 'No Pilots Found',
    description: 'No pilots match your search criteria. Try adjusting your filters or search for a different name.',
    primaryAction: {
      label: 'Clear Search',
      onClick: () => console.log('Clear'),
    },
  },
};

export const EventCalendarEmpty: Story = {
  name: 'Example: Event Calendar Empty',
  args: {
    illustration: 'events',
    title: 'No Upcoming Operations',
    description: "There are no scheduled operations for this week. Rally your fleet by creating a new event.",
    size: 'md',
    primaryAction: {
      label: 'Create Operation',
      onClick: () => console.log('Create'),
    },
    secondaryAction: {
      label: 'View Past Events',
      onClick: () => console.log('History'),
    },
  },
};

export const InventoryEmpty: Story = {
  name: 'Example: Empty Inventory',
  args: {
    illustration: 'inventory',
    title: 'Cargo Hold Empty',
    description: 'Start tracking your organization\'s supplies and equipment by adding items to the inventory.',
    primaryAction: {
      label: 'Add First Item',
      onClick: () => console.log('Add item'),
    },
  },
};

export const ServerError: Story = {
  name: 'Example: Server Error',
  args: {
    illustration: 'error',
    title: 'Connection Lost',
    description: 'We\'re having trouble connecting to the servers. Please check your connection and try again.',
    primaryAction: {
      label: 'Retry Connection',
      onClick: () => console.log('Retry'),
    },
    secondaryAction: {
      label: 'Check Status',
      onClick: () => console.log('Status'),
    },
  },
};
