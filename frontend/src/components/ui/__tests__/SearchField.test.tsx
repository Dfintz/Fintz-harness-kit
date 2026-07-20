import React from 'react';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { SearchField } from '@/components/ui/SearchField';

describe('SearchField Component', () => {
  it('renders with label', () => {
    render(<SearchField label="Search" />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    render(<SearchField placeholder="Search items..." />);
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
  });

  it('renders with value', () => {
    render(<SearchField value="test query" onChange={() => {}} />);
    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
  });

  it('calls onChange when typing', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<SearchField onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    expect(handleChange).toHaveBeenCalled();
  });

  it('renders search icon', () => {
    render(<SearchField />);
    // Search icon should be present
    const input = screen.getByRole('textbox');
    expect(input.parentElement?.querySelector('[data-testid="SearchIcon"]')).toBeInTheDocument();
  });

  it('shows clear button when value is present', () => {
    render(<SearchField value="test" onChange={() => {}} />);
    expect(screen.getByLabelText('clear search')).toBeInTheDocument();
  });

  it('does not show clear button when value is empty', () => {
    render(<SearchField value="" onChange={() => {}} />);
    expect(screen.queryByLabelText('clear search')).not.toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', async () => {
    const user = userEvent.setup();
    const handleClear = jest.fn();
    render(<SearchField value="test" onChange={() => {}} onClear={handleClear} />);

    await user.click(screen.getByLabelText('clear search'));
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('calls onChange with empty string when clear button is clicked without onClear', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<SearchField value="test" onChange={handleChange} />);

    await user.click(screen.getByLabelText('clear search'));
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('does not show clear button when showClearButton is false', () => {
    render(<SearchField value="test" onChange={() => {}} showClearButton={false} />);
    expect(screen.queryByLabelText('clear search')).not.toBeInTheDocument();
  });

  it('renders disabled state', () => {
    render(<SearchField disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders with custom width', () => {
    render(<SearchField width="500px" />);
    const input = screen.getByRole('textbox');
    const textField = input.closest('.MuiTextField-root');
    expect(textField).toHaveStyle({ width: '500px' });
  });

  it('renders small size', () => {
    render(<SearchField size="sm" />);
    const input = screen.getByRole('textbox');
    expect(input.closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall');
  });

  it('renders large size', () => {
    render(<SearchField size="lg" />);
    const input = screen.getByRole('textbox');
    // Medium size in MUI doesn't add a size class (it's the default)
    expect(input.closest('.MuiInputBase-root')).not.toHaveClass('MuiInputBase-sizeSmall');
  });

  it('auto focuses when autoFocus is true', () => {
    render(<SearchField autoFocus />);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('calls onBlur when field loses focus', async () => {
    const user = userEvent.setup();
    const handleBlur = jest.fn();
    render(<SearchField onBlur={handleBlur} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.tab();

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('calls onFocus when field gains focus', async () => {
    const user = userEvent.setup();
    const handleFocus = jest.fn();
    render(<SearchField onFocus={handleFocus} />);

    await user.click(screen.getByRole('textbox'));

    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('renders full width', () => {
    render(<SearchField fullWidth />);
    const input = screen.getByRole('textbox');
    const textField = input.closest('.MuiTextField-root');
    expect(textField).toHaveStyle({ width: '100%' });
  });
});
