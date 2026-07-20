/**
 * PermissionErrorAlert Stories
 *
 * Showcases the PermissionErrorAlert component in different scenarios:
 * - Permission denied with full context
 * - Permission denied without full context
 * - With help option
 * - Different resource/action combinations
 */

import { ApiClientError } from '@/services/apiClient';
import { StoryObj } from '@storybook/react';
import {
  PermissionErrorAlert,
  extractPermissionContext,
  formatPermissionKey,
} from './PermissionErrorAlert';

const meta = {
  title: 'Components/Alerts/PermissionErrorAlert',
  component: PermissionErrorAlert,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Helper to create mock ApiClientError with permission context
 */
function createPermissionError(
  resource: string,
  action: string,
  message: string = 'Access denied'
): ApiClientError {
  return new ApiClientError(message, 'FORBIDDEN', 403, 'req-123', {
    permission: { resource, action, scope: 'org-123' },
    requiredPermission: `${resource}:${action}`,
  } as Record<string, unknown>);
}

/**
 * Basic permission denied for fleet editing
 */
export const FleetEditDenied: Story = {
  args: {
    error: createPermissionError('fleet', 'edit', 'You do not have permission to edit fleets'),
    onContactAdmin: () => alert('Contact admin action triggered'),
    contactEmail: 'org-admin@example.com',
  },
};

/**
 * Permission denied for ship deletion
 */
export const ShipDeleteDenied: Story = {
  args: {
    error: createPermissionError(
      'ship',
      'delete',
      'You do not have permission to delete ships from this fleet'
    ),
    onContactAdmin: () => alert('Request sent to admin'),
    contactEmail: 'fleet-commander@example.com',
  },
};

/**
 * Permission denied for organization management
 */
export const OrgManageDenied: Story = {
  args: {
    error: createPermissionError('organization', 'manage', 'Administration access required'),
    showHelpOption: true,
    onContactAdmin: () => alert('Escalating to super admin'),
    title: 'Admin Access Required',
    message: 'Only organization administrators can perform this action.',
    contactEmail: 'super-admin@example.com',
  },
};

/**
 * Permission denied without full context (generic error)
 */
export const GenericForbidden: Story = {
  args: {
    error: new ApiClientError('Access denied', 'FORBIDDEN', 403, 'req-456'),
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
  },
};

/**
 * Permission denied with custom title and detailed message
 */
export const CustomMessaging: Story = {
  args: {
    error: createPermissionError(
      'activity',
      'create',
      'You cannot create activities with your current role'
    ),
    title: 'Activity Creation Restricted',
    message:
      'Your current role does not allow creating new activities. This is typically restricted to fleet commanders and above.',
    showHelpOption: true,
    onContactAdmin: () => alert('Requesting role upgrade'),
    contactEmail: 'leadership@fleet.com',
  },
};

/**
 * Permission denied for recruitment access
 */
export const RecruitmentAccessDenied: Story = {
  args: {
    error: createPermissionError(
      'recruitment',
      'approve',
      'You do not have permission to approve recruitment applications'
    ),
    onContactAdmin: () => alert('Requesting recruitment officer role'),
    showHelpOption: true,
    contactEmail: 'hr@fleet.com',
  },
};

/**
 * With dismiss callback
 */
export const WithDismiss: Story = {
  args: {
    error: createPermissionError(
      'fleet',
      'view',
      'You cannot view this fleet due to insufficient permissions'
    ),
    onDismiss: () => alert('Alert dismissed'),
    onContactAdmin: () => alert('Contact admin'),
    contactEmail: 'admin@example.com',
  },
};

/**
 * Without help option (minimal)
 */
export const MinimalLayout: Story = {
  args: {
    error: createPermissionError('asset', 'export'),
    showHelpOption: false,
    onContactAdmin: () => alert('Request sent'),
  },
};

/**
 * Multiple action buttons demonstration
 */
export const FullFeatures: Story = {
  args: {
    error: createPermissionError(
      'briefing',
      'edit',
      'You lack the required permissions to edit this briefing'
    ),
    title: 'Permission Denied',
    showHelpOption: true,
    onContactAdmin: () => alert('Permission request submitted'),
    onDismiss: () => alert('Dismissed'),
    contactEmail: 'permissions@fleet.command',
  },
};

/**
 * Story demonstrating helper functions
 */
export const HelperFunctions: Story = {
  args: {
    error: createPermissionError('ship', 'manage'),
  },
  render: () => {
    const error = createPermissionError('ship', 'manage');
    const context = extractPermissionContext(error);

    return (
      <div>
        <h3>Helper Functions Demo</h3>
        <p>
          <strong>extractPermissionContext:</strong> {context ? JSON.stringify(context) : 'null'}
        </p>
        <p>
          <strong>formatPermissionKey:</strong>{' '}
          {context ? formatPermissionKey(context.resource, context.action) : 'N/A'}
        </p>
        <hr />
        <PermissionErrorAlert
          error={error}
          onContactAdmin={() => alert('Request submitted')}
          contactEmail="admin@example.com"
        />
      </div>
    );
  },
};
