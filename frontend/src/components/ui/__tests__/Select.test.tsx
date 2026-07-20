import React from 'react';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Select } from '@/components/ui/Select';

const mockOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
];

describe('Select Component', () => {
  it('renders with label', () => {
    render(<Select label="Status" options={mockOptions} />);
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('renders all options', async () => {
    const user = userEvent.setup();
    render(<Select label="Status" options={mockOptions} />);

    // Click to open the dropdown
    const select = screen.getByLabelText('Status');
    await user.click(select);

    // Check if all options are rendered
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('calls onChange when an option is selected', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Select label="Status" options={mockOptions} onChange={handleChange} />);

    const select = screen.getByLabelText('Status');
    await user.click(select);
    await user.click(screen.getByText('Option 2'));

    expect(handleChange).toHaveBeenCalledWith('option2');
  });

  it('calls onSelectionChange when an option is selected', async () => {
    const user = userEvent.setup();
    const handleSelectionChange = jest.fn();
    render(
      <Select label="Status" options={mockOptions} onSelectionChange={handleSelectionChange} />
    );

    const select = screen.getByLabelText('Status');
    await user.click(select);
    await user.click(screen.getByText('Option 1'));

    expect(handleSelectionChange).toHaveBeenCalled();
  });

  it('renders with placeholder', async () => {
    const user = userEvent.setup();
    render(<Select label="Status" placeholder="Select an option" options={mockOptions} />);

    const select = screen.getByLabelText('Status');
    await user.click(select);

    // When opened, the placeholder should be visible in the menu
    expect(screen.getAllByText('Select an option').length).toBeGreaterThan(0);
  });

  it('renders disabled state', () => {
    render(<Select label="Status" options={mockOptions} disabled />);
    const select = screen.getByLabelText('Status');
    // MUI renders disabled selects with aria-disabled
    expect(select.closest('.MuiInputBase-root')).toHaveClass('Mui-disabled');
  });

  it('renders required state', () => {
    render(<Select label="Status" options={mockOptions} required />);
    // Check for asterisk in label which indicates required
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders error state', async () => {
    const user = userEvent.setup();
    render(
      <Select
        label="Status"
        options={mockOptions}
        isInvalid
        errorMessage="This field is required"
      />
    );

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders helper text', () => {
    render(<Select label="Status" options={mockOptions} helperText="Choose your status" />);
    expect(screen.getByText('Choose your status')).toBeInTheDocument();
  });

  it('renders with default value', () => {
    render(<Select label="Status" options={mockOptions} defaultValue="option2" />);
    // MUI Select stores the value in a hidden input
    const hiddenInput = document.querySelector('input[aria-hidden="true"]');
    expect(hiddenInput).toHaveValue('option2');
  });

  it('renders with controlled value', () => {
    render(<Select label="Status" options={mockOptions} value="option3" onChange={() => {}} />);
    // MUI Select stores the value in a hidden input
    const hiddenInput = document.querySelector('input[aria-hidden="true"]');
    expect(hiddenInput).toHaveValue('option3');
  });

  it('handles numeric values', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    const numericOptions = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
      { value: 3, label: 'Three' },
    ];

    render(<Select label="Count" options={numericOptions} onChange={handleChange} />);

    const select = screen.getByLabelText('Count');
    await user.click(select);
    await user.click(screen.getByText('Two'));

    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('disables specific options', async () => {
    const user = userEvent.setup();
    const optionsWithDisabled = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2', disabled: true },
      { value: 'option3', label: 'Option 3' },
    ];

    render(<Select label="Status" options={optionsWithDisabled} />);

    const select = screen.getByLabelText('Status');
    await user.click(select);

    const disabledOption = screen.getByText('Option 2').closest('li');
    expect(disabledOption).toHaveClass('Mui-disabled');
  });

  it('renders small size', () => {
    render(<Select label="Status" options={mockOptions} size="sm" />);
    const select = screen.getByLabelText('Status');
    expect(select.closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall');
  });

  it('renders full width by default', () => {
    render(<Select label="Status" options={mockOptions} />);
    const formControl = screen.getByLabelText('Status').closest('.MuiFormControl-root');
    expect(formControl).toHaveClass('MuiFormControl-fullWidth');
  });
});
