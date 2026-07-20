/**
 * Breadcrumb Component Stories
 *
 * Demonstrates breadcrumb component patterns and usage
 */

import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Breadcrumb } from './Breadcrumb';

export const meta = {
  title: 'Navigation/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/fleet']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof Breadcrumb>;

type Story = StoryObj<typeof meta>;

/**
 * Simple breadcrumb trail with static items
 */
export const SimpleFleet: Story = {
  args: {
    isVisible: true,
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/fleet']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/**
 * Nested breadcrumb trail
 */
export const NestedIntelOfficers: Story = {
  args: {
    isVisible: true,
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/intel/officers']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/**
 * Dynamic breadcrumbs with resolved names
 */
export const DynamicActivityName: Story = {
  args: {
    isVisible: true,
    data: {
      activityName: 'Operation Nightfall - Mining Run',
    },
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/activities/activity-123']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/**
 * Deep nested breadcrumbs with dynamic organization
 */
export const DynamicOrganizationShips: Story = {
  args: {
    isVisible: true,
    data: {
      orgName: 'Alpha Squadron',
    },
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/organizations/org-456/ships']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/**
 * Mobile view with collapsed breadcrumbs
 */
export const MobileCollapsed: Story = {
  args: {
    isVisible: true,
    maxItems: 3,
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/organizations/org-789/ships']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Hidden breadcrumbs (isVisible=false)
 */
export const Hidden: Story = {
  args: {
    isVisible: false,
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/fleet']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Breadcrumbs are not visible when isVisible=false. Useful for hiding on certain pages.',
      },
    },
  },
};

/**
 * User profile breadcrumb with dynamic username
 */
export const UserProfile: Story = {
  args: {
    isVisible: true,
    data: {
      userName: 'Commander Avery',
    },
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/users/user-123/ships']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/**
 * Bounty hunter profile breadcrumb
 */
export const BountyProfile: Story = {
  args: {
    isVisible: true,
    data: {
      userName: 'Reaper Elite',
    },
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/bounty/profile/user-999']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/**
 * Federation details breadcrumb
 */
export const FederationDetails: Story = {
  args: {
    isVisible: true,
    data: {
      federationName: 'UEE Alliance',
    },
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/directory/federations/fed-001']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

/**
 * Custom className demonstration
 */
export const CustomStyled: Story = {
  args: {
    isVisible: true,
    className: 'custom-breadcrumb-style',
  },
  decorators: [
    Story => (
      <MemoryRouter initialEntries={['/fleet']}>
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Apply custom CSS classes for styling breadcrumbs.',
      },
    },
  },
};
