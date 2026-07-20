import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MentionInput } from '@/components/MentionInput';

const theme = createTheme();

describe('MentionInput Component', () => {
  const mockOnChange = jest.fn();

  const renderWithThemeProvider = (
    props: Partial<React.ComponentProps<typeof MentionInput>> = {}
  ) => {
    const defaultProps = {
      value: '',
      onChange: mockOnChange,
      ...props,
    };

    return render(
      <ThemeProvider theme={theme}>
        <MentionInput {...defaultProps} />
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders input field', () => {
    renderWithThemeProvider();

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays placeholder text', () => {
    renderWithThemeProvider({ placeholder: 'Enter message here' });

    expect(screen.getByPlaceholderText('Enter message here')).toBeInTheDocument();
  });

  it('displays default placeholder when not provided', () => {
    renderWithThemeProvider();

    expect(screen.getByPlaceholderText('Type your message')).toBeInTheDocument();
  });

  it('displays label when provided', () => {
    renderWithThemeProvider({ label: 'Message' });

    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('displays current value', () => {
    renderWithThemeProvider({ value: 'Hello world' });

    expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello');

    // onChange is called for each character typed
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('is disabled when isDisabled is true', () => {
    renderWithThemeProvider({ isDisabled: true });

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('is enabled by default', () => {
    renderWithThemeProvider();

    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  it('allows text input when enabled', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider();

    const input = screen.getByRole('textbox');
    await user.type(input, 'Test message');

    // onChange is called for each character, verify it was called
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange.mock.calls.length).toBe(12); // 'Test message' is 12 characters
  });

  it('does not allow input when disabled', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider({ isDisabled: true });

    const input = screen.getByRole('textbox');
    await user.type(input, 'Test');

    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
