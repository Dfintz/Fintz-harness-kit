import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { RenderOptions, render as rtlRender } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { muiTheme } from '@/theme/muiTheme';

// Create a custom render function that includes all necessary ThemeProviders
interface AllTheThemeProvidersProps {
  children: React.ReactNode;
}

function AllTheThemeProviders({ children }: AllTheThemeProvidersProps) {
  return (
    <MemoryRouter>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </MemoryRouter>
  );
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  return rtlRender(ui, { wrapper: AllTheThemeProviders, ...options });
};

// Re-export everything from testing library EXCEPT render
export {
  act,
  cleanup,
  fireEvent,
  renderHook,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';

// Export our custom render
export { customRender as render };
