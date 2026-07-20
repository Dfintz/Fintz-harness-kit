/**
 * Well Stories - Storybook documentation for Well component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Box, Typography } from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { Well } from './Well';

export const meta: Meta<typeof Well> = {
  title: 'UI/Well',
  component: Well,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Well is a simple container component for visually grouping content with consistent styling.

## Features
- Default padding and border radius
- Extends MUI Box props for full customization
- Great for callouts, info boxes, and grouped content

## Usage
\`\`\`tsx

<Well sx={{ p: 2, borderRadius: 1 }}>
  Content here
</Well>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Box sx={{ width: 400 }}>
        <Story />
      </Box>
    ),
  ],
};

type Story = StoryObj<typeof Well>;

export const Default: Story = {
  args: {
    children: 'This is a Well component with default styling.',
  },
};

export const WithCustomPadding: Story = {
  args: {
    sx: { p: 3 },
    children: 'Well with custom padding (24px).',
  },
};

export const InfoCallout: Story = {
  render: () => (
    <Well
      sx={{
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        borderLeft: '4px solid #00d9ff',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <InfoIcon sx={{ color: '#00d9ff', mt: 0.5 }} />
        <Box>
          <Typography sx={{ fontWeight: 'bold', color: '#fff', mb: 0.5 }}>
            Information
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            This is an informational callout using the Well component.
          </Typography>
        </Box>
      </Stack>
    </Well>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Well styled as an info callout with border accent.',
      },
    },
  },
};

export const WarningCallout: Story = {
  render: () => (
    <Well
      sx={{
        backgroundColor: 'rgba(255, 170, 0, 0.1)',
        borderLeft: '4px solid #ffaa00',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <WarningIcon sx={{ color: '#ffaa00', mt: 0.5 }} />
        <Box>
          <Typography sx={{ fontWeight: 'bold', color: '#fff', mb: 0.5 }}>
            Warning
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            This action cannot be undone. Please proceed with caution.
          </Typography>
        </Box>
      </Stack>
    </Well>
  ),
};

export const ErrorCallout: Story = {
  render: () => (
    <Well
      sx={{
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderLeft: '4px solid #ff4444',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <ErrorIcon sx={{ color: '#ff4444', mt: 0.5 }} />
        <Box>
          <Typography sx={{ fontWeight: 'bold', color: '#fff', mb: 0.5 }}>
            Error
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Failed to load data. Please try again later.
          </Typography>
        </Box>
      </Stack>
    </Well>
  ),
};

export const SuccessCallout: Story = {
  render: () => (
    <Well
      sx={{
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderLeft: '4px solid #00ff88',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <SuccessIcon sx={{ color: '#00ff88', mt: 0.5 }} />
        <Box>
          <Typography sx={{ fontWeight: 'bold', color: '#fff', mb: 0.5 }}>
            Success
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Your changes have been saved successfully.
          </Typography>
        </Box>
      </Stack>
    </Well>
  ),
};

export const ContentGroup: Story = {
  render: () => (
    <Well sx={{ backgroundColor: '#1a2942' }}>
      <Typography sx={{ fontWeight: 'bold', color: '#fff', mb: 1 }}>
        Ship Statistics
      </Typography>
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ color: '#94a3b8' }}>Total Ships</Typography>
          <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>42</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ color: '#94a3b8' }}>Combat Ready</Typography>
          <Typography sx={{ color: '#00ff88', fontWeight: 'bold' }}>28</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ color: '#94a3b8' }}>Under Repair</Typography>
          <Typography sx={{ color: '#ffaa00', fontWeight: 'bold' }}>14</Typography>
        </Box>
      </Stack>
    </Well>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Well used to group related statistics or content.',
      },
    },
  },
};

export const NestedWells: Story = {
  render: () => (
    <Well sx={{ backgroundColor: '#0f1d35' }}>
      <Typography sx={{ fontWeight: 'bold', color: '#fff', mb: 2 }}>
        Fleet Overview
      </Typography>
      <Stack spacing={2}>
        <Well sx={{ backgroundColor: '#1a2942' }}>
          <Typography sx={{ color: '#00d9ff', fontWeight: 'bold', mb: 1 }}>
            Combat Division
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            12 ships • 5 pilots active
          </Typography>
        </Well>
        <Well sx={{ backgroundColor: '#1a2942' }}>
          <Typography sx={{ color: '#00d9ff', fontWeight: 'bold', mb: 1 }}>
            Mining Division
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            8 ships • 3 pilots active
          </Typography>
        </Well>
        <Well sx={{ backgroundColor: '#1a2942' }}>
          <Typography sx={{ color: '#00d9ff', fontWeight: 'bold', mb: 1 }}>
            Trade Division
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            6 ships • 2 pilots active
          </Typography>
        </Well>
      </Stack>
    </Well>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Wells can be nested to create hierarchical content groupings.',
      },
    },
  },
};

export const WithBorder: Story = {
  render: () => (
    <Well
      sx={{
        border: '1px solid #364a62',
        backgroundColor: 'transparent',
      }}
    >
      <Typography sx={{ color: '#fff' }}>
        Well with visible border and transparent background.
      </Typography>
    </Well>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <Well
      sx={{
        backgroundColor: '#0a0f1e',
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        color: '#00d9ff',
        whiteSpace: 'pre',
        overflow: 'auto',
      }}
    >
{`const ship = {
  name: 'Aurora MR',
  manufacturer: 'RSI',
  role: 'Starter',
  crew: 1,
};`}
    </Well>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Well styled as a code block.',
      },
    },
  },
};
