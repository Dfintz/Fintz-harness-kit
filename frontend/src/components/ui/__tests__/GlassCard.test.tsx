import { fireEvent, render, screen } from '@testing-library/react';
import { GlassCard } from '@/components/ui/GlassCard';

describe('GlassCard', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(<GlassCard>Test content</GlassCard>);
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(<GlassCard title="Card Title">Content</GlassCard>);
      expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(<GlassCard title="Title" subtitle="Subtitle text">Content</GlassCard>);
      expect(screen.getByText('Subtitle text')).toBeInTheDocument();
    });

    it('renders header action when provided', () => {
      render(
        <GlassCard title="Title" headerAction={<button>Action</button>}>
          Content
        </GlassCard>
      );
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(<GlassCard footer={<span>Footer content</span>}>Content</GlassCard>);
      expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<GlassCard className="custom-class" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('custom-class');
    });

    it('applies testId attribute', () => {
      render(<GlassCard testId="test-card">Content</GlassCard>);
      expect(screen.getByTestId('test-card')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('applies clear variant class', () => {
      render(<GlassCard variant="clear" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--clear');
    });

    it('applies frosted variant class (default)', () => {
      render(<GlassCard testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--frosted');
    });

    it('applies tinted variant class', () => {
      render(<GlassCard variant="tinted" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--tinted');
    });
  });

  describe('glow colors', () => {
    it('applies cyan glow class (default)', () => {
      render(<GlassCard testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--glow-cyan');
    });

    it('applies purple glow class', () => {
      render(<GlassCard glowColor="purple" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--glow-purple');
    });

    it('applies green glow class', () => {
      render(<GlassCard glowColor="green" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--glow-green');
    });

    it('applies orange glow class', () => {
      render(<GlassCard glowColor="orange" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--glow-orange');
    });

    it('does not apply glow class when set to none', () => {
      render(<GlassCard glowColor="none" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).not.toHaveClass('glass-card--glow-cyan');
      expect(screen.getByTestId('card')).not.toHaveClass('glass-card--glow-purple');
    });
  });

  describe('sizes', () => {
    it('applies sm size class', () => {
      render(<GlassCard size="sm" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--sm');
    });

    it('applies md size class (default)', () => {
      render(<GlassCard testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--md');
    });

    it('applies lg size class', () => {
      render(<GlassCard size="lg" testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--lg');
    });
  });

  describe('interactive mode', () => {
    it('is not interactive by default', () => {
      render(<GlassCard testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).not.toHaveClass('glass-card--interactive');
      expect(screen.getByTestId('card')).not.toHaveAttribute('role', 'button');
    });

    it('applies interactive class when interactive prop is true', () => {
      render(<GlassCard interactive testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--interactive');
    });

    it('sets role="button" when interactive', () => {
      render(<GlassCard interactive testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveAttribute('role', 'button');
    });

    it('sets tabIndex="0" when interactive', () => {
      render(<GlassCard interactive testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveAttribute('tabIndex', '0');
    });

    it('calls onClick handler when clicked', () => {
      const onClick = jest.fn();
      render(<GlassCard interactive onClick={onClick} testId="card">Content</GlassCard>);
      
      fireEvent.click(screen.getByTestId('card'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when not interactive', () => {
      const onClick = jest.fn();
      render(<GlassCard onClick={onClick} testId="card">Content</GlassCard>);
      
      fireEvent.click(screen.getByTestId('card'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('calls onClick on Enter key press', () => {
      const onClick = jest.fn();
      render(<GlassCard interactive onClick={onClick} testId="card">Content</GlassCard>);
      
      fireEvent.keyDown(screen.getByTestId('card'), { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick on Space key press', () => {
      const onClick = jest.fn();
      render(<GlassCard interactive onClick={onClick} testId="card">Content</GlassCard>);
      
      fireEvent.keyDown(screen.getByTestId('card'), { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick on other key presses', () => {
      const onClick = jest.fn();
      render(<GlassCard interactive onClick={onClick} testId="card">Content</GlassCard>);
      
      fireEvent.keyDown(screen.getByTestId('card'), { key: 'Tab' });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('selected state', () => {
    it('does not apply selected class by default', () => {
      render(<GlassCard testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).not.toHaveClass('glass-card--selected');
    });

    it('applies selected class when selected prop is true', () => {
      render(<GlassCard selected testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveClass('glass-card--selected');
    });

    it('sets aria-pressed when interactive and selected', () => {
      render(<GlassCard interactive selected testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).toHaveAttribute('aria-pressed', 'true');
    });

    it('does not set aria-pressed when not interactive', () => {
      render(<GlassCard selected testId="card">Content</GlassCard>);
      expect(screen.getByTestId('card')).not.toHaveAttribute('aria-pressed');
    });
  });

  describe('accessibility', () => {
    it('has backdrop with aria-hidden', () => {
      render(<GlassCard testId="card">Content</GlassCard>);
      const backdrop = screen.getByTestId('card').querySelector('.glass-card__backdrop');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });

    it('has glow element with aria-hidden', () => {
      render(<GlassCard glowColor="cyan" testId="card">Content</GlassCard>);
      const glow = screen.getByTestId('card').querySelector('.glass-card__glow');
      expect(glow).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
