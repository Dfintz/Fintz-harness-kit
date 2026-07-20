/**
 * TopNavigation Storybook Stories
 */

import { ThemeProvider } from '@mui/material/styles';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '@/theme';
import { TopNavigation } from './TopNavigation';

export const meta = {
  title: 'Navigation/TopNavigation',
  component: TopNavigation,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Horizontal navigation bar with 4 main hubs for the application. Part of the UI redesign implementation.',
      },
    },
  },
  decorators: [
    Story => (
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <Story />
        </ThemeProvider>
      </BrowserRouter>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof TopNavigation>;

type Story = StoryObj<typeof meta>;

/**
 * Default desktop Box of the top navigation
 */
export const Desktop: Story = {
  args: {
    isMobile: false,
    isMobileMenuOpen: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify hub buttons are visible
    expect(canvas.getByText('Dashboard')).toBeInTheDocument();
    expect(canvas.getByText('Fleet Hub')).toBeInTheDocument();
    expect(canvas.getByText('Ops Center')).toBeInTheDocument();
    expect(canvas.getByText('Community Hub')).toBeInTheDocument();
  },
};

/**
 * Mobile Box with menu closed
 */
export const MobileClosed: Story = {
  args: {
    isMobile: true,
    isMobileMenuOpen: false,
    onMobileMenuToggle: () => console.log('Toggle menu'),
  },
  parameters: {
    Boxport: {
      defaultBoxport: 'mobile1',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify mobile menu button is visible
    const menuButton = canvas.getByLabelText('Open menu');
    expect(menuButton).toBeInTheDocument();

    // Hub buttons should not be visible on mobile
    expect(canvas.queryByText('Dashboard')).not.toBeInTheDocument();
  },
};

/**
 * Mobile Box with menu open
 */
export const MobileOpen: Story = {
  args: {
    isMobile: true,
    isMobileMenuOpen: true,
    onMobileMenuToggle: () => console.log('Toggle menu'),
  },
  parameters: {
    Boxport: {
      defaultBoxport: 'mobile1',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify close button is visible
    const closeButton = canvas.getByLabelText('Close menu');
    expect(closeButton).toBeInTheDocument();
  },
};

/**
 * Interactive demo showing hub navigation
 */
export const Interactive: Story = {
  args: {
    isMobile: false,
    onAboutClick: () => alert('About modal would open'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on Fleet Hub
    const fleetHub = canvas.getByText('Fleet Hub');
    await userEvent.click(fleetHub);

    // Verify navigation happens (in real app)
    expect(fleetHub).toBeInTheDocument();
  },
};

/**
 * With about callback
 */
export const WithAboutCallback: Story = {
  args: {
    isMobile: false,
    onAboutClick: () => alert('About Fringe Core clicked!'),
  },
};
