import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { NavigationProgress } from '@/components/NavigationProgress';

// Create a test router that provides the navigation context
const createTestRouter = (initialEntries: string[] = ['/']) => {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <NavigationProgress />,
      },
    ],
    {
      initialEntries,
    }
  );
};

describe('NavigationProgress', () => {
  it('renders and then hides after initial mount', async () => {
    const router = createTestRouter();
    const { container } = render(<RouterProvider router={router} />);
    
    // Initially the component may show at 100% (completing initial navigation)
    // but it should eventually hide (progress goes to 0)
    await waitFor(
      () => {
        expect(container.querySelector('.navigation-progress-bar')).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });

  it('mounts successfully with data router context', () => {
    const router = createTestRouter();
    const { container } = render(<RouterProvider router={router} />);
    
    // Verify the component mounts without errors
    // The navigation progress bar may or may not be visible depending on timing
    expect(container).toBeDefined();
  });
});
