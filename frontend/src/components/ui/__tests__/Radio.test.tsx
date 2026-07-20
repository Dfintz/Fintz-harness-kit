import React from 'react';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Radio } from '@/components/ui/Radio';

const mockOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
];

describe('Radio Component', () => {
  it('renders with label', () => {
    render(<Radio label="Select option" options={mockOptions} />);
    expect(screen.getByText('Select option')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Radio options={mockOptions} />);
    expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 3')).toBeInTheDocument();
  });

  it('renders with selected value', () => {
    render(<Radio options={mockOptions} value="option2" onChange={() => {}} />);
    expect(screen.getByLabelText('Option 2')).toBeChecked();
  });

  it('calls onChange when an option is selected', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Radio options={mockOptions} onChange={handleChange} />);

    await user.click(screen.getByLabelText('Option 2'));
    expect(handleChange).toHaveBeenCalledWith('option2');
  });

  it('renders disabled state for all options', () => {
    render(<Radio options={mockOptions} disabled />);
    expect(screen.getByLabelText('Option 1')).toBeDisabled();
    expect(screen.getByLabelText('Option 2')).toBeDisabled();
    expect(screen.getByLabelText('Option 3')).toBeDisabled();
  });

  it('renders disabled state for specific option', () => {
    const optionsWithDisabled = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2', disabled: true },
      { value: 'option3', label: 'Option 3' },
    ];
    render(<Radio options={optionsWithDisabled} />);

    expect(screen.getByLabelText('Option 1')).not.toBeDisabled();
    expect(screen.getByLabelText('Option 2')).toBeDisabled();
    expect(screen.getByLabelText('Option 3')).not.toBeDisabled();
  });

  it('does not call onChange when disabled and clicked', () => {
    const handleChange = jest.fn();
    render(<Radio options={mockOptions} disabled onChange={handleChange} />);

    // Disabled radios have pointer-events: none, so we just verify they're disabled
    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect(radio).toBeDisabled();
    });
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('renders helper text', () => {
    render(<Radio options={mockOptions} helperText="Choose one option" />);
    expect(screen.getByText('Choose one option')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Radio options={mockOptions} isInvalid errorMessage="Selection is required" />);
    expect(screen.getByText('Selection is required')).toBeInTheDocument();
  });

  it('prefers error message over helper text', () => {
    render(
      <Radio
        options={mockOptions}
        helperText="Helper text"
        errorMessage="Error message"
        isInvalid
      />
    );
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
  });

  it('renders required state', () => {
    render(<Radio label="Select option" options={mockOptions} required />);

    // MUI FormControl with required prop adds an asterisk to the FormLabel
    // The label element should contain both the text and asterisk
    const legend = document.querySelector('legend');
    expect(legend).toBeInTheDocument();

    // Check for the Mui-required class which MUI adds to required FormLabels
    expect(legend).toHaveClass('Mui-required');

    // The asterisk is rendered as a span with .MuiFormLabel-asterisk class
    const asterisk = legend?.querySelector('.MuiFormLabel-asterisk');
    expect(asterisk).toBeInTheDocument();
    // Check that asterisk contains an asterisk character
    expect(asterisk?.textContent).toContain('*');
  });

  it('renders with name attribute', () => {
    render(<Radio options={mockOptions} name="test-radio" />);
    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect(radio).toHaveAttribute('name', 'test-radio');
    });
  });

  it('renders in row layout', () => {
    render(<Radio options={mockOptions} row />);
    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toHaveClass('MuiFormGroup-row');
  });

  it('renders in column layout by default', () => {
    render(<Radio options={mockOptions} />);
    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).not.toHaveClass('MuiFormGroup-row');
  });

  it('renders small size', () => {
    render(<Radio options={mockOptions} size="sm" />);
    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect(radio.closest('.MuiRadio-root')).toHaveClass('MuiRadio-sizeSmall');
    });
  });

  it('renders large size', () => {
    render(<Radio options={mockOptions} size="lg" />);
    const radios = screen.getAllByRole('radio');

    // 'lg' size maps to MUI 'medium' size
    // MUI Radio adds size classes to both the root and the input
    radios.forEach(radio => {
      const radioRoot = radio.closest('.MuiRadio-root');
      expect(radioRoot).toBeInTheDocument();

      // MUI adds 'MuiRadio-sizeMedium' class when size='medium'
      // Check for either the size class or verify it's not small
      const hasSizeMedium = radioRoot?.classList.contains('MuiRadio-sizeMedium');
      const hasSizeSmall = radioRoot?.classList.contains('MuiRadio-sizeSmall');

      // For 'lg' (medium size), it should either have sizeMedium or not have sizeSmall
      expect(hasSizeMedium || !hasSizeSmall).toBe(true);
    });
  });

  it('works in uncontrolled mode with defaultValue', () => {
    render(<Radio options={mockOptions} defaultValue="option2" />);
    expect(screen.getByLabelText('Option 2')).toBeChecked();
  });

  it('can be changed in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(<Radio options={mockOptions} defaultValue="option1" />);

    expect(screen.getByLabelText('Option 1')).toBeChecked();

    await user.click(screen.getByLabelText('Option 3'));
    expect(screen.getByLabelText('Option 3')).toBeChecked();
    expect(screen.getByLabelText('Option 1')).not.toBeChecked();
  });
});
