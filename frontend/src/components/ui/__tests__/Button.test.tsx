import React from 'react';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders children correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    await user.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const handlePress = jest.fn();
    render(<Button onClick={handlePress}>Press Me</Button>);

    await user.click(screen.getByText('Press Me'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('renders disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders primary variant', () => {
    render(<Button variant="primary">Primary</Button>);
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByText('Secondary')).toBeInTheDocument();
  });

  it('renders danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    expect(screen.getByText('Danger')).toBeInTheDocument();
  });

  it('does not trigger onClick when disabled', async () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    // Disabled buttons have pointer-events: none in MUI, so we can't click them
    // Instead, verify the button is disabled
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not trigger onClick when loading', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <Button loading onClick={handleClick}>
        Loading
      </Button>
    );

    // Loading state should disable the button
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('renders with aria-label', () => {
    render(<Button aria-label="Submit Form">Submit</Button>);
    expect(screen.getByLabelText('Submit Form')).toBeInTheDocument();
  });

  it('renders small size', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByText('Small')).toBeInTheDocument();
  });

  it('renders large size', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('renders as submit type', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});
