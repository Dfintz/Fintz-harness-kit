import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

export const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'The size of the modal',
    },
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
  },
};

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function DefaultModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Default Modal">
          <p>This is the modal content.</p>
        </Modal>
      </>
    );
  },
};

export const Small: Story = {
  render: function SmallModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Small Modal</Button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Small Modal" size="sm">
          <p>This is a small modal dialog.</p>
        </Modal>
      </>
    );
  },
};

export const Large: Story = {
  render: function LargeModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Large Modal</Button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Large Modal" size="lg">
          <p>This is a large modal with more content space.</p>
          <p>You can add more complex layouts here.</p>
        </Modal>
      </>
    );
  },
};

export const WithActions: Story = {
  render: function ModalWithActions() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal with Actions</Button>
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Confirm Action"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Confirm
              </Button>
            </>
          }
        >
          <p>Are you sure you want to proceed with this action?</p>
        </Modal>
      </>
    );
  },
};

export const DeleteConfirmation: Story = {
  name: 'Delete Confirmation',
  render: function DeleteModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete Fleet
        </Button>
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Delete Fleet"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                Delete
              </Button>
            </>
          }
        >
          <p>Are you sure you want to delete this fleet? This action cannot be undone.</p>
          <p style={{ fontWeight: 'bold', marginTop: '1rem' }}>Fleet: Alpha Squadron</p>
        </Modal>
      </>
    );
  },
};

export const FormModal: Story = {
  name: 'Form Modal',
  render: function FormModalExample() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Create New Fleet</Button>
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Create New Fleet"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Create Fleet
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input label="Fleet Name" placeholder="Enter fleet name" fullWidth />
            <Input label="Description" placeholder="Enter description" fullWidth />
            <Input label="Max Ships" type="number" placeholder="10" fullWidth />
          </div>
        </Modal>
      </>
    );
  },
};

export const NonClosable: Story = {
  render: function NonClosableModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Non-Closable Modal</Button>
        <Modal
          isOpen={open}
          onClose={() => {}}
          title="Processing..."
          size="sm"
          showCloseButton={false}
        >
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p>Please wait while we process your request...</p>
            <div style={{ marginTop: '1rem' }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Force Close (Demo Only)
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};
