/**
 * Tests for Activity Template Query Hooks
 */

import {
  useActivityTemplate,
  useActivityTemplateCategories,
  useActivityTemplates,
  useApplyActivityTemplate,
  useCloneActivityTemplate,
  useCreateActivityTemplate,
  useDeleteActivityTemplate,
  useUpdateActivityTemplate,
} from '@/hooks/queries/useActivityTemplateQueries';
import { activityTemplateService } from '@/services/activityTemplateService';
import {
  ActivityTemplateCategory,
  type ActivityTemplate,
  type ActivityTemplateCategoryInfo,
} from '@/types/apiV2';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../queryClient';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';

// Mock the activity template service
jest.mock('../../../services/activityTemplateService');

const mockedService = activityTemplateService as jest.Mocked<typeof activityTemplateService>;

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
};

// Shared mock data
const mockTemplate: ActivityTemplate = {
  id: 'tpl-1',
  name: 'Mining Run',
  description: 'Standard mining operation template',
  activityType: 'mission',
  category: 'mining',
  isPublic: true,
  usageCount: 5,
  tags: ['mining', 'group'],
  templateData: {
    estimatedDuration: 120,
    maxParticipants: 8,
  },
  createdBy: 'user-1',
  organizationId: 'org-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
} as ActivityTemplate;

const mockCategories: ActivityTemplateCategoryInfo[] = [
  { label: 'Combat', value: 'combat', description: 'Combat missions' },
  { label: 'Mining', value: 'mining', description: 'Mining operations' },
  { label: 'Trading', value: 'trading', description: 'Trade routes' },
] as ActivityTemplateCategoryInfo[];

describe('Activity Template Query Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Query Tests
  // ==========================================================================

  describe('useActivityTemplateCategories', () => {
    it('should fetch template categories', async () => {
      mockedService.getCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useActivityTemplateCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.getCategories).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockCategories);
      expect(result.current.data).toHaveLength(3);
    });

    it('should handle error when fetching categories', async () => {
      mockedService.getCategories.mockRejectedValue(new Error('Failed to fetch'));

      const { result } = renderHook(() => useActivityTemplateCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(new Error('Failed to fetch'));
    });
  });

  describe('useActivityTemplates', () => {
    it('should fetch templates without filters', async () => {
      const mockResponse = {
        templates: [mockTemplate],
        total: 1,
        page: 1,
        limit: 20,
      };
      mockedService.getTemplates.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useActivityTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.getTemplates).toHaveBeenCalledWith(undefined);
      expect(result.current.data?.templates).toHaveLength(1);
      expect(result.current.data?.total).toBe(1);
    });

    it('should fetch templates with filters', async () => {
      const filters = { category: ActivityTemplateCategory.COMBAT, search: 'bounty', page: 2 };
      const mockResponse = {
        templates: [],
        total: 0,
        page: 2,
        limit: 20,
      };
      mockedService.getTemplates.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useActivityTemplates(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.getTemplates).toHaveBeenCalledWith(filters);
      expect(result.current.data?.templates).toHaveLength(0);
    });

    it('should handle error when fetching templates', async () => {
      mockedService.getTemplates.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useActivityTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useActivityTemplate', () => {
    it('should fetch a single template by ID', async () => {
      mockedService.getTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useActivityTemplate('tpl-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.getTemplate).toHaveBeenCalledWith('tpl-1');
      expect(result.current.data).toEqual(mockTemplate);
    });

    it('should not fetch when templateId is undefined', async () => {
      const { result } = renderHook(() => useActivityTemplate(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedService.getTemplate).not.toHaveBeenCalled();
    });

    it('should handle error for non-existent template', async () => {
      mockedService.getTemplate.mockRejectedValue(new Error('Template not found'));

      const { result } = renderHook(() => useActivityTemplate('invalid'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(new Error('Template not found'));
    });
  });

  // ==========================================================================
  // Mutation Tests
  // ==========================================================================

  describe('useCreateActivityTemplate', () => {
    it('should create a template and invalidate list cache', async () => {
      const newTemplate = { ...mockTemplate, id: 'tpl-new', name: 'New Template' };
      mockedService.createTemplate.mockResolvedValue(newTemplate as ActivityTemplate);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateActivityTemplate(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          name: 'New Template',
          activityType: 'mission',
          category: ActivityTemplateCategory.MINING,
        });
      });

      expect(mockedService.createTemplate).toHaveBeenCalledWith({
        name: 'New Template',
        activityType: 'mission',
        category: 'mining',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when creating template', async () => {
      mockedService.createTemplate.mockRejectedValue(new Error('Validation error'));

      const { result } = renderHook(() => useCreateActivityTemplate(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          name: '',
          activityType: 'mission',
        })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('useUpdateActivityTemplate', () => {
    it('should update a template and invalidate list + detail cache', async () => {
      const updatedTemplate = { ...mockTemplate, name: 'Updated Name' };
      mockedService.updateTemplate.mockResolvedValue(updatedTemplate as ActivityTemplate);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateActivityTemplate(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          templateId: 'tpl-1',
          data: { name: 'Updated Name' },
        });
      });

      expect(mockedService.updateTemplate).toHaveBeenCalledWith('tpl-1', {
        name: 'Updated Name',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when updating template', async () => {
      mockedService.updateTemplate.mockRejectedValue(new Error('Not found'));

      const { result } = renderHook(() => useUpdateActivityTemplate(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          templateId: 'tpl-nonexistent',
          data: { name: 'Test' },
        })
      ).rejects.toThrow('Not found');
    });
  });

  describe('useDeleteActivityTemplate', () => {
    it('should delete a template and invalidate list cache', async () => {
      mockedService.deleteTemplate.mockResolvedValue(undefined);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteActivityTemplate(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('tpl-1');
      });

      expect(mockedService.deleteTemplate).toHaveBeenCalledWith('tpl-1');
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when deleting template', async () => {
      mockedService.deleteTemplate.mockRejectedValue(new Error('Forbidden'));

      const { result } = renderHook(() => useDeleteActivityTemplate(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync('tpl-1')).rejects.toThrow('Forbidden');
    });
  });

  describe('useCloneActivityTemplate', () => {
    it('should clone a template and invalidate list cache', async () => {
      const clonedTemplate = {
        ...mockTemplate,
        id: 'tpl-clone',
        name: 'Mining Run (Copy)',
        usageCount: 0,
      };
      mockedService.cloneTemplate.mockResolvedValue(clonedTemplate as ActivityTemplate);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCloneActivityTemplate(), { wrapper });

      await act(async () => {
        const cloned = await result.current.mutateAsync('tpl-1');
        expect(cloned.id).toBe('tpl-clone');
        expect(cloned.usageCount).toBe(0);
      });

      expect(mockedService.cloneTemplate).toHaveBeenCalledWith('tpl-1');
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when cloning template', async () => {
      mockedService.cloneTemplate.mockRejectedValue(new Error('Clone failed'));

      const { result } = renderHook(() => useCloneActivityTemplate(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync('tpl-1')).rejects.toThrow('Clone failed');
    });
  });

  describe('useApplyActivityTemplate', () => {
    it('should apply a template and invalidate activity + template lists', async () => {
      const mockResult = { activity: { id: 'act-new' } };
      mockedService.applyTemplate.mockResolvedValue(mockResult);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useApplyActivityTemplate(), { wrapper });

      await act(async () => {
        const applied = await result.current.mutateAsync({
          templateId: 'tpl-1',
          data: {
            title: 'Mining Operation Alpha',
            scheduledStartTime: '2024-06-01T14:00:00Z',
            estimatedDuration: 120,
            maxParticipants: 8,
          },
        });
        expect(applied.activity.id).toBe('act-new');
      });

      expect(mockedService.applyTemplate).toHaveBeenCalledWith('tpl-1', {
        title: 'Mining Operation Alpha',
        scheduledStartTime: '2024-06-01T14:00:00Z',
        estimatedDuration: 120,
        maxParticipants: 8,
      });
      // Should invalidate both activities and template lists
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });

    it('should apply with minimal required fields', async () => {
      mockedService.applyTemplate.mockResolvedValue({ activity: { id: 'act-min' } });

      const { result } = renderHook(() => useApplyActivityTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          templateId: 'tpl-2',
          data: {
            title: 'Quick Mission',
            scheduledStartTime: '2024-06-01T10:00:00Z',
          },
        });
      });

      expect(mockedService.applyTemplate).toHaveBeenCalledWith('tpl-2', {
        title: 'Quick Mission',
        scheduledStartTime: '2024-06-01T10:00:00Z',
      });
    });

    it('should handle error when applying template', async () => {
      mockedService.applyTemplate.mockRejectedValue(new Error('Apply failed'));

      const { result } = renderHook(() => useApplyActivityTemplate(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          templateId: 'tpl-1',
          data: {
            title: 'Test',
            scheduledStartTime: '2024-01-01T00:00:00Z',
          },
        })
      ).rejects.toThrow('Apply failed');
    });
  });
});
