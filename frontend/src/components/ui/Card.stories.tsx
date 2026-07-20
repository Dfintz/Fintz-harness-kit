import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardContent, CardActions } from './Card';
import { Button } from './Button';

export const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['elevated', 'outlined', 'filled'],
      description: 'The visual style variant of the card',
    },
    interactive: {
      control: 'boolean',
      description: 'Whether the card is interactive (clickable)',
    },
  },
};

type Story = StoryObj<typeof meta>;

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: (
      <>
        <CardHeader title="Elevated Card" subtitle="This is a subtitle" />
        <CardContent>
          <p>This is the card content. It can contain any React elements.</p>
        </CardContent>
      </>
    ),
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: (
      <>
        <CardHeader title="Outlined Card" subtitle="With a border" />
        <CardContent>
          <p>This card has an outline instead of elevation.</p>
        </CardContent>
      </>
    ),
  },
};

export const Filled: Story = {
  args: {
    variant: 'filled',
    children: (
      <>
        <CardHeader title="Filled Card" />
        <CardContent>
          <p>This card has a filled background.</p>
        </CardContent>
      </>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: 'elevated',
    interactive: true,
    onClick: () => alert('Card clicked!'),
    children: (
      <>
        <CardHeader title="Interactive Card" subtitle="Click me!" />
        <CardContent>
          <p>This card is clickable and shows hover effects.</p>
        </CardContent>
      </>
    ),
  },
};

export const WithActions: Story = {
  args: {
    variant: 'elevated',
    children: (
      <>
        <CardHeader title="Card with Actions" subtitle="Includes buttons" />
        <CardContent>
          <p>This card demonstrates the CardActions component.</p>
        </CardContent>
        <CardActions>
          <Button variant="ghost" size="sm">Cancel</Button>
          <Button variant="primary" size="sm">Save</Button>
        </CardActions>
      </>
    ),
  },
};

export const FleetCard: Story = {
  name: 'Fleet Card Example',
  args: {
    variant: 'elevated',
    children: (
      <>
        <CardHeader 
          title="Alpha Squadron" 
          subtitle="Combat Fleet • 12 Ships"
          action={<Button variant="ghost" size="sm">Edit</Button>}
        />
        <CardContent>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span>Total Value:</span>
            <strong>$1,250,000 UEC</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Commander:</span>
            <strong>StarCitizen42</strong>
          </div>
        </CardContent>
        <CardActions>
          <Button variant="outline" size="sm">View Details</Button>
          <Button variant="primary" size="sm">Manage Ships</Button>
        </CardActions>
      </>
    ),
  },
};
