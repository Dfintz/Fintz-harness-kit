import { fireEvent, render, screen } from '@testing-library/react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import Settings from '@mui/icons-material/Settings';

describe('GlassPanel', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(<GlassPanel>Panel content</GlassPanel>);
      expect(screen.getByText('Panel content')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(<GlassPanel title="Panel Title">Content</GlassPanel>);
      expect(screen.getByRole('heading', { name: 'Panel Title' })).toBeInTheDocument();
    });

    it('renders header action when provided', () => {
      render(
        <GlassPanel title="Title" headerAction={<button>Settings</button>}>
          Content
        </GlassPanel>
      );
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(<GlassPanel footer={<span>Footer content</span>}>Content</GlassPanel>);
      expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<GlassPanel className="custom-class" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('custom-class');
    });

    it('applies testId attribute', () => {
      render(<GlassPanel testId="test-panel">Content</GlassPanel>);
      expect(screen.getByTestId('test-panel')).toBeInTheDocument();
    });

    it('renders as aside element', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel').tagName).toBe('ASIDE');
    });
  });

  describe('positions', () => {
    it('applies left position class (default)', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--left');
    });

    it('applies right position class', () => {
      render(<GlassPanel position="right" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--right');
    });

    it('applies top position class', () => {
      render(<GlassPanel position="top" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--top');
    });

    it('applies bottom position class', () => {
      render(<GlassPanel position="bottom" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--bottom');
    });
  });

  describe('variants', () => {
    it('applies clear variant class', () => {
      render(<GlassPanel variant="clear" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--clear');
    });

    it('applies frosted variant class (default)', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--frosted');
    });

    it('applies tinted variant class', () => {
      render(<GlassPanel variant="tinted" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--tinted');
    });
  });

  describe('dimensions', () => {
    it('applies width as number in pixels', () => {
      render(<GlassPanel width={300} testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveStyle({ width: '300px' });
    });

    it('applies width as string', () => {
      render(<GlassPanel width="50%" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveStyle({ width: '50%' });
    });

    it('applies height for top/bottom panels', () => {
      render(<GlassPanel position="top" height={100} testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveStyle({ height: '100px' });
    });
  });

  describe('bordered', () => {
    it('applies bordered class by default', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--bordered');
    });

    it('does not apply bordered class when bordered is false', () => {
      render(<GlassPanel bordered={false} testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).not.toHaveClass('glass-panel--bordered');
    });
  });

  describe('collapsible', () => {
    it('does not render toggle button by default', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      expect(screen.queryByRole('button', { name: /expand|collapse/i })).not.toBeInTheDocument();
    });

    it('renders toggle button when collapsible', () => {
      render(<GlassPanel collapsible testId="panel">Content</GlassPanel>);
      expect(screen.getByRole('button', { name: /collapse panel/i })).toBeInTheDocument();
    });

    it('calls onToggle when toggle button is clicked', () => {
      const onToggle = jest.fn();
      render(
        <GlassPanel collapsible onToggle={onToggle} testId="panel">
          Content
        </GlassPanel>
      );
      
      fireEvent.click(screen.getByRole('button', { name: /collapse panel/i }));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('applies collapsed class when collapsed', () => {
      render(<GlassPanel collapsible collapsed testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveClass('glass-panel--collapsed');
    });

    it('hides content when collapsed', () => {
      render(
        <GlassPanel collapsible collapsed testId="panel">
          <span>Hidden content</span>
        </GlassPanel>
      );
      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });

    it('hides title when collapsed', () => {
      render(
        <GlassPanel collapsible collapsed title="Panel Title" testId="panel">
          Content
        </GlassPanel>
      );
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('applies collapsedWidth when collapsed', () => {
      render(
        <GlassPanel 
          collapsible 
          collapsed 
          width={280} 
          collapsedWidth={60} 
          testId="panel"
        >
          Content
        </GlassPanel>
      );
      expect(screen.getByTestId('panel')).toHaveStyle({ width: '60px' });
    });

    it('applies collapsedHeight for horizontal panels when collapsed', () => {
      render(
        <GlassPanel 
          position="top"
          collapsible 
          collapsed 
          height={200} 
          collapsedHeight={48} 
          testId="panel"
        >
          Content
        </GlassPanel>
      );
      expect(screen.getByTestId('panel')).toHaveStyle({ height: '48px' });
    });

    it('toggle button has aria-expanded attribute', () => {
      render(
        <GlassPanel collapsible collapsed={false} testId="panel">
          Content
        </GlassPanel>
      );
      expect(screen.getByRole('button', { name: /collapse panel/i })).toHaveAttribute('aria-expanded', 'true');
    });

    it('toggle button shows expand label when collapsed', () => {
      render(
        <GlassPanel collapsible collapsed testId="panel">
          Content
        </GlassPanel>
      );
      expect(screen.getByRole('button', { name: /expand panel/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-label based on title', () => {
      render(<GlassPanel title="Navigation" testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveAttribute('aria-label', 'Navigation');
    });

    it('has default aria-label when no title provided', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      expect(screen.getByTestId('panel')).toHaveAttribute('aria-label', 'Panel');
    });

    it('has backdrop with aria-hidden', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      const backdrop = screen.getByTestId('panel').querySelector('.glass-panel__backdrop');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });

    it('has glow element with aria-hidden', () => {
      render(<GlassPanel testId="panel">Content</GlassPanel>);
      const glow = screen.getByTestId('panel').querySelector('.glass-panel__glow');
      expect(glow).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
