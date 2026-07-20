/**
 * IconButton Stories - Storybook documentation for IconButton component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Box } from '@mui/material';
import {
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { IconButton } from './IconButton';

export const meta: Meta<typeof IconButton> = {
  title: 'UI/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
IconButton provides a unified icon button interface using Material-UI's IconButton.

## Features
- Multiple sizes (sm, md, lg)
- Optional tooltip on hover
- Quiet/subtle styling option
- Color variants
- Full backward compatibility with Spectrum ActionButton

## Usage
\`\`\`tsx

// Basic
<IconButton onClick={handleClick} aria-label="Refresh">
  <RefreshIcon />
</IconButton>

// With tooltip
<IconButton tooltip="Refresh data" onClick={handleClick}>
  <RefreshIcon />
</IconButton>

// Quiet variant
<IconButton isQuiet onClick={handleClick} aria-label="Menu">
  <MenuIcon />
</IconButton>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'default', 'error', 'info', 'success', 'warning'],
    },
    disabled: {
      control: 'boolean',
    },
    isQuiet: {
      control: 'boolean',
    },
    tooltip: {
      control: 'text',
    },
  },
};

type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    'aria-label': 'Refresh',
    children: <RefreshIcon />,
  },
};

export const WithTooltip: Story = {
  args: {
    tooltip: 'Refresh data',
    children: <RefreshIcon />,
  },
  parameters: {
    docs: {
      description: {
        story: 'Hover over the button to see the tooltip.',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" spacing={2} alignItems="center">
      <IconButton size="sm" tooltip="Small" aria-label="Small button">
        <RefreshIcon fontSize="small" />
      </IconButton>
      <IconButton size="md" tooltip="Medium" aria-label="Medium button">
        <RefreshIcon />
      </IconButton>
      <IconButton size="lg" tooltip="Large" aria-label="Large button">
        <RefreshIcon fontSize="large" />
      </IconButton>
    </Stack>
  ),
};

export const Colors: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <IconButton color="primary" tooltip="Primary" aria-label="Primary">
        <AddIcon />
      </IconButton>
      <IconButton color="secondary" tooltip="Secondary" aria-label="Secondary">
        <EditIcon />
      </IconButton>
      <IconButton color="error" tooltip="Delete" aria-label="Delete">
        <DeleteIcon />
      </IconButton>
      <IconButton color="success" tooltip="Success" aria-label="Success">
        <AddIcon />
      </IconButton>
      <IconButton color="warning" tooltip="Warning" aria-label="Warning">
        <NotificationsIcon />
      </IconButton>
      <IconButton color="info" tooltip="Info" aria-label="Info">
        <SearchIcon />
      </IconButton>
    </Stack>
  ),
};

export const QuietVariant: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <Box>
        <p style={{ color: '#9e9e9e', marginBottom: 8, fontSize: '0.875rem' }}>Standard:</p>
        <IconButton tooltip="Standard" aria-label="Standard">
          <SettingsIcon />
        </IconButton>
      </Box>
      <Box>
        <p style={{ color: '#9e9e9e', marginBottom: 8, fontSize: '0.875rem' }}>Quiet:</p>
        <IconButton isQuiet tooltip="Quiet/Subtle" aria-label="Quiet">
          <SettingsIcon />
        </IconButton>
      </Box>
    </Stack>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Use `isQuiet` for a more subtle appearance, ideal for secondary actions.',
      },
    },
  },
};

export const Disabled: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <IconButton disabled aria-label="Disabled button">
        <RefreshIcon />
      </IconButton>
      <IconButton disabled tooltip="This action is disabled" aria-label="Disabled with tooltip">
        <DeleteIcon />
      </IconButton>
    </Stack>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Disabled buttons still show tooltips to explain why the action is unavailable.',
      },
    },
  },
};

export const EdgePlacement: Story = {
  render: () => (
    <Box sx={{
      p: 2,
      border: '1px solid #333',
      borderRadius: 1,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: 300,
    }}>
      <IconButton edge="start" tooltip="Start edge" aria-label="Start">
        <MenuIcon />
      </IconButton>
      <span style={{ color: '#9e9e9e' }}>Content</span>
      <IconButton edge="end" tooltip="End edge" aria-label="End">
        <CloseIcon />
      </IconButton>
    </Box>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Use `edge` prop to adjust padding for buttons at the start or end of containers.',
      },
    },
  },
};

export const CommonUseCases: Story = {
  render: () => (
    <Stack spacing={3}>
      {/* Toolbar actions */}
      <Box>
        <p style={{ color: '#9e9e9e', marginBottom: 8, fontSize: '0.875rem' }}>Toolbar Actions:</p>
        <Stack direction="row" spacing={1}>
          <IconButton tooltip="Add new" aria-label="Add">
            <AddIcon />
          </IconButton>
          <IconButton tooltip="Edit" aria-label="Edit">
            <EditIcon />
          </IconButton>
          <IconButton tooltip="Delete" color="error" aria-label="Delete">
            <DeleteIcon />
          </IconButton>
          <IconButton tooltip="Refresh" aria-label="Refresh">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* Navigation */}
      <Box>
        <p style={{ color: '#9e9e9e', marginBottom: 8, fontSize: '0.875rem' }}>Navigation:</p>
        <Stack direction="row" spacing={1}>
          <IconButton isQuiet tooltip="Menu" aria-label="Menu">
            <MenuIcon />
          </IconButton>
          <IconButton isQuiet tooltip="Search" aria-label="Search">
            <SearchIcon />
          </IconButton>
          <IconButton isQuiet tooltip="Notifications" aria-label="Notifications">
            <NotificationsIcon />
          </IconButton>
          <IconButton isQuiet tooltip="Settings" aria-label="Settings">
            <SettingsIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* Card actions */}
      <Box sx={{
        p: 2,
        backgroundColor: '#1a2942',
        borderRadius: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: '#fff' }}>Card Title</span>
        <IconButton isQuiet tooltip="More options" aria-label="More options">
          <MoreVertIcon />
        </IconButton>
      </Box>
    </Stack>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Common use cases for IconButton in toolbars, navigation, and cards.',
      },
    },
  },
};

export const WithOnPress: Story = {
  args: {
    onPress: () => alert('onPress called!'),
    tooltip: 'Click me (uses onPress)',
    children: <RefreshIcon />,
  },
  parameters: {
    docs: {
      description: {
        story: 'For backward compatibility with Spectrum, `onPress` is supported as an alternative to `onClick`.',
      },
    },
  },
};
