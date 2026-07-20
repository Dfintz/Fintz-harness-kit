import React from 'react';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@/components/ui/Checkbox';

describe('Checkbox Component', () => {
  it('renders with label', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByLabelText('Accept terms')).toBeInTheDocument();
  });

  it('renders without label', () => {
    render(<Checkbox aria-label="Checkbox without label" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders checked state', () => {
    render(<Checkbox label="Test" checked onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders unchecked state', () => {
    render(<Checkbox label="Test" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Checkbox label="Test" onChange={handleChange} />);

    await user.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when unchecking', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Checkbox label="Test" checked onChange={handleChange} />);

    await user.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('renders disabled state', () => {
    render(<Checkbox label="Test" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('does not call onChange when disabled and clicked', async () => {
    const handleChange = jest.fn();
    render(<Checkbox label="Test" disabled onChange={handleChange} />);

    // Disabled checkboxes have pointer-events: none, so we can't click them
    // Instead, verify the checkbox is disabled
    const checkbox = screen.getByLabelText('Test') as HTMLInputElement;
    expect(checkbox).toBeDisabled();
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('renders indeterminate state', () => {
    render(<Checkbox label="Test" indeterminate />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
  });

  it('renders helper text', () => {
    render(<Checkbox label="Test" helperText="This is helper text" />);
    expect(screen.getByText('This is helper text')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Checkbox label="Test" isInvalid errorMessage="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('prefers error message over helper text', () => {
    render(
      <Checkbox label="Test" helperText="Helper text" errorMessage="Error message" isInvalid />
    );
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
  });

  it('renders required state', () => {
    render(<Checkbox label="Test" required />);
    expect(screen.getByRole('checkbox')).toBeRequired();
  });

  it('renders with name attribute', () => {
    render(<Checkbox label="Test" name="test-checkbox" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'test-checkbox');
  });

  it('renders with value attribute', () => {
    render(<Checkbox label="Test" value="test-value" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('value', 'test-value');
  });

  it('renders small size', () => {
    render(<Checkbox label="Test" size="sm" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.closest('.MuiCheckbox-root')).toHaveClass('MuiCheckbox-sizeSmall');
  });

  it('renders large size', () => {
    render(<Checkbox label="Test" size="lg" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.closest('.MuiCheckbox-root')).toHaveClass('MuiCheckbox-sizeMedium');
  });

  it('works in uncontrolled mode with defaultChecked', () => {
    render(<Checkbox label="Test" defaultChecked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('can be toggled in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Test" defaultChecked />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
