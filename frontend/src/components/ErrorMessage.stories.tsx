import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { theme } from '@/theme';
import { ErrorMessage } from './ErrorMessage';

export const meta: Meta<typeof ErrorMessage> = {
  title: 'Components/ErrorMessage',
  component: ErrorMessage,
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
          'Error message component for displaying errors with optional retry and dismiss actions.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    message: {
      control: 'text',
      description: 'The error message to display',
    },
    onRetry: {
      action: 'retry clicked',
      description: 'Callback when retry button is clicked',
    },
    onDismiss: {
      action: 'dismiss clicked',
      description: 'Callback when dismiss button is clicked',
    },
  },
};

type Story = StoryObj<typeof meta>;

/**
 * Default error message
 */
export const Default: Story = {
  args: {
    message: 'An unexpected error occurred. Please try again.',
  },
};

/**
 * Error with retry action
 */
export const WithRetry: Story = {
  args: {
    message: 'Failed to load fleet data. Please check your connection and try again.',
    onRetry: fn(),
  },
};

/**
 * Error with dismiss action
 */
export const WithDismiss: Story = {
  args: {
    message: 'Unable to save changes. Your data may not be persisted.',
    onDismiss: fn(),
  },
};

/**
 * Error with both actions
 */
export const WithBothActions: Story = {
  args: {
    message: 'Failed to sync organization data. You can retry or dismiss this message.',
    onRetry: fn(),
    onDismiss: fn(),
  },
};

/**
 * Network error
 */
export const NetworkError: Story = {
  args: {
    message: 'Network connection lost. Please check your internet connection and try again.',
    onRetry: fn(),
  },
};

/**
 * Authentication error
 */
export const AuthError: Story = {
  args: {
    message: 'Your session has expired. Please log in again to continue.',
    onDismiss: fn(),
  },
};

/**
 * Permission error
 */
export const PermissionError: Story = {
  args: {
    message:
      'You do not have permission to access this resource. Contact your organization administrator.',
  },
};

/**
 * Intel Vault access denied
 */
export const IntelAccessDenied: Story = {
  args: {
    message: 'Insufficient clearance level. This intel entry requires TOP_SECRET clearance.',
  },
};

/**
 * Long error message
 */
export const LongMessage: Story = {
  args: {
    message:
      'The operation could not be completed due to a server-side error. This may be a temporary issue. If the problem persists, please contact support with the following error code: ERR_FLEET_SYNC_TIMEOUT_0x5F3A',
    onRetry: fn(),
    onDismiss: fn(),
  },
};
