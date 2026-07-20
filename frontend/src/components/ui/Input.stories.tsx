import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Input } from './Input';

export const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'number', 'search', 'tel', 'url'],
      description: 'The type of input',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'The size of the input',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    isInvalid: {
      control: 'boolean',
      description: 'Whether the input is in error state',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Whether the input takes full width',
    },
  },
};

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Fleet Name',
    placeholder: 'Enter fleet name',
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Ship Identifier',
    placeholder: 'e.g., SC-001',
    helperText: 'Enter a unique ship identifier',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'email@example.com',
    isInvalid: true,
    errorMessage: 'Please enter a valid email address',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    label: 'Password',
    placeholder: 'Enter your password',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    label: 'Ship Count',
    placeholder: '0',
    helperText: 'Enter the number of ships',
  },
};

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search ships...',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    placeholder: 'Small input',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    placeholder: 'Large input',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    value: 'Cannot edit this',
    disabled: true,
  },
};

export const FullWidth: Story = {
  args: {
    label: 'Description',
    placeholder: 'Enter a description...',
    fullWidth: true,
  },
  parameters: {
    layout: 'padded',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
};

export const Controlled: Story = {
  render: function ControlledInput() {
    const [value, setValue] = useState('');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Input
          label="Controlled Input"
          value={value}
          onChange={value => setValue(value)}
          placeholder="Type something..."
        />
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#8a8a8a' }}>
          Value: {value || '(empty)'}
        </p>
      </div>
    );
  },
};
