/**
 * Command Palette Stories
 *
 * Storybook documentation for the command palette component
 */

import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';

export const meta: Meta<typeof CommandPalette> = {
  title: 'Navigation/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  decorators: [
    Story => (
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <Story />
        </BrowserRouter>
      </ThemeProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: `
A keyboard-driven command palette for quick navigation and feature discovery.
Triggered by Cmd/Ctrl+K, it provides fuzzy search across all application routes
and features with categories and descriptions.

Features:
- **Fuzzy Search**: Smart substring matching with scoring
- **Keyboard Navigation**: Arrow keys to navigate, Enter to select, Escape to close
- **Categories**: Commands grouped by Dashboard, Fleet, Ops, Community, Tools, Help
- **Mobile Friendly**: Responsive design with optimized touch targets
- **Accessibility**: ARIA labels, keyboard-only navigation support
        `,
      },
    },
  },
};

type Story = StoryObj<typeof CommandPalette>;

/**
 * Default state with all commands visible
 */
export const Open: Story = {
  name: 'Open with All Commands',
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'The command palette opened with all available commands visible.',
      },
    },
  },
};

/**
 * Closed state (nothing visible)
 */
export const Closed: Story = {
  name: 'Closed',
  args: {
    isOpen: false,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'The command palette is closed and not visible to the user.',
      },
    },
  },
};

/**
 * With search results for "Fleet"
 */
export const SearchingFleet: Story = {
  name: 'Search Results: "Fleet"',
  render: args => {
    const [isOpen, setIsOpen] = React.useState(args.isOpen);
    const [query, setQuery] = React.useState('fleet');

    return (
      <>
        <div
          style={{
            padding: '20px',
            marginBottom: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            color: '#e0e0e0',
          }}
        >
          <p>
            <strong>Current search query:</strong> "{query}"
          </p>
          <p>
            <strong>Tip:</strong> Try typing different queries to see how the fuzzy search works.
          </p>
        </div>
        <CommandPalette {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  },
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Search results filtered for "Fleet" command. Demonstrates category filtering and result ranking.',
      },
    },
  },
};

/**
 * With search results for "activity"
 */
export const SearchingActivity: Story = {
  name: 'Search Results: "Activity"',
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Search results filtered for "Activity". Shows how different keywords and descriptions are matched.',
      },
    },
  },
};

/**
 * Search with no results
 */
export const NoResults: Story = {
  name: 'No Search Results',
  render: args => {
    const [isOpen, setIsOpen] = React.useState(args.isOpen);

    return (
      <>
        <div
          style={{
            padding: '20px',
            marginBottom: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            color: '#e0e0e0',
          }}
        >
          <p>
            <strong>Note:</strong> The search query "xyznonexistent" will produce no results.
          </p>
        </div>
        <CommandPalette {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  },
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the empty state when no commands match the search query.',
      },
    },
  },
};

/**
 * Help text and keyboard navigation guide
 */
export const HelpGuide: Story = {
  name: 'Help & Guide',
  render: args => (
    <>
      <div
        style={{
          padding: '20px',
          marginBottom: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          color: '#e0e0e0',
          borderLeft: '4px solid #4a90e2',
        }}
      >
        <h3 style={{ marginTop: 0 }}>🎯 Command Palette Guide</h3>
        <h4>Keyboard Shortcuts</h4>
        <ul>
          <li>
            <strong>Cmd/Ctrl + K</strong> - Open command palette (anywhere in the app)
          </li>
          <li>
            <strong>↑ ↓ Arrow Keys</strong> - Navigate through commands
          </li>
          <li>
            <strong>Enter</strong> - Execute selected command
          </li>
          <li>
            <strong>Escape</strong> - Close palette
          </li>
        </ul>

        <h4>Search Tips</h4>
        <ul>
          <li>
            <strong>Fuzzy Search:</strong> Type "flm" to find "Fleet Management"
          </li>
          <li>
            <strong>Keyword Search:</strong> Type "team" to find "Members"
          </li>
          <li>
            <strong>Description Search:</strong> Type "manage" to find commands with "manage" in
            description
          </li>
        </ul>

        <h4>Categories</h4>
        <ul>
          <li>
            🏠 <strong>Dashboard</strong> - Personal overBox and quick actions
          </li>
          <li>
            🚀 <strong>Fleet</strong> - Fleet management and ship operations
          </li>
          <li>
            ⚙️ <strong>Ops</strong> - Operations, logistics, and planning
          </li>
          <li>
            👥 <strong>Community</strong> - Social features and diplomacy
          </li>
          <li>
            🛠️ <strong>Tools</strong> - Settings and utilities
          </li>
          <li>
            ❓ <strong>Help</strong> - Documentation and about
          </li>
        </ul>
      </div>
      <CommandPalette {...args} />
    </>
  ),
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete guide showing keyboard shortcuts, search tips, and command categories.',
      },
    },
  },
};

/**
 * Mobile Box
 */
export const MobileBox: Story = {
  name: 'Mobile Responsive',
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    Boxport: {
      defaultBoxport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Command palette optimized for mobile devices with touch-friendly UI.',
      },
    },
  },
};

/**
 * Dashboard category preBox
 */
export const DashboardCategory: Story = {
  name: 'Dashboard Commands',
  render: args => (
    <>
      <div
        style={{
          padding: '16px',
          marginBottom: '16px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          color: '#e0e0e0',
          fontSize: '14px',
        }}
      >
        Search query: <strong>"dashboard"</strong> - Shows dashboard-related commands
      </div>
      <CommandPalette {...args} />
    </>
  ),
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Filtered Box showing only Dashboard category commands.',
      },
    },
  },
};

/**
 * Ops Center category preBox
 */
export const OpsCenterCategory: Story = {
  name: 'Ops Center Commands',
  render: args => (
    <>
      <div
        style={{
          padding: '16px',
          marginBottom: '16px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          color: '#e0e0e0',
          fontSize: '14px',
        }}
      >
        Search query: <strong>"trading"</strong> - Shows Ops Center commands
      </div>
      <CommandPalette {...args} />
    </>
  ),
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Filtered Box showing Ops Center and trading-related commands.',
      },
    },
  },
};

/**
 * Custom styling example
 */
export const Customized: Story = {
  name: 'Custom Theme',
  render: args => (
    <>
      <div
        style={{
          padding: '16px',
          marginBottom: '16px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          color: '#e0e0e0',
          fontSize: '14px',
        }}
      >
        You can customize the command palette appearance using CSS variables in{' '}
        <code>CommandPalette.css</code>
      </div>
      <CommandPalette {...args} />
    </>
  ),
  args: {
    isOpen: true,
    onClose: () => console.log('Palette closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'The command palette supports theming through CSS custom properties.',
      },
    },
  },
};
