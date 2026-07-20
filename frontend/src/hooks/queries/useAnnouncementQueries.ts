import {
  announcementService,
  type Announcement,
  type AnnouncementFilters,
  type CreateAnnouncementInput,
  type PaginatedAnnouncementResponse,
  type PublishAnnouncementInput,
  type UpdateAnnouncementInput,
} from '@/services/announcementService';
import { selectUser, useAuthStore } from '@/store/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementKeys } from './queryKeys';

// Re-export types for convenience
export type {
  Announcement,
  AnnouncementFilters,
  CreateAnnouncementInput,
  PaginatedAnnouncementResponse,
  PublishAnnouncementInput,
  UpdateAnnouncementInput,
};

/* ── Queries ── */

export function useAnnouncements(filters?: AnnouncementFilters) {
  const user = useAuthStore(selectUser);
  const hasOrg = !!(user?.organizationId || user?.activeOrgId);
  return useQuery<PaginatedAnnouncementResponse>({
    queryKey: announcementKeys.list(filters as Record<string, unknown> | undefined),
    queryFn: () => announcementService.getAnnouncements(filters),
    enabled: hasOrg,
  });
}

export function useAnnouncement(id: string | undefined) {
  return useQuery<Announcement>({
    queryKey: announcementKeys.detail(id ?? ''),
    queryFn: () => announcementService.getAnnouncement(id!),
    enabled: !!id,
  });
}

/* ── Mutations ── */

export function useCreateAnnouncement() {  return useMutation({
    mutationFn: (data: CreateAnnouncementInput) => announcementService.createAnnouncement(data),
    meta: { invalidates: [announcementKeys.lists()] },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAnnouncementInput }) =>
      announcementService.updateAnnouncement(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: announcementKeys.lists() });
    },
  });
}

export function useDeleteAnnouncement() {  return useMutation({
    mutationFn: (id: string) => announcementService.deleteAnnouncement(id),
    meta: { invalidates: [announcementKeys.lists()] },
  });
}

export function usePublishAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PublishAnnouncementInput }) =>
      announcementService.publishAnnouncement(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: announcementKeys.lists() });
    },
  });
}

export function useToggleAnnouncementPin() {  return useMutation({
    mutationFn: (id: string) => announcementService.togglePin(id),
    meta: { invalidates: [announcementKeys.lists()] },
  });
}

export function useMarkAnnouncementRead() {  return useMutation({
    mutationFn: (id: string) => announcementService.markRead(id),
    meta: { invalidates: [announcementKeys.lists()] },
  });
}
