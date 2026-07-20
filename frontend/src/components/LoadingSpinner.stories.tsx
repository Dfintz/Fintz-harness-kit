import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSpinner } from './LoadingSpinner';

export const meta: Meta<typeof LoadingSpinner> = {
  title: 'Components/LoadingSpinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A loading spinner component to indicate pending operations. Includes accessibility features with ARIA live region support.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    message: {
      control: 'text',
      description: 'The loading message to display below the spinner',
      table: {
        defaultValue: { summary: 'Loading...' },
      },
    },
  },
};

type Story = StoryObj<typeof meta>;

/**
 * Default loading spinner with standard message
 */
export const Default: Story = {
  args: {},
};

/**
 * Loading spinner with custom message
 */
export const CustomMessage: Story = {
  args: {
    message: 'Fetching fleet data...',
  },
};

/**
 * Loading spinner for fleet operations
 */
export const FleetLoading: Story = {
  args: {
    message: 'Loading fleet information...',
  },
};

/**
 * Loading spinner for Intel Vault
 */
export const IntelVaultLoading: Story = {
  args: {
    message: 'Decrypting intel data...',
  },
};

/**
 * Loading spinner for organization data
 */
export const OrganizationLoading: Story = {
  args: {
    message: 'Synchronizing organization data...',
  },
};

/**
 * Loading spinner for authentication
 */
export const AuthLoading: Story = {
  args: {
    message: 'Authenticating with Discord...',
  },
};

/**
 * Loading spinner with long message
 */
export const LongMessage: Story = {
  args: {
    message: 'This is a longer loading message that may wrap to multiple lines in certain layouts',
  },
};
