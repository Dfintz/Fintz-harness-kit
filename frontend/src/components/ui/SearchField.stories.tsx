/**
 * SearchField Stories - Storybook documentation for SearchField component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Stack, Box } from '@mui/material';
import { SearchField } from './SearchField';

export const meta: Meta<typeof SearchField> = {
  title: 'UI/SearchField',
  component: SearchField,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
SearchField provides a consistent search input with integrated search icon and clear functionality.

## Features
- Search icon prefix
- Clear button (shows when value exists)
- Multiple sizes
- Full width option
- Accessible with ARIA label

## Usage
\`\`\`tsx

<SearchField
  label="Search"
  value={searchTerm}
  onChange={setSearchTerm}
  placeholder="Search items..."
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
    },
    label: {
      control: 'text',
    },
    placeholder: {
      control: 'text',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
    showClearButton: {
      control: 'boolean',
    },
    fullWidth: {
      control: 'boolean',
    },
  },
};

type Story = StoryObj<typeof SearchField>;

export const Default: Story = {
  args: {
    placeholder: 'Search...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search items...',
  },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState('');

    return (
      <Stack spacing={2}>
        <SearchField
          placeholder="Type to search..."
          value={value}
          onChange={setValue}
          onClear={() => setValue('')}
        />
        <Box sx={{ color: '#9e9e9e', fontSize: '0.875rem' }}>
          Current value: "{value}"
        </Box>
      </Stack>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'SearchField works as a controlled component with value and onChange props.',
      },
    },
  },
};

export const WithValue: Story = {
  args: {
    placeholder: 'Search...',
    value: 'Aurora MR',
  },
  parameters: {
    docs: {
      description: {
        story: 'When there is a value, the clear button appears automatically.',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <Stack spacing={2}>
      <SearchField size="sm" placeholder="Small search" />
      <SearchField size="md" placeholder="Medium search (default)" />
      <SearchField size="lg" placeholder="Large search" />
    </Stack>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: 'Search...',
    disabled: true,
  },
};

export const NoClearButton: Story = {
  args: {
    placeholder: 'Search...',
    value: 'Test value',
    showClearButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Disable the clear button with `showClearButton={false}`.',
      },
    },
  },
};

export const FullWidth: Story = {
  args: {
    placeholder: 'Search entire fleet...',
    fullWidth: true,
  },
  decorators: [
    (Story) => (
      <Box sx={{ width: 500 }}>
        <Story />
      </Box>
    ),
  ],
};

export const CustomWidth: Story = {
  args: {
    placeholder: 'Search...',
    width: 400,
  },
};

export const InToolbar: Story = {
  render: () => (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        alignItems: 'center',
        p: 2,
        backgroundColor: '#1a2942',
        borderRadius: 1,
        width: 600,
      }}
    >
      <Box sx={{ color: '#fff', fontWeight: 'bold' }}>Fleet Manager</Box>
      <Box sx={{ flex: 1 }} />
      <SearchField
        placeholder="Search ships..."
        size="sm"
        width={250}
      />
    </Box>
  ),
  parameters: {
    docs: {
      description: {
        story: 'SearchField integrated into a toolbar layout.',
      },
    },
  },
};

export const WithEvents: Story = {
  render: () => {
    const [value, setValue] = useState('');
    const [events, setEvents] = useState<string[]>([]);

    const addEvent = (event: string) => {
      setEvents((prev) => [...prev.slice(-4), event]);
    };

    return (
      <Stack spacing={2}>
        <SearchField
          placeholder="Type and interact..."
          value={value}
          onChange={(v) => {
            setValue(v);
            addEvent(`onChange: "${v}"`);
          }}
          onFocus={() => addEvent('onFocus')}
          onBlur={() => addEvent('onBlur')}
          onClear={() => {
            setValue('');
            addEvent('onClear');
          }}
        />
        <Box
          sx={{
            p: 1,
            backgroundColor: '#0a0f1e',
            borderRadius: 1,
            minHeight: 100,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
          }}
        >
          <Box sx={{ color: '#9e9e9e', mb: 1 }}>Events:</Box>
          {events.map((event, i) => (
            <Box key={i} sx={{ color: '#00d9ff' }}>{event}</Box>
          ))}
        </Box>
      </Stack>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'SearchField emits various events: onChange, onFocus, onBlur, and onClear.',
      },
    },
  },
};
