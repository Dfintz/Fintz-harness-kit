import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

export const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'The size of the select',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the select is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the select is required',
    },
    isInvalid: {
      control: 'boolean',
      description: 'Whether the select is in an error state',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Whether the select takes full width',
    },
  },
};

type Story = StoryObj<typeof meta>;

const roleOptions = [
  { value: 'admin', label: 'Administrator' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'medic', label: 'Medic' },
  { value: 'gunner', label: 'Gunner' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'retired', label: 'Retired' },
];

const shipOptions = [
  { value: '600i', label: 'Origin 600i' },
  { value: 'carrack', label: 'Anvil Carrack' },
  { value: 'hammerhead', label: 'Aegis Hammerhead' },
  { value: 'mercury', label: 'Crusader Mercury Star Runner' },
  { value: 'cutlass', label: 'Drake Cutlass Black' },
];

export const Default: Story = {
  args: {
    label: 'Select Role',
    options: roleOptions,
    placeholder: 'Choose a role...',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Status',
    options: statusOptions,
    value: 'active',
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Ship Type',
    options: shipOptions,
    placeholder: 'Select a ship...',
    helperText: 'Choose the ship type for this mission',
  },
};

export const Required: Story = {
  args: {
    label: 'Mission Role',
    options: roleOptions,
    placeholder: 'Select role...',
    required: true,
  },
};

export const Invalid: Story = {
  args: {
    label: 'Role',
    options: roleOptions,
    value: '',
    isInvalid: true,
    errorMessage: 'Please select a role',
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Role',
    options: roleOptions,
    value: 'pilot',
    disabled: true,
  },
};

export const Small: Story = {
  args: {
    label: 'Size Small',
    options: roleOptions,
    size: 'sm',
    placeholder: 'Select...',
  },
};

export const Large: Story = {
  args: {
    label: 'Size Large',
    options: roleOptions,
    size: 'lg',
    placeholder: 'Select...',
  },
};

export const WithDisabledOptions: Story = {
  args: {
    label: 'Ship Selection',
    options: [
      { value: '600i', label: 'Origin 600i' },
      { value: 'carrack', label: 'Anvil Carrack' },
      { value: 'hammerhead', label: 'Aegis Hammerhead (Out of Stock)', disabled: true },
      { value: 'mercury', label: 'Crusader Mercury Star Runner' },
      { value: 'cutlass', label: 'Drake Cutlass Black (Maintenance)', disabled: true },
    ],
    placeholder: 'Select ship...',
  },
};

export const FormExample: Story = {
  name: 'Form Example',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
      <Select
        label="Role"
        options={roleOptions}
        placeholder="Select role..."
        required
      />
      <Select
        label="Status"
        options={statusOptions}
        value="active"
      />
      <Select
        label="Primary Ship"
        options={shipOptions}
        placeholder="Select ship..."
        helperText="Your main assigned ship"
      />
    </div>
  ),
};

export const NumericValues: Story = {
  name: 'With Numeric Values',
  args: {
    label: 'Crew Size',
    options: [
      { value: 1, label: 'Solo (1 person)' },
      { value: 3, label: 'Small (2-4 people)' },
      { value: 6, label: 'Medium (5-8 people)' },
      { value: 12, label: 'Large (9-15 people)' },
      { value: 20, label: 'Very Large (16+ people)' },
    ],
    placeholder: 'Select crew size...',
  },
};
