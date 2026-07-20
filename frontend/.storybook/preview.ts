import { ThemeProvider } from '@mui/material/styles';
import type { Preview } from '@storybook/react';
import React from 'react';
import { muiTheme } from '../src/theme/muiTheme';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a1929' },
        { name: 'light', value: '#f5f5f5' },
      ],
    },
    layout: 'centered',
    docs: {
      theme: undefined,
    },
    options: {
      storySort: {
        method: 'alphabetical',
      },
    },
  },
  globalTypes: {
    colorScheme: {
      name: 'Color Scheme',
      description: 'Global color scheme for components',
      defaultValue: 'dark',
      toolbar: {
        icon: 'paintbrush',
        items: ['light', 'dark'],
        showName: true,
      },
    },
  },
  decorators: [
    (Story) => React.createElement(ThemeProvider, { theme: muiTheme }, React.createElement(Story)),
  ],
};

export default preview;
