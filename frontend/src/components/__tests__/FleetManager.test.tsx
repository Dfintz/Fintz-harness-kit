/**
 * FleetManager Component Tests
 *
 * Tests for the fleet-first management view: two-panel layout,
 * fleet list, fleet detail, and import/export dialog.
 *
 * Rewritten for fleet rework — replaces old ship CRUD tests.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FleetManager } from '@/components/FleetManager';

// Mock child components to isolate FleetManager rendering
jest.mock('@/components/fleet/FleetListPanel', () => ({
  FleetListPanel: ({
    selectedFleetId,
    onSelectFleet,
  }: {
    selectedFleetId: string | null;
    onSelectFleet: (id: string | null) => void;
  }) => (
    <div data-testid="fleet-list-panel">
      <span data-testid="selected-fleet">{selectedFleetId ?? 'none'}</span>
      <button onClick={() => onSelectFleet('fleet-1')}>Select Fleet 1</button>
      <button onClick={() => onSelectFleet(null)}>Clear Selection</button>
    </div>
  ),
}));

jest.mock('@/components/fleet/FleetDetailPanel', () => ({
  FleetDetailPanel: ({ fleetId }: { fleetId: string }) => (
    <div data-testid="fleet-detail-panel">Fleet: {fleetId}</div>
  ),
}));

jest.mock('@/components/fleet/FleetMoveDialog', () => ({
  FleetMoveDialog: () => null,
}));

jest.mock('@/components/FleetViewImportExport', () => ({
  FleetBoxImportExport: () => <div data-testid="fleet-import-export">Import/Export Content</div>,
}));

jest.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/hooks/queries/queryKeys', () => ({
  fleetKeys: {
    all: ['fleets'],
    lists: () => ['fleets', 'list'],
    list: (filters?: Record<string, unknown>) => ['fleets', 'list', filters],
    details: () => ['fleets', 'detail'],
    detail: (id: string) => ['fleets', 'detail', id],
    ships: (id: string) => ['fleets', 'detail', id, 'ships'],
    members: (id: string) => ['fleets', 'detail', id, 'members'],
  },
}));

jest.mock('@/hooks/queries/useFleetQueries', () => ({
  useFleets: () => ({ data: { items: [] }, isLoading: false }),
  useFleetHealth: () => ({ data: null }),
  useFleetTree: () => ({ data: { tree: [] } }),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string; activeOrgId: string } }) => unknown) =>
    selector({ user: { id: 'user-1', activeOrgId: 'org-1' } }),
}));

describe('FleetManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the page header with fleet-first description', () => {
    render(<FleetManager />);

    expect(screen.getByText('Fleet Management')).toBeInTheDocument();
    expect(screen.getByText(/Create fleets, then add ships/)).toBeInTheDocument();
  });

  it('should render the FleetListPanel', () => {
    render(<FleetManager />);

    expect(screen.getByTestId('fleet-list-panel')).toBeInTheDocument();
  });

  it('should show empty state message when no fleets exist', () => {
    render(<FleetManager />);

    expect(screen.getByText('Create your first fleet to get started')).toBeInTheDocument();
    expect(screen.queryByTestId('fleet-detail-panel')).not.toBeInTheDocument();
  });

  it('should show FleetDetailPanel when a fleet is selected', async () => {
    const user = userEvent.setup();
    render(<FleetManager />);

    await user.click(screen.getByText('Select Fleet 1'));

    await waitFor(() => {
      expect(screen.getByTestId('fleet-detail-panel')).toBeInTheDocument();
      expect(screen.getByText('Fleet: fleet-1')).toBeInTheDocument();
    });
  });

  it('should hide FleetDetailPanel when selection is cleared', async () => {
    const user = userEvent.setup();
    render(<FleetManager />);

    await user.click(screen.getByText('Select Fleet 1'));
    await waitFor(() => {
      expect(screen.getByTestId('fleet-detail-panel')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear Selection'));
    await waitFor(() => {
      expect(screen.queryByTestId('fleet-detail-panel')).not.toBeInTheDocument();
      expect(screen.getByText('Create your first fleet to get started')).toBeInTheDocument();
    });
  });

  it('should render Import/Export button', () => {
    render(<FleetManager />);

    expect(screen.getByText('Import/Export')).toBeInTheDocument();
  });

  it('should open Import/Export dialog when clicked', async () => {
    const user = userEvent.setup();
    render(<FleetManager />);

    await user.click(screen.getByText('Import/Export'));

    await waitFor(() => {
      expect(screen.getByText('Fleet Import/Export')).toBeInTheDocument();
      expect(screen.getByTestId('fleet-import-export')).toBeInTheDocument();
    });
  });
});
