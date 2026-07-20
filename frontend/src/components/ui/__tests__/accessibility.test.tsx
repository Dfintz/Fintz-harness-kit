/**
 * Accessibility Tests for UI Components
 *
 * Uses jest-axe to automatically check for WCAG 2.1 AA accessibility violations.
 * These tests help ensure our components are accessible to all users.
 *
 * @see https://github.com/nickcolley/jest-axe
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material';
import { muiTheme } from '@/theme/muiTheme';

// Import components to test
import { GlassButton } from '@/components/ui/GlassButton';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { SearchField } from '@/components/ui/SearchField';
import { Form } from '@/components/ui/Form';
import { FormField } from '@/components/ui/FormField';
import { Well } from '@/components/ui/Well';
import { LazyImage } from '@/components/ui/LazyImage';
import Refresh from '@mui/icons-material/Refresh';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Helper to render with theme provider
const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={muiTheme}>{component}</ThemeProvider>);
};

describe('UI Component Accessibility', () => {
  describe('GlassButton', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <GlassButton variant="primary">Click Me</GlassButton>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations when disabled', async () => {
      const { container } = renderWithTheme(
        <GlassButton variant="primary" disabled>
          Disabled Button
        </GlassButton>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations for all variants', async () => {
      const variants = ['primary', 'secondary', 'accent', 'ghost', 'danger', 'success'] as const;

      for (const variant of variants) {
        const { container } = renderWithTheme(
          <GlassButton variant={variant}>{variant} Button</GlassButton>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });
  });

  describe('Input', () => {
    it('should have no accessibility violations with label', async () => {
      const { container } = renderWithTheme(
        <Input label="Email" name="email" type="email" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations with error state', async () => {
      const { container } = renderWithTheme(
        <Input
          label="Email"
          name="email"
          type="email"
          isInvalid
          errorMessage="Please enter a valid email"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations with helper text', async () => {
      const { container } = renderWithTheme(
        <Input
          label="Password"
          name="password"
          type="password"
          helperText="Must be at least 8 characters"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('IconButton', () => {
    it('should have no violations with aria-label', async () => {
      const { container } = renderWithTheme(
        <IconButton aria-label="Refresh data">
          <span>🔄</span>
        </IconButton>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations with tooltip', async () => {
      const { container } = renderWithTheme(
        <IconButton tooltip="Refresh data">
          <span>🔄</span>
        </IconButton>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('SearchField', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <SearchField
          label="Search"
          placeholder="Search items..."
          aria-label="Search items"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <Form aria-label="User registration form">
          <FormField name="username" label="Username" required />
          <FormField name="email" label="Email" type="email" required />
          <Form.Actions>
            <GlassButton type="submit" variant="primary">
              Submit
            </GlassButton>
          </Form.Actions>
        </Form>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations in loading state', async () => {
      const { container } = renderWithTheme(
        <Form aria-label="Loading form" loading>
          <FormField name="username" label="Username" />
        </Form>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations with errors', async () => {
      const { container } = renderWithTheme(
        <Form aria-label="Form with errors">
          <FormField
            name="email"
            label="Email"
            type="email"
            error="Please enter a valid email"
          />
        </Form>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Well', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <Well>
          <p>Content inside a Well component</p>
        </Well>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('LazyImage', () => {
    it('should have no violations with proper alt text', async () => {
      const { container } = renderWithTheme(
        <LazyImage
          src="https://example.com/image.jpg"
          alt="A descriptive alt text for the image"
          width={200}
          height={150}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

/**
 * Test helper for custom accessibility checks
 *
 * @example
 * const { container } = render(<MyComponent />);
 * await expectNoA11yViolations(container);
 */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}
