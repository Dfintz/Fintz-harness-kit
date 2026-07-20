import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { GlassPanel } from './GlassPanel';

export const meta: Meta<typeof GlassPanel> = {
  title: 'UI/Glass/GlassPanel',
  component: GlassPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0a1628' }],
    },
  },
  argTypes: {
    position: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
      description: 'Panel position',
    },
    variant: {
      control: 'select',
      options: ['clear', 'frosted', 'tinted'],
      description: 'Glass variant style',
    },
    width: {
      control: 'number',
      description: 'Width for left/right panels',
    },
    height: {
      control: 'number',
      description: 'Height for top/bottom panels',
    },
    collapsible: {
      control: 'boolean',
      description: 'Whether the panel is collapsible',
    },
    bordered: {
      control: 'boolean',
      description: 'Whether to show a border',
    },
  },
};

type Story = StoryObj<typeof GlassPanel>;

/**
 * Layout container for demos
 */
const LayoutContainer = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      display: 'flex',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2744 100%)',
      minHeight: '500px',
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Default left-positioned panel
 */
export const Default: Story = {
  render: () => (
    <LayoutContainer>
      <GlassPanel title="Navigation" width={280}>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Dashboard', 'Fleet', 'Members', 'Events', 'Settings'].map((item) => (
              <li key={item}>
                <a
                  href="#"
                  style={{
                    display: 'block',
                    padding: '12px',
                    color: '#e0e6ed',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor = 'rgba(0, 217, 255, 0.1)')
                  }
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </GlassPanel>
      <div style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ color: '#00d9ff', margin: '0 0 16px 0' }}>Main Content</h1>
        <p style={{ color: '#e0e6ed' }}>Page content goes here.</p>
      </div>
    </LayoutContainer>
  ),
};

/**
 * Right-positioned panel
 */
export const RightPanel: Story = {
  render: () => (
    <LayoutContainer>
      <div style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ color: '#00d9ff', margin: '0 0 16px 0' }}>Fleet Overview</h1>
        <p style={{ color: '#e0e6ed' }}>Select a ship to view details.</p>
      </div>
      <GlassPanel position="right" title="Ship Details" width={320}>
        <div>
          <h4 style={{ margin: '0 0 8px 0', color: '#00d9ff' }}>Carrack</h4>
          <p style={{ margin: '4px 0', color: '#8a9eb5' }}>Anvil Aerospace</p>
          <div style={{ marginTop: '16px' }}>
            <p style={{ margin: '4px 0' }}>Status: Active</p>
            <p style={{ margin: '4px 0' }}>Crew: 6/8</p>
            <p style={{ margin: '4px 0' }}>Cargo: 234/456 SCU</p>
          </div>
        </div>
      </GlassPanel>
    </LayoutContainer>
  ),
};

/**
 * Top-positioned panel (header)
 */
export const TopPanel: Story = {
  render: () => (
    <LayoutContainer style={{ flexDirection: 'column' }}>
      <GlassPanel position="top" height={64} bordered>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: '#00d9ff', fontSize: '1.25rem' }}>Fleet Manager</h2>
          <nav style={{ display: 'flex', gap: '16px' }}>
            {['Dashboard', 'Fleet', 'Members'].map((item) => (
              <a
                key={item}
                href="#"
                style={{ color: '#e0e6ed', textDecoration: 'none' }}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
      </GlassPanel>
      <div style={{ flex: 1, padding: '24px' }}>
        <p style={{ color: '#e0e6ed' }}>Page content below header.</p>
      </div>
    </LayoutContainer>
  ),
};

/**
 * Bottom-positioned panel (footer/toolbar)
 */
export const BottomPanel: Story = {
  render: () => (
    <LayoutContainer style={{ flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ color: '#00d9ff', margin: '0 0 16px 0' }}>Editor</h1>
        <p style={{ color: '#e0e6ed' }}>Content above toolbar.</p>
      </div>
      <GlassPanel position="bottom" height={60} bordered>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: '#8a9eb5',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            style={{
              padding: '8px 16px',
              background: 'rgba(0, 217, 255, 0.2)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
              borderRadius: '6px',
              color: '#00d9ff',
              cursor: 'pointer',
            }}
          >
            Save Changes
          </button>
        </div>
      </GlassPanel>
    </LayoutContainer>
  ),
};

/**
 * Collapsible panel
 */
const CollapsibleDemo = () => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <LayoutContainer>
      <GlassPanel
        title="Navigation"
        width={280}
        collapsedWidth={60}
        collapsible
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        <nav>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Dashboard', 'Fleet', 'Members', 'Events', 'Settings'].map((item) => (
              <li key={item}>
                <a
                  href="#"
                  style={{
                    display: 'block',
                    padding: '12px',
                    color: '#e0e6ed',
                    textDecoration: 'none',
                    borderRadius: '6px',
                  }}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </GlassPanel>
      <div style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ color: '#00d9ff', margin: '0 0 16px 0' }}>Collapsible Navigation</h1>
        <p style={{ color: '#e0e6ed' }}>
          Click the toggle button to collapse/expand the panel.
        </p>
      </div>
    </LayoutContainer>
  );
};

export const Collapsible: Story = {
  render: () => <CollapsibleDemo />,
};

/**
 * Glass variants
 */
export const ClearVariant: Story = {
  render: () => (
    <LayoutContainer>
      <GlassPanel variant="clear" title="Clear Glass" width={280}>
        <p>More transparent with stronger blur effect.</p>
      </GlassPanel>
      <div style={{ flex: 1, padding: '24px' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'url("https://picsum.photos/800/600") center/cover',
            borderRadius: '8px',
          }}
        />
      </div>
    </LayoutContainer>
  ),
};

export const TintedVariant: Story = {
  render: () => (
    <LayoutContainer>
      <GlassPanel variant="tinted" title="Tinted Glass" width={280}>
        <p>Colored tint for accent areas.</p>
      </GlassPanel>
      <div style={{ flex: 1, padding: '24px' }}>
        <p style={{ color: '#e0e6ed' }}>Main content area.</p>
      </div>
    </LayoutContainer>
  ),
};

/**
 * With footer
 */
export const WithFooter: Story = {
  render: () => (
    <LayoutContainer>
      <GlassPanel
        title="Account"
        width={280}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(0, 217, 255, 0.2)',
              }}
            />
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Commander</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#8a9eb5' }}>Online</p>
            </div>
          </div>
        }
      >
        <nav>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['Profile', 'Settings', 'Notifications'].map((item) => (
              <li key={item}>
                <a
                  href="#"
                  style={{
                    display: 'block',
                    padding: '12px',
                    color: '#e0e6ed',
                    textDecoration: 'none',
                    borderRadius: '6px',
                  }}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </GlassPanel>
      <div style={{ flex: 1, padding: '24px' }}>
        <p style={{ color: '#e0e6ed' }}>Main content with panel footer.</p>
      </div>
    </LayoutContainer>
  ),
};

/**
 * No border
 */
export const NoBorder: Story = {
  render: () => (
    <LayoutContainer>
      <GlassPanel title="No Border" width={280} bordered={false}>
        <p>Panel without position-based border.</p>
      </GlassPanel>
      <div style={{ flex: 1, padding: '24px' }}>
        <p style={{ color: '#e0e6ed' }}>Main content area.</p>
      </div>
    </LayoutContainer>
  ),
};
