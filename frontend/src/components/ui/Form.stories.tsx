/**
 * Form & FormField Stories - Storybook documentation for form components
 */

import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Form } from './Form';
import { FormField } from './FormField';
import { GlassButton } from './GlassButton';

export const meta: Meta<typeof Form> = {
  title: 'UI/Form',
  component: Form,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Form and FormField provide standardized form patterns for the SC Fleet Manager.

## Features
- Automatic \`preventDefault\` on submit
- Consistent spacing between fields
- Loading state with disabled fields
- Accessible form structure with fieldset
- Integration with useFormValidation hook

## Usage
\`\`\`tsx

<Form onSubmit={handleSubmit} loading={isSubmitting}>
  <FormField label="Username" name="username" required />
  <FormField label="Email" name="email" type="email" required />
  <Form.Actions>
    <GlassButton type="submit" variant="primary">Save</GlassButton>
  </Form.Actions>
</Form>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <Box sx={{ width: 400, p: 3, backgroundColor: '#0f1d35', borderRadius: 2 }}>
        <Story />
      </Box>
    ),
  ],
};

type Story = StoryObj<typeof Form>;

export const BasicForm: Story = {
  render: () => {
    const [formData, setFormData] = useState({ username: '', email: '' });

    const handleSubmit = () => {
      alert(`Submitted: ${JSON.stringify(formData)}`);
    };

    return (
      <Form onSubmit={handleSubmit} aria-label="Basic form example">
        <FormField
          name="username"
          label="Username"
          value={formData.username}
          onChange={(value: string) => setFormData({ ...formData, username: value })}
          placeholder="Enter your username"
          required
        />
        <FormField
          name="email"
          label="Email"
          type="email"
          value={formData.email}
          onChange={(value: string) => setFormData({ ...formData, email: value })}
          placeholder="you@example.com"
          required
        />
        <Form.Actions>
          <GlassButton type="submit" variant="primary">
            Submit
          </GlassButton>
          <GlassButton type="button" variant="secondary">
            Cancel
          </GlassButton>
        </Form.Actions>
      </Form>
    );
  },
};

export const WithValidationErrors: Story = {
  render: () => (
    <Form aria-label="Form with validation errors">
      <FormField
        name="username"
        label="Username"
        value="ab"
        error="Username must be at least 3 characters"
        required
      />
      <FormField
        name="email"
        label="Email"
        type="email"
        value="invalid-email"
        error="Please enter a valid email address"
        required
      />
      <Form.Actions>
        <GlassButton type="submit" variant="primary" disabled>
          Submit
        </GlassButton>
      </Form.Actions>
    </Form>
  ),
  parameters: {
    docs: {
      description: {
        story: 'FormField displays error messages below the input when validation fails.',
      },
    },
  },
};

export const LoadingState: Story = {
  render: () => (
    <Form loading aria-label="Loading form example">
      <FormField name="username" label="Username" value="johndoe" />
      <FormField name="email" label="Email" type="email" value="john@example.com" />
      <Form.Actions>
        <GlassButton type="submit" variant="primary">
          Saving...
        </GlassButton>
      </Form.Actions>
    </Form>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Setting `loading={true}` disables all form fields and prevents submission.',
      },
    },
  },
};

export const WithHelperText: Story = {
  render: () => (
    <Form aria-label="Form with helper text">
      <FormField
        name="password"
        label="Password"
        type="password"
        helperText="Must be at least 8 characters with a number and symbol"
      />
      <FormField
        name="bio"
        label="Bio"
        multiline
        rows={3}
        helperText="Tell us about yourself (max 500 characters)"
      />
      <Form.Actions>
        <GlassButton type="submit" variant="primary">
          Save Profile
        </GlassButton>
      </Form.Actions>
    </Form>
  ),
};

export const DifferentInputTypes: Story = {
  render: () => (
    <Form aria-label="Form with different input types">
      <FormField name="text" label="Text Input" type="text" placeholder="Regular text" />
      <FormField name="email" label="Email Input" type="email" placeholder="you@example.com" />
      <FormField name="password" label="Password Input" type="password" placeholder="••••••••" />
      <FormField name="number" label="Number Input" type="number" placeholder="123" />
      <FormField name="url" label="URL Input" type="url" placeholder="https://example.com" />
      <Form.Actions>
        <GlassButton type="submit" variant="primary">
          Submit
        </GlassButton>
      </Form.Actions>
    </Form>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'FormField supports various input types: text, email, password, number, tel, url, search.',
      },
    },
  },
};

export const TextareaField: Story = {
  render: () => (
    <Form aria-label="Form with textarea">
      <FormField
        name="description"
        label="Description"
        multiline
        rows={4}
        placeholder="Enter a detailed description..."
      />
      <Form.Actions>
        <GlassButton type="submit" variant="primary">
          Save
        </GlassButton>
      </Form.Actions>
    </Form>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Use `multiline` and `rows` props for textarea inputs.',
      },
    },
  },
};

export const FormFieldSizes: Story = {
  render: () => (
    <Form aria-label="Form field sizes">
      <FormField name="small" label="Small Input" size="sm" placeholder="Small size" />
      <FormField name="medium" label="Medium Input" size="md" placeholder="Medium size (default)" />
      <FormField name="large" label="Large Input" size="lg" placeholder="Large size" />
      <Form.Actions>
        <GlassButton type="submit" variant="primary">
          Submit
        </GlassButton>
      </Form.Actions>
    </Form>
  ),
};

export const DisabledFields: Story = {
  render: () => (
    <Form aria-label="Form with disabled fields">
      <FormField
        name="readonly"
        label="Read-only Field"
        value="This value cannot be changed"
        readOnly
      />
      <FormField name="disabled" label="Disabled Field" value="This field is disabled" disabled />
      <Form.Actions>
        <GlassButton type="submit" variant="primary">
          Submit
        </GlassButton>
      </Form.Actions>
    </Form>
  ),
};

export const CompactLoginForm: Story = {
  render: () => {
    const [loading, setLoading] = useState(false);

    const handleSubmit = () => {
      setLoading(true);
      setTimeout(() => setLoading(false), 2000);
    };

    return (
      <Form onSubmit={handleSubmit} loading={loading} aria-label="Login form">
        <FormField
          name="email"
          label="Email"
          type="email"
          placeholder="commander@fleet.org"
          required
        />
        <FormField
          name="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          required
        />
        <Form.Actions>
          <GlassButton type="submit" variant="primary" fullWidth>
            {loading ? 'Logging in...' : 'Log In'}
          </GlassButton>
        </Form.Actions>
      </Form>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'A practical login form example with loading state.',
      },
    },
  },
};
