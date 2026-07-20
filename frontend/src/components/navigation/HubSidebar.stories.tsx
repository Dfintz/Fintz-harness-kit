/**
 * HubSidebar Storybook Stories
 */

import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { BrowserRouter } from 'react-router-dom';
import { HubSidebar } from './HubSidebar';

export const meta = {
  title: 'Navigation/HubSidebar',
  component: HubSidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Contextual sidebar navigation that displays relevant items based on the active hub. Supports sections, feature flags, and organization-based item visibility.',
      },
    },
  },
  decorators: [
    Story => (
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <div
            style={{
              display: 'flex',
              minHeight: '600px',
              background: 'linear-gradient(180deg, #0a1628 0%, #0c1a2e 50%, #0f1d35 100%)',
            }}
          >
            <Story />
          </div>
        </ThemeProvider>
      </BrowserRouter>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof HubSidebar>;

type Story = StoryObj<typeof meta>;

/**
 * Sidebar with organization context (all items enabled)
 */
export const WithOrganization: Story = {
  args: {
    isVisible: true,
    isMobile: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify org display
    expect(canvas.getByText('PRIMARY ORG')).toBeInTheDocument();
    expect(canvas.getByText('FRNG')).toBeInTheDocument();
  },
};

/**
 * Sidebar without organization (some items disabled)
 */
export const WithoutOrganization: Story = {
  args: {
    isVisible: true,
    isMobile: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify "No Org" display
    expect(canvas.getByText('No Org')).toBeInTheDocument();
  },
};

/**
 * Mobile sidebar Box
 */
export const Mobile: Story = {
  args: {
    isVisible: true,
    isMobile: true,
  },
  parameters: {
    Boxport: {
      defaultBoxport: 'mobile1',
    },
  },
};

/**
 * Hidden sidebar (not visible)
 */
export const Hidden: Story = {
  args: {
    isVisible: false,
    isMobile: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Sidebar should not render
    expect(canvas.queryByText('PRIMARY ORG')).not.toBeInTheDocument();
  },
};

/**
 * Dashboard hub Box (simple items, no sections)
 */
export const DashboardHub: Story = {
  args: {
    isVisible: true,
    isMobile: false,
  },
  parameters: {
    reactRouter: {
      location: {
        path: '/',
      },
    },
  },
};

/**
 * Ops Center hub Box (with sections)
 */
export const OpsCenterHub: Story = {
  args: {
    isVisible: true,
    isMobile: false,
  },
  parameters: {
    reactRouter: {
      location: {
        path: '/activities',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify sections are visible (when on activities path, sidebar shows ops center items)
    // Note: The actual rendering depends on the hub configuration matching the current path
  },
};

/**
 * Fleet Hub Box (requires organization)
 */
export const FleetHub: Story = {
  args: {
    isVisible: true,
    isMobile: false,
  },
  parameters: {
    reactRouter: {
      location: {
        path: '/fleet',
      },
    },
  },
};

/**
 * Community Hub Box
 */
export const CommunityHub: Story = {
  args: {
    isVisible: true,
    isMobile: false,
  },
  parameters: {
    reactRouter: {
      location: {
        path: '/users',
      },
    },
  },
};
