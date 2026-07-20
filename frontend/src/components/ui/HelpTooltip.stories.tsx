import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { HelpTooltip } from './HelpTooltip';

export const meta: Meta<typeof HelpTooltip> = {
  title: 'UI/HelpTooltip',
  component: HelpTooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0a1628' }],
    },
  },
  argTypes: {
    position: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      description: 'Preferred tooltip position',
    },
    showDelay: {
      control: { type: 'number', min: 0, max: 1000 },
      description: 'Delay before showing tooltip (ms)',
    },
    hideDelay: {
      control: { type: 'number', min: 0, max: 1000 },
      description: 'Delay before hiding tooltip (ms)',
    },
    icon: {
      control: 'boolean',
      description: 'Show help icon trigger',
    },
    iconSize: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Icon size',
    },
    maxWidth: {
      control: { type: 'number', min: 100, max: 500 },
      description: 'Maximum tooltip width',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable tooltip',
    },
  },
};

type Story = StoryObj<typeof HelpTooltip>;

/**
 * Default tooltip wrapping an element
 */
export const Default: Story = {
  render: () => (
    <div style={{ padding: '100px' }}>
      <HelpTooltip content="This is helpful information about the feature.">
        <button
          style={{
            padding: '12px 24px',
            background: 'rgba(0, 217, 255, 0.2)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
            borderRadius: '8px',
            color: '#00d9ff',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Hover for help
        </button>
      </HelpTooltip>
    </div>
  ),
};

/**
 * Help icon trigger mode
 */
export const IconMode: Story = {
  render: () => (
    <div style={{ padding: '100px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ color: '#e0e6ed' }}>Fleet Credits</span>
      <HelpTooltip
        content="This shows your total credits available for trading operations."
        icon
      />
    </div>
  ),
};

/**
 * Different icon sizes
 */
export const IconSizes: Story = {
  render: () => (
    <div style={{ padding: '100px', display: 'flex', alignItems: 'center', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#e0e6ed', fontSize: '0.75rem' }}>Small</span>
        <HelpTooltip content="Small icon tooltip" icon iconSize="sm" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#e0e6ed', fontSize: '1rem' }}>Medium</span>
        <HelpTooltip content="Medium icon tooltip" icon iconSize="md" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#e0e6ed', fontSize: '1.25rem' }}>Large</span>
        <HelpTooltip content="Large icon tooltip" icon iconSize="lg" />
      </div>
    </div>
  ),
};

/**
 * Different positions
 */
export const Positions: Story = {
  render: () => (
    <div
      style={{
        padding: '150px 200px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '48px',
        textAlign: 'center',
      }}
    >
      <div />
      <HelpTooltip content="Tooltip on top" position="top">
        <button style={buttonStyle}>Top</button>
      </HelpTooltip>
      <div />
      
      <HelpTooltip content="Tooltip on left" position="left">
        <button style={buttonStyle}>Left</button>
      </HelpTooltip>
      <div />
      <HelpTooltip content="Tooltip on right" position="right">
        <button style={buttonStyle}>Right</button>
      </HelpTooltip>
      
      <div />
      <HelpTooltip content="Tooltip on bottom" position="bottom">
        <button style={buttonStyle}>Bottom</button>
      </HelpTooltip>
      <div />
    </div>
  ),
};

const buttonStyle = {
  padding: '12px 24px',
  background: 'rgba(0, 217, 255, 0.2)',
  border: '1px solid rgba(0, 217, 255, 0.3)',
  borderRadius: '8px',
  color: '#00d9ff',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

/**
 * Rich content tooltip
 */
export const RichContent: Story = {
  render: () => (
    <div style={{ padding: '100px' }}>
      <HelpTooltip
        content={
          <div>
            <strong style={{ color: '#00d9ff' }}>Fleet Management Tips</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: 'rgba(255,255,255,0.9)' }}>
              <li>Add ships to your fleet</li>
              <li>Organize into squadrons</li>
              <li>Assign crew members</li>
            </ul>
          </div>
        }
        maxWidth={280}
      >
        <button style={buttonStyle}>Hover for tips</button>
      </HelpTooltip>
    </div>
  ),
};

/**
 * With custom delay
 */
export const CustomDelay: Story = {
  render: () => (
    <div style={{ padding: '100px', display: 'flex', gap: '24px' }}>
      <HelpTooltip content="Instant tooltip" showDelay={0}>
        <button style={buttonStyle}>No delay</button>
      </HelpTooltip>
      <HelpTooltip content="Delayed tooltip" showDelay={500}>
        <button style={buttonStyle}>500ms delay</button>
      </HelpTooltip>
    </div>
  ),
};

/**
 * Form field with help
 */
export const FormFieldHelp: Story = {
  render: () => (
    <div style={{ padding: '100px', maxWidth: '400px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <label style={{ color: '#e0e6ed', fontSize: '0.875rem' }}>RSI Handle</label>
          <HelpTooltip
            content="Your RSI Handle is your username on the Roberts Space Industries website."
            icon
            iconSize="sm"
          />
        </div>
        <input
          type="text"
          placeholder="Enter your RSI Handle"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#e0e6ed',
            fontSize: '1rem',
          }}
        />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <label style={{ color: '#e0e6ed', fontSize: '0.875rem' }}>Organization SID</label>
          <HelpTooltip
            content="The Spectrum ID (SID) is the unique identifier for your organization. You can find it on your org's RSI page."
            icon
            iconSize="sm"
          />
        </div>
        <input
          type="text"
          placeholder="Enter organization SID"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#e0e6ed',
            fontSize: '1rem',
          }}
        />
      </div>
    </div>
  ),
};

/**
 * Disabled state
 */
export const Disabled: Story = {
  render: () => (
    <div style={{ padding: '100px' }}>
      <HelpTooltip content="This tooltip won't show" disabled>
        <button style={{ ...buttonStyle, opacity: 0.5 }}>Disabled tooltip</button>
      </HelpTooltip>
    </div>
  ),
};
