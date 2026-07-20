import * as lootHooks from '@/hooks/queries/useLootQueries';
import { LootDistribution } from '@/pages/LootDistribution';
import { useAuthStore } from '@/store/authStore';
import type {
  LootDistributionMethod,
  LootDistributionResult,
  LootPoolDetail,
  LootPoolStatus,
} from '@sc-fleet-manager/shared-types';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('@/hooks/queries/useLootQueries');

type MutationMock<TArgs = unknown, TResult = unknown> = {
  mutate: jest.Mock;
  mutateAsync: jest.Mock<Promise<TResult>, [TArgs]>;
  isPending: boolean;
  isError: boolean;
};

const createMutationMock = <TArgs = unknown, TResult = unknown>(): MutationMock<
  TArgs,
  TResult
> => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isPending: false,
  isError: false,
});

const buildPool = (
  status: LootPoolStatus,
  distributionMethod: LootDistributionMethod = 'need_greed'
): LootPoolDetail => ({
  id: 'pool-1',
  organizationId: 'org-1',
  name: 'Mercury Run',
  activityId: 'activity-1',
  status,
  distributionMethod,
  currency: 'aUEC',
  leaderId: 'leader-1',
  createdBy: 'creator-1',
  totalValue: 1200,
  metadata: { assistantUserIds: ['assistant-1'] },
  items: [
    {
      id: 'item-1',
      organizationId: 'org-1',
      lootPoolId: 'pool-1',
      name: 'Railgun',
      category: 'weapon',
      quantity: 1,
      unitValue: 1200,
      totalValue: 1200,
      status: 'available',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  claims: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const mockedLootHooks = lootHooks as jest.Mocked<typeof lootHooks>;

describe('LootDistribution page', () => {
  const addItemMutation = createMutationMock();
  const addItemsBulkMutation = createMutationMock();
  const cancelPoolMutation = createMutationMock();
  const claimMutation = createMutationMock();
  const createPoolMutation = createMutationMock();
  const distributeMutation = createMutationMock<string, LootDistributionResult>();
  const retryDistributionMutation = createMutationMock<string, LootDistributionResult>();
  const lockPoolMutation = createMutationMock();
  const removeItemMutation = createMutationMock();
  const scanPoolImageMutation = createMutationMock<{ poolId: string; file: File }>();
  const updatePoolMutation = createMutationMock<
    { poolId: string; data: { assistantUserIds: string[] } },
    LootPoolDetail
  >();
  const withdrawMutation = createMutationMock();

  const renderPage = (pool: LootPoolDetail): void => {
    mockedLootHooks.useLootPools.mockReturnValue({
      data: [pool],
      isLoading: false,
    } as unknown as ReturnType<typeof lootHooks.useLootPools>);

    mockedLootHooks.useLootPool.mockReturnValue({
      data: pool,
      isLoading: false,
    } as unknown as ReturnType<typeof lootHooks.useLootPool>);

    render(<LootDistribution />);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    useAuthStore.setState({
      user: {
        id: 'assistant-1',
        username: 'Assistant User',
        organizationId: 'org-1',
        activeOrgId: 'org-1',
      } as any,
      isAuthenticated: true,
    } as any);

    mockedLootHooks.useCreateLootPool.mockReturnValue(
      createPoolMutation as unknown as ReturnType<typeof lootHooks.useCreateLootPool>
    );
    mockedLootHooks.useUpdateLootPool.mockReturnValue(
      updatePoolMutation as unknown as ReturnType<typeof lootHooks.useUpdateLootPool>
    );
    mockedLootHooks.useLockLootPool.mockReturnValue(
      lockPoolMutation as unknown as ReturnType<typeof lootHooks.useLockLootPool>
    );
    mockedLootHooks.useCancelLootPool.mockReturnValue(
      cancelPoolMutation as unknown as ReturnType<typeof lootHooks.useCancelLootPool>
    );
    mockedLootHooks.useDistributeLootPool.mockReturnValue(
      distributeMutation as unknown as ReturnType<typeof lootHooks.useDistributeLootPool>
    );
    mockedLootHooks.useRetryLootDistribution.mockReturnValue(
      retryDistributionMutation as unknown as ReturnType<typeof lootHooks.useRetryLootDistribution>
    );
    mockedLootHooks.useAddLootItem.mockReturnValue(
      addItemMutation as unknown as ReturnType<typeof lootHooks.useAddLootItem>
    );
    mockedLootHooks.useAddLootItemsBulk.mockReturnValue(
      addItemsBulkMutation as unknown as ReturnType<typeof lootHooks.useAddLootItemsBulk>
    );
    mockedLootHooks.useRemoveLootItem.mockReturnValue(
      removeItemMutation as unknown as ReturnType<typeof lootHooks.useRemoveLootItem>
    );
    mockedLootHooks.useClaimLootItem.mockReturnValue(
      claimMutation as unknown as ReturnType<typeof lootHooks.useClaimLootItem>
    );
    mockedLootHooks.useWithdrawLootClaim.mockReturnValue(
      withdrawMutation as unknown as ReturnType<typeof lootHooks.useWithdrawLootClaim>
    );
    mockedLootHooks.useScanLootPoolImage.mockReturnValue(
      scanPoolImageMutation as unknown as ReturnType<typeof lootHooks.useScanLootPoolImage>
    );
  });

  it('shows manager controls and assistant manager editor for pool assistants', async () => {
    renderPage(buildPool('open'));

    await userEvent.click(screen.getByText('Mercury Run'));

    expect(screen.getByRole('button', { name: 'Scan screenshot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock & open claims' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assistant manager user IDs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save assistants' })).toBeInTheDocument();
  });

  it('saves assistant manager IDs via update mutation', async () => {
    renderPage(buildPool('open'));

    await userEvent.click(screen.getByText('Mercury Run'));

    const input = screen.getByLabelText('Assistant manager user IDs');
    await userEvent.clear(input);
    await userEvent.type(input, 'assistant-2, assistant-3, assistant-2');
    await userEvent.click(screen.getByRole('button', { name: 'Save assistants' }));

    await waitFor(() => {
      expect(updatePoolMutation.mutateAsync).toHaveBeenCalledWith({
        poolId: 'pool-1',
        data: { assistantUserIds: ['assistant-2', 'assistant-3'] },
      });
    });
  });

  it('uses the pool-scoped OCR mutation when scanning an inventory screenshot', async () => {
    const user = userEvent.setup();
    renderPage(buildPool('open'));

    await user.click(screen.getByText('Mercury Run'));
    await user.click(screen.getByRole('button', { name: 'Scan screenshot' }));

    const file = new File(['image-bytes'], 'inventory.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await user.click(screen.getByRole('button', { name: 'Scan' }));

    await waitFor(() => {
      expect(scanPoolImageMutation.mutateAsync).toHaveBeenCalledWith({
        poolId: 'pool-1',
        file,
      });
    });
  });

  it('shows partial-distribution warning and allows retry action for managers', async () => {
    const user = userEvent.setup();
    retryDistributionMutation.mutateAsync.mockResolvedValue({
      poolId: 'pool-1',
      distributionMethod: 'auec_bid',
      totalValue: 1200,
      currency: 'aUEC',
      awards: [],
      failures: [],
    });

    renderPage(buildPool('partially_distributed', 'auec_bid'));

    await user.click(screen.getByText('Mercury Run'));

    expect(screen.getByText(/This pool is partially distributed\./i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry distribution' }));

    await waitFor(() => {
      expect(retryDistributionMutation.mutateAsync).toHaveBeenCalledWith('pool-1');
    });
  });

  it('shows partial warning after a distribution run returns failures', async () => {
    const user = userEvent.setup();
    distributeMutation.mutateAsync.mockResolvedValue({
      poolId: 'pool-1',
      distributionMethod: 'auec_bid',
      totalValue: 1200,
      currency: 'aUEC',
      awards: [],
      failures: [
        {
          stage: 'settlement',
          reason: 'Treasury settlement failed',
          lootItemId: 'item-1',
          itemName: 'Railgun',
        },
      ],
    });

    renderPage(buildPool('locked', 'auec_bid'));

    await user.click(screen.getByText('Mercury Run'));
    await user.click(screen.getByRole('button', { name: 'Distribute' }));

    await waitFor(() => {
      expect(screen.getByText(/The pool was marked partially distributed\./i)).toBeInTheDocument();
    });
  });
});
