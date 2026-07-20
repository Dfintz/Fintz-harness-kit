import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { theme } from '@/theme';
import { EmptyState } from './EmptyState';

export const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  decorators: [
    Story => (
      <ThemeProvider theme={theme}>
        <div
          style={{
            width: '600px',
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
          'Empty state component displayed when there is no data to show. Can include an action button to guide users.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'The main title of the empty state',
    },
    description: {
      control: 'text',
      description: 'Detailed description of why the state is empty and what users can do',
    },
    actionLabel: {
      control: 'text',
      description: 'Label for the optional action button',
    },
    onAction: {
      action: 'action clicked',
      description: 'Callback when action button is clicked',
    },
  },
};

type Story = StoryObj<typeof meta>;

/**
 * Default empty state with title and description
 */
export const Default: Story = {
  args: {
    title: 'No Data Available',
    description: 'There is no data to display at this time.',
  },
};

/**
 * Empty state for fleets
 */
export const NoFleets: Story = {
  args: {
    title: 'No Fleets Found',
    description:
      "You haven't created any fleets yet. Create your first fleet to start organizing your ships.",
    actionLabel: 'Create Fleet',
    onAction: fn(),
  },
};

/**
 * Empty state for Intel Vault
 */
export const NoIntelEntries: Story = {
  args: {
    title: 'Intel Vault is Empty',
    description:
      'No intelligence entries have been created. Start documenting strategic information for your organization.',
    actionLabel: 'Add Intel Entry',
    onAction: fn(),
  },
};

/**
 * Empty state for ships
 */
export const NoShips: Story = {
  args: {
    title: 'No Ships in Hangar',
    description: 'Your personal hangar is empty. Add ships to start tracking your fleet.',
    actionLabel: 'Add Ship',
    onAction: fn(),
  },
};

/**
 * Empty state for search results
 */
export const NoSearchResults: Story = {
  args: {
    title: 'No Results Found',
    description:
      "We couldn't find anything matching your search criteria. Try adjusting your filters or search terms.",
  },
};

/**
 * Empty state for events
 */
export const NoEvents: Story = {
  args: {
    title: 'No Scheduled Events',
    description: 'There are no upcoming events. Check back later or create a new event.',
    actionLabel: 'Schedule Event',
    onAction: fn(),
  },
};

/**
 * Empty state for audit logs
 */
export const NoAuditLogs: Story = {
  args: {
    title: 'No Audit Records',
    description:
      'No activity has been recorded yet. Audit logs will appear here as actions are performed.',
  },
};

/**
 * Empty state with long description
 */
export const LongDescription: Story = {
  args: {
    title: 'Getting Started',
    description:
      'Welcome to the Star Citizen Fleet Manager! This is your command center for managing your fleet, coordinating with your organization, and planning tactical operations. Start by adding your ships and joining an organization to unlock all features.',
    actionLabel: 'Get Started',
    onAction: fn(),
  },
};
