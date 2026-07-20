import type { Meta, StoryObj } from '@storybook/react';
import { ToastProvider, useToast } from './Toast';
import { Button } from './Button';

export const meta: Meta<typeof ToastProvider> = {
  title: 'UI/Toast',
  component: ToastProvider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

type Story = StoryObj<typeof meta>;

// Demo component to test toast functionality
function ToastDemo() {
  const { success, error, warning, info, toast } = useToast();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
      <Button
        variant="primary"
        onClick={() => success('Operation completed successfully!')}
      >
        Show Success
      </Button>
      
      <Button
        variant="danger"
        onClick={() => error('An error occurred. Please try again.')}
      >
        Show Error
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => warning('This action cannot be undone.')}
      >
        Show Warning
      </Button>
      
      <Button
        variant="ghost"
        onClick={() => info('New features are available in the latest update.')}
      >
        Show Info
      </Button>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemo />
    </ToastProvider>
  ),
};

function ToastWithTitleDemo() {
  const { toast } = useToast();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
      <Button
        onClick={() => toast({
          variant: 'success',
          title: 'Success',
          message: 'Your fleet has been saved successfully.',
        })}
      >
        Success with Title
      </Button>
      
      <Button
        variant="danger"
        onClick={() => toast({
          variant: 'error',
          title: 'Error',
          message: 'Failed to connect to the server.',
        })}
      >
        Error with Title
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => toast({
          variant: 'warning',
          title: 'Warning',
          message: 'Your session will expire in 5 minutes.',
        })}
      >
        Warning with Title
      </Button>
    </div>
  );
}

export const WithTitles: Story = {
  name: 'With Titles',
  render: () => (
    <ToastProvider>
      <ToastWithTitleDemo />
    </ToastProvider>
  ),
};

function ToastDurationDemo() {
  const { toast } = useToast();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
      <Button
        onClick={() => toast({
          variant: 'info',
          message: 'This toast will disappear in 2 seconds.',
          duration: 2000,
        })}
      >
        2 Second Toast
      </Button>
      
      <Button
        onClick={() => toast({
          variant: 'info',
          message: 'This toast will stay for 10 seconds.',
          duration: 10000,
        })}
      >
        10 Second Toast
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => toast({
          variant: 'warning',
          message: 'This toast will stay until you close it.',
          duration: 0,
          closable: true,
        })}
      >
        Persistent Toast
      </Button>
    </div>
  );
}

export const WithDuration: Story = {
  name: 'Custom Duration',
  render: () => (
    <ToastProvider>
      <ToastDurationDemo />
    </ToastProvider>
  ),
};

function ToastWithActionDemo() {
  const { toast } = useToast();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
      <Button
        onClick={() => toast({
          variant: 'info',
          title: 'Update Available',
          message: 'A new version of the app is available.',
          duration: 0,
          action: (
            <Button
              size="sm"
              variant="outline"
              onClick={() => console.log('Update clicked')}
            >
              Update Now
            </Button>
          ),
        })}
      >
        Toast with Action
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => toast({
          variant: 'success',
          title: 'Fleet Saved',
          message: 'Your changes have been saved.',
          action: (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => console.log('View clicked')}
            >
              View Fleet
            </Button>
          ),
        })}
      >
        Success with Action
      </Button>
    </div>
  );
}

export const WithAction: Story = {
  name: 'With Action Button',
  render: () => (
    <ToastProvider>
      <ToastWithActionDemo />
    </ToastProvider>
  ),
};

function ToastStackDemo() {
  const { success, error, warning, info } = useToast();

  const showMultipleToasts = () => {
    success('Ship added to fleet');
    setTimeout(() => info('Processing changes...'), 500);
    setTimeout(() => warning('Low fuel detected'), 1000);
    setTimeout(() => error('Connection lost'), 1500);
  };

  return (
    <Button onClick={showMultipleToasts}>
      Show Multiple Toasts
    </Button>
  );
}

export const MultipleToasts: Story = {
  name: 'Multiple Toast Stack',
  render: () => (
    <ToastProvider>
      <ToastStackDemo />
    </ToastProvider>
  ),
};

function FleetOperationDemo() {
  const { success, error, info, toast } = useToast();

  const handleSaveFleet = () => {
    info('Saving fleet configuration...');
    setTimeout(() => {
      success('Fleet configuration saved successfully!');
    }, 2000);
  };

  const handleDeleteShip = () => {
    toast({
      variant: 'error',
      title: 'Ship Deleted',
      message: 'The Carrack has been removed from your fleet.',
      duration: 0,
      action: (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => console.log('Undo')}
        >
          Undo
        </Button>
      ),
    });
  };

  const handleImportFleet = () => {
    info('Importing fleet data...');
    setTimeout(() => {
      success('Successfully imported 12 ships to your fleet.');
    }, 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
      <Button variant="primary" onClick={handleSaveFleet}>
        Save Fleet
      </Button>
      <Button variant="danger" onClick={handleDeleteShip}>
        Delete Ship
      </Button>
      <Button variant="secondary" onClick={handleImportFleet}>
        Import Fleet
      </Button>
    </div>
  );
}

export const FleetOperations: Story = {
  name: 'Fleet Operations Example',
  render: () => (
    <ToastProvider>
      <FleetOperationDemo />
    </ToastProvider>
  ),
};

function ToastVariantsDemo() {
  const { toast } = useToast();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
      <Button
        onClick={() => toast({
          variant: 'success',
          title: 'Success',
          message: 'This is a success message with all the bells and whistles.',
        })}
        variant="primary"
      >
        Success
      </Button>
      
      <Button
        onClick={() => toast({
          variant: 'error',
          title: 'Error',
          message: 'This is an error message that requires attention.',
          duration: 0,
        })}
        variant="danger"
      >
        Error
      </Button>
      
      <Button
        onClick={() => toast({
          variant: 'warning',
          title: 'Warning',
          message: 'This is a warning about something important.',
        })}
        variant="secondary"
      >
        Warning
      </Button>
      
      <Button
        onClick={() => toast({
          variant: 'info',
          title: 'Information',
          message: 'This is an informational message for your awareness.',
        })}
        variant="ghost"
      >
        Info
      </Button>
    </div>
  );
}

export const AllVariants: Story = {
  name: 'All Toast Variants',
  render: () => (
    <ToastProvider>
      <ToastVariantsDemo />
    </ToastProvider>
  ),
};
