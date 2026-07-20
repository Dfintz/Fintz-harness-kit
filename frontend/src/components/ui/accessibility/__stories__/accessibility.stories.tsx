import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { FocusTrap } from '@/components/ui/accessibility/FocusTrap';
import { LiveRegion, useLiveRegion } from '@/components/ui/accessibility/LiveRegion';
import { SkipLink } from '@/components/ui/accessibility/SkipLink';
import { VisuallyHidden } from '@/components/ui/accessibility/VisuallyHidden';
import { a11yColors } from '@/components/ui/accessibility/a11y-colors';
import '../a11y.css';
import {
    useFocusVisible,
    useHighContrast,
    useReducedMotion
} from '@/components/ui/accessibility/useA11y';

// ============================================================================
// SkipLink Stories
// ============================================================================

export const skipLinkMeta: Meta<typeof SkipLink> = {
  title: 'Accessibility/SkipLink',
  component: SkipLink,
  parameters: {
    docs: {
      description: {
        component: `
## Skip to Main Content Link

A skip link allows keyboard users to bypass repetitive navigation and jump directly 
to the main content. This is a WCAG 2.1 AA requirement (Success Criterion 2.4.1).

### Usage

Place the SkipLink component at the very top of your layout, before any navigation:

\`\`\`tsx
<SkipLink targetId="main-content" />
<Header />
<nav>...</nav>
<main id="main-content" tabIndex={-1}>
  {children}
</main>
\`\`\`

### Accessibility

- The link is hidden until focused via keyboard (Tab key)
- Clicking the link focuses the target element
- Works with screen readers
        `,
      },
    },
  },
};

type SkipLinkStory = StoryObj<typeof SkipLink>;

export const Default: SkipLinkStory = {
  render: () => (
    <div style={{ minHeight: '200px' }}>
      <SkipLink targetId="main-content" />
      <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
        Press <kbd style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '2px 8px', 
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>Tab</kbd> to reveal the skip link
      </p>
      <nav style={{ 
        background: 'rgba(255,255,255,0.05)', 
        padding: '16px',
        marginBottom: '16px' 
      }}>
        <a href="#" style={{ color: '#00d9ff', marginRight: '16px' }}>Home</a>
        <a href="#" style={{ color: '#00d9ff', marginRight: '16px' }}>Fleet</a>
        <a href="#" style={{ color: '#00d9ff', marginRight: '16px' }}>Members</a>
        <a href="#" style={{ color: '#00d9ff' }}>Settings</a>
      </nav>
      <main id="main-content" tabIndex={-1} style={{ 
        background: 'rgba(0, 217, 255, 0.1)', 
        padding: '24px',
        borderRadius: '8px'
      }}>
        <h1 style={{ color: '#fff', marginBottom: '8px' }}>Main Content</h1>
        <p style={{ color: '#94a3b8' }}>
          The skip link will focus this area when activated.
        </p>
      </main>
    </div>
  ),
};

export const CustomText: SkipLinkStory = {
  render: () => (
    <div>
      <SkipLink targetId="content">Skip to fleet overview</SkipLink>
      <div id="content" tabIndex={-1} style={{ 
        marginTop: '60px',
        padding: '16px', 
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px'
      }}>
        <p style={{ color: '#fff' }}>Fleet overview content</p>
      </div>
    </div>
  ),
};

// ============================================================================
// VisuallyHidden Stories
// ============================================================================

const visuallyHiddenMeta: Meta<typeof VisuallyHidden> = {
  title: 'Accessibility/VisuallyHidden',
  component: VisuallyHidden,
  parameters: {
    docs: {
      description: {
        component: `
## Visually Hidden Content

Renders content that is visually hidden but accessible to screen readers.
Use this for providing additional context to assistive technology users.

### Common Use Cases

- Adding context to icon-only buttons
- Providing labels for form inputs with visual labels nearby
- Adding table cell context
- Describing decorative images to screen readers
        `,
      },
    },
  },
};

export const VisuallyHiddenDefault: StoryObj<typeof VisuallyHidden> = {
  render: () => (
    <div>
      <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
        The text "Delete item" below is visually hidden but readable by screen readers:
      </p>
      <button style={{
        background: 'rgba(239, 68, 68, 0.2)',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        padding: '8px 16px',
        color: '#ef4444',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span aria-hidden="true">🗑️</span>
        <VisuallyHidden>Delete item</VisuallyHidden>
      </button>
    </div>
  ),
};

export const IconButton: StoryObj<typeof VisuallyHidden> = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button 
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '12px',
          color: '#fff',
          cursor: 'pointer'
        }}
        aria-label="Settings"
      >
        <span aria-hidden="true">⚙️</span>
        <VisuallyHidden>Settings</VisuallyHidden>
      </button>
      <button 
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '12px',
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        <span aria-hidden="true">🔔</span>
        <VisuallyHidden>Notifications</VisuallyHidden>
      </button>
      <button 
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '12px',
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        <span aria-hidden="true">👤</span>
        <VisuallyHidden>User profile</VisuallyHidden>
      </button>
    </div>
  ),
};

// ============================================================================
// LiveRegion Stories
// ============================================================================

const liveRegionMeta: Meta<typeof LiveRegion> = {
  title: 'Accessibility/LiveRegion',
  component: LiveRegion,
  parameters: {
    docs: {
      description: {
        component: `
## ARIA Live Region

Creates an ARIA live region that announces dynamic content changes to screen reader users.

### Politeness Levels

- **polite**: Waits for user to finish current task before announcing
- **assertive**: Interrupts immediately (use sparingly for critical alerts)
- **off**: No announcements

### Use Cases

- Form validation messages
- Loading state changes
- Success/error notifications
- Real-time updates
        `,
      },
    },
  },
};

const LiveRegionDemo: React.FC = () => {
  const [message, setMessage] = useState('');
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ color: '#fff', marginRight: '16px' }}>
          Politeness:
          <select 
            value={politeness}
            onChange={(e) => setPoliteness(e.target.value as 'polite' | 'assertive')}
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              color: '#fff'
            }}
          >
            <option value="polite">Polite</option>
            <option value="assertive">Assertive</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={() => setMessage('Ship added to fleet!')}
          style={{
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#22c55e',
            cursor: 'pointer'
          }}
        >
          Success Message
        </button>
        <button 
          onClick={() => setMessage('Error: Invalid ship configuration')}
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#ef4444',
            cursor: 'pointer'
          }}
        >
          Error Message
        </button>
        <button 
          onClick={() => setMessage('')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>
      <LiveRegion politeness={politeness}>{message}</LiveRegion>
      <div style={{
        padding: '16px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        color: '#94a3b8'
      }}>
        <p>Current message (announced to screen readers): </p>
        <p style={{ color: '#00d9ff', fontStyle: 'italic' }}>
          {message || '(empty)'}
        </p>
      </div>
    </div>
  );
};

export const LiveRegionInteractive: StoryObj<typeof LiveRegion> = {
  render: () => <LiveRegionDemo />,
};

// Hook-based demo
const UseLiveRegionDemo: React.FC = () => {
  const { announce, clear, LiveRegionComponent } = useLiveRegion({
    politeness: 'polite',
    clearDelay: 3000,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={() => announce('Fleet synchronized successfully!')}
          style={{
            background: 'rgba(0, 217, 255, 0.2)',
            border: '1px solid #00d9ff',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#00d9ff',
            cursor: 'pointer'
          }}
        >
          Announce Sync
        </button>
        <button 
          onClick={() => announce('3 new members joined')}
          style={{
            background: 'rgba(168, 85, 247, 0.2)',
            border: '1px solid #a855f7',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#a855f7',
            cursor: 'pointer'
          }}
        >
          Announce Members
        </button>
        <button 
          onClick={clear}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>
      {LiveRegionComponent}
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>
        Messages auto-clear after 3 seconds
      </p>
    </div>
  );
};

export const UseLiveRegionHook: StoryObj<typeof LiveRegion> = {
  render: () => <UseLiveRegionDemo />,
};

// ============================================================================
// FocusTrap Stories
// ============================================================================

const focusTrapMeta: Meta<typeof FocusTrap> = {
  title: 'Accessibility/FocusTrap',
  component: FocusTrap,
  parameters: {
    docs: {
      description: {
        component: `
## Focus Trap

Traps keyboard focus within a container, essential for modals and dialogs.

### Features

- Tab cycles through focusable elements
- Shift+Tab goes backwards
- Focus wraps from last to first and vice versa
- Escape key callback
- Auto-focus first element
- Restore focus on unmount
        `,
      },
    },
  },
};

const FocusTrapDemo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          background: 'rgba(0, 217, 255, 0.2)',
          border: '1px solid #00d9ff',
          borderRadius: '8px',
          padding: '12px 24px',
          color: '#00d9ff',
          cursor: 'pointer'
        }}
      >
        Open Modal with Focus Trap
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <FocusTrap 
            active={isOpen} 
            onEscapeKey={() => setIsOpen(false)}
          >
            <div style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '400px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }}>
              <h2 style={{ color: '#fff', marginBottom: '16px' }}>Modal Title</h2>
              <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
                Press Tab to cycle through focusable elements.
                Press Escape to close.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                  Name:
                </label>
                <input 
                  type="text"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(0, 217, 255, 0.2)',
                    border: '1px solid #00d9ff',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: '#00d9ff',
                    cursor: 'pointer'
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  );
};

export const FocusTrapModal: StoryObj<typeof FocusTrap> = {
  render: () => <FocusTrapDemo />,
};

// ============================================================================
// Color Palette Stories
// ============================================================================

const colorPaletteMeta: Meta = {
  title: 'Accessibility/ColorPalette',
  parameters: {
    docs: {
      description: {
        component: `
## WCAG AA Compliant Color Palette

All colors in this palette meet WCAG 2.1 AA contrast requirements:
- **Normal text**: 4.5:1 minimum contrast ratio
- **Large text/UI components**: 3:1 minimum contrast ratio

Use \`getContrastColor\` to automatically choose black or white text
based on background luminance.
        `,
      },
    },
  },
};

const ColorSwatch: React.FC<{ 
  name: string; 
  color: { value: string; contrastRatio: number; onBackground: string };
}> = ({ name, color }) => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '16px',
    marginBottom: '8px'
  }}>
    <div style={{
      width: '60px',
      height: '40px',
      background: color.value,
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.2)'
    }} />
    <div>
      <div style={{ color: '#fff', fontWeight: 600 }}>{name}</div>
      <div style={{ color: '#94a3b8', fontSize: '12px' }}>
        {color.value} • {color.contrastRatio}:1 on {color.onBackground}
      </div>
    </div>
    <div style={{
      marginLeft: 'auto',
      padding: '4px 8px',
      background: color.contrastRatio >= 4.5 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
      borderRadius: '4px',
      fontSize: '12px',
      color: color.contrastRatio >= 4.5 ? '#22c55e' : '#eab308'
    }}>
      {color.contrastRatio >= 4.5 ? 'AA (Normal)' : 'AA (Large)'}
    </div>
  </div>
);

export const ColorPaletteOverview: StoryObj = {
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <h3 style={{ color: '#fff', marginBottom: '16px' }}>Text Colors</h3>
      <ColorSwatch name="Primary Text" color={a11yColors.primaryText} />
      <ColorSwatch name="Secondary Text" color={a11yColors.secondaryText} />

      <h3 style={{ color: '#fff', margin: '24px 0 16px' }}>Accent Colors</h3>
      <ColorSwatch name="Cyan" color={a11yColors.accentCyan} />
      <ColorSwatch name="Purple" color={a11yColors.accentPurple} />

      <h3 style={{ color: '#fff', margin: '24px 0 16px' }}>Focus Colors</h3>
      <ColorSwatch name="Focus Outline" color={a11yColors.focusOutline} />
      <ColorSwatch name="Focus Ring" color={a11yColors.focusRing} />

      <h3 style={{ color: '#fff', margin: '24px 0 16px' }}>Status Colors</h3>
      <ColorSwatch name="Success" color={a11yColors.success} />
      <ColorSwatch name="Warning" color={a11yColors.warning} />
      <ColorSwatch name="Error" color={a11yColors.error} />
    </div>
  ),
};

// ============================================================================
// Hooks Demo Stories
// ============================================================================

const hooksMeta: Meta = {
  title: 'Accessibility/Hooks',
  parameters: {
    docs: {
      description: {
        component: `
## Accessibility Hooks

React hooks for common accessibility patterns:

- **useAnnounce**: Screen reader announcements
- **useFocusVisible**: Track focus-visible state  
- **useReducedMotion**: Detect motion preferences
- **useHighContrast**: Detect high contrast mode
        `,
      },
    },
  },
};

const PreferencesDemo: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const highContrast = useHighContrast();

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '16px',
      maxWidth: '400px'
    }}>
      <div style={{
        padding: '16px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#fff' }}>Reduced Motion</span>
          <span style={{ 
            padding: '4px 12px',
            background: reducedMotion ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            color: reducedMotion ? '#22c55e' : '#94a3b8',
            fontSize: '14px'
          }}>
            {reducedMotion ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
          Detects prefers-reduced-motion media query
        </p>
      </div>

      <div style={{
        padding: '16px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#fff' }}>High Contrast</span>
          <span style={{ 
            padding: '4px 12px',
            background: highContrast ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            color: highContrast ? '#22c55e' : '#94a3b8',
            fontSize: '14px'
          }}>
            {highContrast ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
          Detects prefers-contrast: more media query
        </p>
      </div>
    </div>
  );
};

export const UserPreferences: StoryObj = {
  render: () => <PreferencesDemo />,
};

const FocusVisibleDemo: React.FC = () => {
  const { isFocusVisible, focusProps } = useFocusVisible();

  return (
    <div>
      <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
        Click the button (no focus ring) vs Tab to it (focus ring appears)
      </p>
      <button
        {...focusProps}
        style={{
          padding: '12px 24px',
          background: 'rgba(0, 217, 255, 0.2)',
          border: '1px solid #00d9ff',
          borderRadius: '8px',
          color: '#00d9ff',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isFocusVisible ? '0 0 0 3px rgba(0, 217, 255, 0.4)' : 'none',
          transition: 'box-shadow 0.15s ease'
        }}
      >
        Focus Visible Button
      </button>
      <p style={{ color: '#94a3b8', marginTop: '8px', fontSize: '14px' }}>
        Focus visible: {isFocusVisible ? 'Yes' : 'No'}
      </p>
    </div>
  );
};

export const FocusVisibleHook: StoryObj = {
  render: () => <FocusVisibleDemo />,
};
