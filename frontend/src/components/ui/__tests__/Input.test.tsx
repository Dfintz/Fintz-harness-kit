import React from 'react';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/Input';

describe('Input Component', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('renders with value', () => {
    render(<Input value="test@example.com" onChange={() => {}} />);
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('calls onChange when typing', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    expect(handleChange).toHaveBeenCalled();
  });

  it('renders disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders required state', () => {
    render(<Input label="Name" required />);
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('renders error state', () => {
    render(<Input isInvalid errorMessage="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders helper text', () => {
    render(<Input helperText="Enter your email address" />);
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
  });

  it('renders multiline as textarea', () => {
    render(<Input multiline rows={4} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('renders with start adornment', () => {
    render(<Input startAdornment={<span>@</span>} />);
    expect(screen.getByText('@')).toBeInTheDocument();
  });

  it('renders with end adornment', () => {
    render(<Input endAdornment={<span>.com</span>} />);
    expect(screen.getByText('.com')).toBeInTheDocument();
  });

  it('renders small size', () => {
    render(<Input size="sm" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders large size', () => {
    render(<Input size="lg" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders different types', () => {
    render(<Input type="email" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('renders as read-only', () => {
    render(<Input readOnly value="Read only" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('readonly');
  });

  it('auto focuses when autoFocus is true', () => {
    render(<Input autoFocus />);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});
