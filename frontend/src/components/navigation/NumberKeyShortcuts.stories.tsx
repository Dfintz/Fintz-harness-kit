/**
 * Storybook Stories for Number Key Shortcuts (1-4 for hub navigation)
 * Demonstrates the keyboard shortcut feature for quick hub navigation
 */

import type { Meta, StoryObj } from '@storybook/react';
import { hubNumberKeyMap } from './commandConfig';

export const meta = {
  title: 'Navigation/Number Key Shortcuts',
  component: () => <div />, // Dummy component - this is documentation-focused
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
# Number Key Shortcuts (1-4)

Quick keyboard shortcuts to jump directly to any hub without using the command palette.

## Usage

Press number keys **1**, **2**, **3**, or **4** while focused anywhere on the page to navigate to the corresponding hub:

- **1** → Dashboard
- **2** → Fleet
- **3** → Ops Center
- **4** → Community

## How It Works

- No modifier keys required (just the plain number key)
- Works when focus is on the page body (not in text input fields)
- Provides fastest navigation method compared to menu or command palette
- Complements the Cmd+K command palette feature

## Accessibility

- Keyboard-only navigation (no mouse required)
- Intuitive number mapping (1st hub = key 1, 2nd hub = key 2, etc.)
- Works on all devices (desktop, tablet, mobile)
- Respects user's keyboard preferences

## Performance

- Instant navigation (no search required)
- Lightweight keyboard event listener
- No memory overhead from repeated use
- Optimized for responsive user experience

## Technical Details

The feature is implemented via:
1. Global keyboard listener in Layout component
2. Hub number key mapping in commandConfig
3. React Router navigation when key is pressed
4. Validation to prevent firing in input fields

        `,
      },
    },
  },
} satisfies Meta;

/**
 * Story: Number Key Reference Card
 * Shows all available number key shortcuts
 */
export const NumberKeyReference: StoryObj = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h2>Number Key Shortcuts Reference</h2>
      <p>Quick navigation using number keys (1-4):</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        {(['1', '2', '3', '4'] as const).map(key => {
          const shortcut = hubNumberKeyMap[key];
          return (
            <div
              key={key}
              style={{
                padding: '1.5rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  color: '#0066cc',
                  marginBottom: '0.5rem',
                }}
              >
                {key}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                {shortcut.label.split('(')[0].trim()}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#8a8a8a', marginTop: '0.5rem' }}>
                Path: <code>{shortcut.path}</code>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
                Hub: <code>{shortcut.hubId}</code>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          borderLeft: '4px solid #0066cc',
          borderRadius: '4px',
        }}
      >
        <strong>💡 Tip:</strong> Press any number key (1-4) while focused on the page to instantly
        navigate to that hub. Works best when your cursor is not in a text input field.
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Quick reference card showing all available number key shortcuts and their navigation destinations.',
      },
    },
  },
};

/**
 * Story: Dashboard Shortcut (Key 1)
 */
export const DashboardShortcut: StoryObj = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h3>📊 Dashboard (Key 1)</h3>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>1</div>

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}
      >
        <p>
          <strong>Label:</strong> {hubNumberKeyMap['1'].label}
        </p>
        <p>
          <strong>Path:</strong> <code>{hubNumberKeyMap['1'].path}</code>
        </p>
        <p>
          <strong>Hub ID:</strong> <code>{hubNumberKeyMap['1'].hubId}</code>
        </p>
      </div>

      <div>
        <h4>Use Cases:</h4>
        <ul>
          <li>Quick access to dashboard from any page</li>
          <li>Return to home without using menu</li>
          <li>Start new workflows from dashboard</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
        }}
      >
        <strong>Try it:</strong> Press <kbd>1</kbd> to navigate to Dashboard
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard shortcut for navigating to the Dashboard hub. Press "1" from anywhere to quickly jump to your dashboard.',
      },
    },
  },
};

/**
 * Story: Fleet Shortcut (Key 2)
 */
export const FleetShortcut: StoryObj = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h3>⚙️ Fleet (Key 2)</h3>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>2</div>

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}
      >
        <p>
          <strong>Label:</strong> {hubNumberKeyMap['2'].label}
        </p>
        <p>
          <strong>Path:</strong> <code>{hubNumberKeyMap['2'].path}</code>
        </p>
        <p>
          <strong>Hub ID:</strong> <code>{hubNumberKeyMap['2'].hubId}</code>
        </p>
      </div>

      <div>
        <h4>Use Cases:</h4>
        <ul>
          <li>Quick access to fleet management</li>
          <li>Check ship inventory</li>
          <li>View loadout configurations</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
        }}
      >
        <strong>Try it:</strong> Press <kbd>2</kbd> to navigate to Fleet
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard shortcut for navigating to the Fleet hub. Press "2" from anywhere to quickly jump to fleet management.',
      },
    },
  },
};

/**
 * Story: Ops Center Shortcut (Key 3)
 */
export const OpsCenterShortcut: StoryObj = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h3>📋 Ops Center (Key 3)</h3>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>3</div>

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}
      >
        <p>
          <strong>Label:</strong> {hubNumberKeyMap['3'].label}
        </p>
        <p>
          <strong>Path:</strong> <code>{hubNumberKeyMap['3'].path}</code>
        </p>
        <p>
          <strong>Hub ID:</strong> <code>{hubNumberKeyMap['3'].hubId}</code>
        </p>
      </div>

      <div>
        <h4>Use Cases:</h4>
        <ul>
          <li>Check activities and LFG posts</li>
          <li>View upcoming events on calendar</li>
          <li>Review briefings and intel</li>
          <li>Manage trading opportunities</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
        }}
      >
        <strong>Try it:</strong> Press <kbd>3</kbd> to navigate to Ops Center
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard shortcut for navigating to the Ops Center hub. Press "3" from anywhere to quickly jump to operational activities.',
      },
    },
  },
};

/**
 * Story: Community Shortcut (Key 4)
 */
export const CommunityShortcut: StoryObj = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h3>👥 Community (Key 4)</h3>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>4</div>

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          marginBottom: '1rem',
        }}
      >
        <p>
          <strong>Label:</strong> {hubNumberKeyMap['4'].label}
        </p>
        <p>
          <strong>Path:</strong> <code>{hubNumberKeyMap['4'].path}</code>
        </p>
        <p>
          <strong>Hub ID:</strong> <code>{hubNumberKeyMap['4'].hubId}</code>
        </p>
      </div>

      <div>
        <h4>Use Cases:</h4>
        <ul>
          <li>View organization members</li>
          <li>Manage recruitment</li>
          <li>Review diplomacy with other orgs</li>
          <li>Browse public directories</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
        }}
      >
        <strong>Try it:</strong> Press <kbd>4</kbd> to navigate to Community
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard shortcut for navigating to the Community hub. Press "4" from anywhere to quickly jump to community features.',
      },
    },
  },
};

/**
 * Story: Keyboard Shortcut Guide
 */
export const KeyboardShortcutGuide: StoryObj = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h2>⌨️ Keyboard Shortcut Guide</h2>

      <div style={{ marginTop: '2rem' }}>
        <h3>Number Key Shortcuts (1-4)</h3>
        <p>The fastest way to navigate between hubs:</p>

        <div
          style={{
            marginTop: '1.5rem',
            display: 'grid',
            gap: '1rem',
          }}
        >
          {(['1', '2', '3', '4'] as const).map(key => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
              }}
            >
              <div
                style={{
                  minWidth: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#0066cc',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '1.8rem',
                  fontWeight: 'bold',
                }}
              >
                {key}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                  {hubNumberKeyMap[key as keyof typeof hubNumberKeyMap].label}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#8a8a8a' }}>
                  Navigate to:{' '}
                  <code>{hubNumberKeyMap[key as keyof typeof hubNumberKeyMap].path}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Comparison with Other Navigation Methods</h3>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '1rem',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Method
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Speed
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Ease
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                When to Use
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '0.75rem' }}>
                <strong>Number Keys (1-4)</strong>
              </td>
              <td style={{ padding: '0.75rem' }}>⚡⚡⚡ Fastest</td>
              <td style={{ padding: '0.75rem' }}>✓ Very Easy</td>
              <td style={{ padding: '0.75rem' }}>Daily navigation</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '0.75rem' }}>Command Palette (Cmd+K)</td>
              <td style={{ padding: '0.75rem' }}>⚡⚡ Fast</td>
              <td style={{ padding: '0.75rem' }}>✓ Easy</td>
              <td style={{ padding: '0.75rem' }}>Any page/feature</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '0.75rem' }}>Hub Sidebar</td>
              <td style={{ padding: '0.75rem' }}>⚡ Slower</td>
              <td style={{ padding: '0.75rem' }}>✓ Easy</td>
              <td style={{ padding: '0.75rem' }}>Visual navigation</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: '#e8f5e9',
          borderLeft: '4px solid #4caf50',
          borderRadius: '4px',
        }}
      >
        <strong>💡 Pro Tip:</strong> Combine number keys with Cmd+K for maximum productivity:
        <ul style={{ marginTop: '0.5rem' }}>
          <li>Use number keys (1-4) for quick hub navigation</li>
          <li>Use Cmd+K to search for specific features within a hub</li>
          <li>Mix and match based on your workflow</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Complete guide to keyboard shortcuts, comparing number keys with other navigation methods.',
      },
    },
  },
};

/**
 * Story: Developer Integration Guide
 */
export const DeveloperIntegrationGuide: StoryObj = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h2>👨‍💻 Developer Integration Guide</h2>

      <div>
        <h3>How It's Implemented</h3>
        <p>The number key shortcut system is implemented via:</p>

        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            overflow: 'auto',
          }}
        >
          <pre>{`// commandConfig.ts
export const hubNumberKeyMap = {
  '1': { hubId: 'dashboard', path: '/dashboard', label: 'Dashboard (1)' },
  '2': { hubId: 'fleet', path: '/fleet', label: 'Fleet (2)' },
  '3': { hubId: 'ops', path: '/activities', label: 'Ops Center (3)' },
  '4': { hubId: 'community', path: '/users', label: 'Community (4)' },
};

export function getHubShortcut(numberKey: string) {
  const key = numberKey as keyof typeof hubNumberKeyMap;
  return hubNumberKeyMap[key] || null;
}

// Layout.tsx
const handleKeyDown = (event: KeyboardEvent) => {
  // Number key shortcuts (1-4) for hub navigation
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
    const target = event.target as HTMLElement;
    const isInputField = ['INPUT', 'TEXTAREA'].includes(target.tagName);
    
    if (!isInputField && ['1','2','3','4'].includes(event.key)) {
      const shortcut = getHubShortcut(event.key);
      if (shortcut) navigate(shortcut.path);
    }
  }
};`}</pre>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Files Involved</h3>
        <ul style={{ marginLeft: '1.5rem' }}>
          <li>
            <code>frontend/src/components/navigation/commandConfig.ts</code> - Hub mapping
            configuration
          </li>
          <li>
            <code>frontend/src/components/Layout.tsx</code> - Keyboard event listener
          </li>
          <li>
            <code>frontend/src/components/navigation/__tests__/numberKeyShortcuts.test.ts</code> -
            Unit tests (30 tests)
          </li>
          <li>
            <code>tests/navigation/numberKeyShortcuts.spec.ts</code> - E2E Playwright tests
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Adding New Shortcuts</h3>
        <p>To add a number key shortcut for a new hub:</p>
        <ol style={{ marginLeft: '1.5rem' }}>
          <li>
            Add entry to <code>hubNumberKeyMap</code> in commandConfig.ts
          </li>
          <li>Update the keyboard handler in Layout.tsx if needed</li>
          <li>Add tests to numberKeyShortcuts.test.ts</li>
          <li>Document in Storybook</li>
        </ol>
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: '#fff3cd',
          borderLeft: '4px solid #ffc107',
          borderRadius: '4px',
        }}
      >
        <strong>Note:</strong> Currently limited to keys 1-4 (matching the 4 hubs). To add more
        shortcuts, either:
        <ul style={{ marginTop: '0.5rem' }}>
          <li>Use modifier keys (e.g., Ctrl+Alt+5 for a new feature)</li>
          <li>Expand hub count and remap keys</li>
          <li>Use letter keys with modifiers (e.g., Ctrl+D for dashboard)</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Technical documentation for developers on how the number key shortcut system is implemented and how to extend it.',
      },
    },
  },
};
