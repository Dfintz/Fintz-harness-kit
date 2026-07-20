import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GlassButton } from '@/components/ui/GlassButton';

describe('GlassButton', () => {
  describe('Rendering', () => {
    it('renders with children text', () => {
      render(<GlassButton>Click Me</GlassButton>);
      expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
    });

    it('renders with default variant (primary)', () => {
      render(<GlassButton>Button</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('glass-button--primary');
    });

    it('renders with custom testId', () => {
      render(<GlassButton testId="custom-button">Button</GlassButton>);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it.each(['primary', 'secondary', 'accent', 'ghost', 'danger', 'success'] as const)(
      'renders with %s variant',
      (variant) => {
        render(<GlassButton variant={variant}>Button</GlassButton>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`glass-button--${variant}`);
      }
    );
  });

  describe('Sizes', () => {
    it.each(['sm', 'md', 'lg'] as const)(
      'renders with %s size',
      (size) => {
        render(<GlassButton size={size}>Button</GlassButton>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`glass-button--${size}`);
      }
    );
  });

  describe('States', () => {
    it('renders in disabled state', () => {
      render(<GlassButton disabled>Disabled</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('renders in loading state', () => {
      render(<GlassButton loading>Loading</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveClass('glass-button--loading');
    });

    it('shows loading spinner when loading', () => {
      render(<GlassButton loading>Loading</GlassButton>);
      const spinner = document.querySelector('.glass-button__spinner');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Full Width', () => {
    it('applies full-width class when fullWidth is true', () => {
      render(<GlassButton fullWidth>Full Width</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('glass-button--full-width');
    });
  });

  describe('Icons', () => {
    it('renders leading icon', () => {
      const icon = <svg data-testid="leading-icon" />;
      render(<GlassButton icon={icon}>With Icon</GlassButton>);
      expect(screen.getByTestId('leading-icon')).toBeInTheDocument();
    });

    it('renders trailing icon', () => {
      const icon = <svg data-testid="trailing-icon" />;
      render(<GlassButton iconEnd={icon}>With Icon</GlassButton>);
      expect(screen.getByTestId('trailing-icon')).toBeInTheDocument();
    });

    it('does not render icons when loading', () => {
      const leadingIcon = <svg data-testid="leading-icon" />;
      const trailingIcon = <svg data-testid="trailing-icon" />;
      render(
        <GlassButton loading icon={leadingIcon} iconEnd={trailingIcon}>
          Loading
        </GlassButton>
      );
      expect(screen.queryByTestId('leading-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trailing-icon')).not.toBeInTheDocument();
    });
  });

  describe('Pulse Animation', () => {
    it('applies pulse class when pulse is true', () => {
      render(<GlassButton pulse>Pulse</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('glass-button--pulse');
    });
  });

  describe('Custom Glow Color', () => {
    it('applies custom glow color as CSS variable', () => {
      render(<GlassButton glowColor="rgba(255, 0, 0, 0.5)">Custom Glow</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ '--glass-button-glow-color': 'rgba(255, 0, 0, 0.5)' });
    });
  });

  describe('Interactions', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = jest.fn();
      render(<GlassButton onClick={handleClick}>Click Me</GlassButton>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = jest.fn();
      render(
        <GlassButton disabled onClick={handleClick}>
          Disabled
        </GlassButton>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const handleClick = jest.fn();
      render(
        <GlassButton loading onClick={handleClick}>
          Loading
        </GlassButton>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('is focusable when not disabled', () => {
      render(<GlassButton>Button</GlassButton>);
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('is not focusable when disabled', () => {
      render(<GlassButton disabled>Disabled</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('has correct ARIA attributes when loading', () => {
      render(<GlassButton loading>Loading</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<GlassButton className="custom-class">Button</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Style prop', () => {
    it('applies custom style', () => {
      render(<GlassButton style={{ marginTop: '10px' }}>Button</GlassButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ marginTop: '10px' });
    });
  });
});
