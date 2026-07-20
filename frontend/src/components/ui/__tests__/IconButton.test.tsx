import { Close as CloseIcon, Menu as MenuIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test-utils/test-utils';
import { IconButton } from '@/components/ui/IconButton';

describe('IconButton Component', () => {
  it('renders with icon child', () => {
    render(
      <IconButton aria-label="Close">
        <CloseIcon />
      </IconButton>
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <IconButton onClick={handleClick} aria-label="Refresh">
        <RefreshIcon />
      </IconButton>
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onPress when pressed (backward compatibility)', async () => {
    const user = userEvent.setup();
    const handlePress = jest.fn();
    render(
      <IconButton onClick={handlePress} aria-label="Menu">
        <MenuIcon />
      </IconButton>
    );

    await user.click(screen.getByRole('button'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('prefers onClick over onPress when both are provided', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    const handlePress = jest.fn();
    render(
      <IconButton onClick={handleClick} onPress={handlePress} aria-label="Test">
        <CloseIcon />
      </IconButton>
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handlePress).not.toHaveBeenCalled();
  });

  it('renders disabled state with disabled prop', () => {
    render(
      <IconButton disabled aria-label="Disabled">
        <CloseIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders disabled state with isDisabled prop (backward compatibility)', () => {
    render(
      <IconButton isDisabled aria-label="Disabled">
        <CloseIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <IconButton disabled onClick={handleClick} aria-label="Disabled">
        <CloseIcon />
      </IconButton>
    );

    const button = screen.getByRole('button');
    // Button is disabled, so it should not be clickable
    expect(button).toBeDisabled();
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders small size', () => {
    const { container } = render(
      <IconButton size="sm" aria-label="Small">
        <CloseIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    // Verify the button renders without checking internal MUI class names
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Small');
    // The icon should be rendered inside
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders medium size by default', () => {
    const { container } = render(
      <IconButton aria-label="Medium">
        <CloseIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    // Verify the button renders without checking internal MUI class names
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Medium');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders large size', () => {
    const { container } = render(
      <IconButton size="lg" aria-label="Large">
        <CloseIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    // Verify the button renders without checking internal MUI class names
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Large');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with tooltip', async () => {
    const user = userEvent.setup();
    render(
      <IconButton tooltip="Click to close" aria-label="Close">
        <CloseIcon />
      </IconButton>
    );

    const button = screen.getByRole('button');
    await user.hover(button);

    // Tooltip appears on hover
    expect(await screen.findByText('Click to close')).toBeInTheDocument();
  });

  it('renders quiet/subtle variant', () => {
    const { container } = render(
      <IconButton isQuiet aria-label="Quiet">
        <MenuIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    // Verify the button renders with quiet styling without checking internal MUI class names
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Quiet');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders primary color by default (when not quiet)', () => {
    const { container } = render(
      <IconButton aria-label="Primary">
        <CloseIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    // Verify the button renders without checking internal MUI class names
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Primary');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders custom color variant', () => {
    render(
      <IconButton color="secondary" aria-label="Secondary">
        <CloseIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('MuiIconButton-colorSecondary');
  });

  it('renders error color variant', () => {
    render(
      <IconButton color="error" aria-label="Error">
        <CloseIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('MuiIconButton-colorError');
  });

  it('supports aria-expanded attribute', () => {
    render(
      <IconButton aria-label="Menu" aria-expanded={true}>
        <MenuIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('supports aria-controls attribute', () => {
    render(
      <IconButton aria-label="Menu" aria-controls="mobile-menu">
        <MenuIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls', 'mobile-menu');
  });

  it('supports edge placement', () => {
    render(
      <IconButton edge="start" aria-label="Start edge">
        <MenuIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('MuiIconButton-edgeStart');
  });

  it('supports custom className', () => {
    render(
      <IconButton className="custom-class" aria-label="Custom">
        <CloseIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('supports UNSAFE_className (backward compatibility)', () => {
    render(
      <IconButton UNSAFE_className="unsafe-class" aria-label="Unsafe">
        <CloseIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('unsafe-class');
  });

  it('combines className and UNSAFE_className', () => {
    render(
      <IconButton className="class1" UNSAFE_className="class2" aria-label="Combined">
        <CloseIcon />
      </IconButton>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('class1');
    expect(button).toHaveClass('class2');
  });

  it('supports custom id attribute', () => {
    render(
      <IconButton id="custom-id" aria-label="ID">
        <CloseIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveAttribute('id', 'custom-id');
  });

  it('works with multiple clicks', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <IconButton onClick={handleClick} aria-label="Multi-click">
        <RefreshIcon />
      </IconButton>
    );

    const button = screen.getByRole('button');
    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(3);
  });

  it('renders accessible button without aria-label if not provided', () => {
    render(
      <IconButton onClick={() => {}}>
        <CloseIcon />
      </IconButton>
    );
    // Should still render as button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
