/**
 * Fleet Store
 * Manages fleet members, ships, and operations
 */

import { apiClient, getErrorMessage, isApiClientError } from '@/services/apiClient';
import type { FleetMember, FleetStore } from '@/types/store';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

export const useFleetStore = create<FleetStore>()(
  devtools(
    persist(
      (set, _get) => ({
        // Initial state
        members: [],
        totalMembers: 0,
        activeMembers: 0,
        loading: false,
        error: null,

        // Actions
        fetchFleet: async () => {
          set({ loading: true, error: null });

          try {
            const response = await apiClient.get<FleetMember[]>('/api/v2/fleets/members');
            const members = response.data;

            set({
              members,
              totalMembers: members.length,
              activeMembers: members.filter(m => m.status === 'active').length,
              loading: false,
            });
          } catch (error: unknown) {
            const message = isApiClientError(error) ? error.message : getErrorMessage(error);
            set({
              loading: false,
              error: {
                message: message || 'Failed to fetch fleet data',
                code: isApiClientError(error) ? error.code : undefined,
                status: isApiClientError(error) ? error.statusCode : undefined,
              },
            });
          }
        },

        addMember: async (memberId: string) => {
          set({ loading: true, error: null });

          try {
            const response = await apiClient.post<FleetMember>('/api/v2/fleets/members', {
              memberId,
            });
            const newMember = response.data;

            set(state => ({
              members: [...state.members, newMember],
              totalMembers: state.totalMembers + 1,
              activeMembers:
                newMember.status === 'active' ? state.activeMembers + 1 : state.activeMembers,
              loading: false,
            }));
          } catch (error: unknown) {
            const message = isApiClientError(error) ? error.message : getErrorMessage(error);
            set({
              loading: false,
              error: {
                message: message || 'Failed to add fleet member',
                code: isApiClientError(error) ? error.code : undefined,
                status: isApiClientError(error) ? error.statusCode : undefined,
              },
            });
            throw error;
          }
        },

        removeMember: async (memberId: string) => {
          set({ loading: true, error: null });

          try {
            await apiClient.delete(`/api/v2/fleets/members/${memberId}`);

            set(state => {
              const memberToRemove = state.members.find(m => m.id === memberId);
              return {
                members: state.members.filter(m => m.id !== memberId),
                totalMembers: state.totalMembers - 1,
                activeMembers:
                  memberToRemove?.status === 'active'
                    ? state.activeMembers - 1
                    : state.activeMembers,
                loading: false,
              };
            });
          } catch (error: unknown) {
            const message = isApiClientError(error) ? error.message : getErrorMessage(error);
            set({
              loading: false,
              error: {
                message: message || 'Failed to remove fleet member',
                code: isApiClientError(error) ? error.code : undefined,
                status: isApiClientError(error) ? error.statusCode : undefined,
              },
            });
            throw error;
          }
        },

        updateMember: async (memberId: string, data: Partial<FleetMember>) => {
          set({ loading: true, error: null });

          try {
            const response = await apiClient.put<FleetMember>(
              `/api/v2/fleets/members/${memberId}`,
              data
            );
            const updatedMember = response.data;

            set(state => {
              const oldMember = state.members.find(m => m.id === memberId);
              const statusChanged = oldMember?.status !== updatedMember.status;

              let { activeMembers } = state;
              if (statusChanged) {
                activeMembers =
                  updatedMember.status === 'active'
                    ? state.activeMembers + 1
                    : state.activeMembers - 1;
              }

              return {
                members: state.members.map(m => (m.id === memberId ? updatedMember : m)),
                activeMembers,
                loading: false,
              };
            });
          } catch (error: unknown) {
            const message = isApiClientError(error) ? error.message : getErrorMessage(error);
            set({
              loading: false,
              error: {
                message: message || 'Failed to update fleet member',
                code: isApiClientError(error) ? error.code : undefined,
                status: isApiClientError(error) ? error.statusCode : undefined,
              },
            });
            throw error;
          }
        },

        clearFleet: () => {
          set({
            members: [],
            totalMembers: 0,
            activeMembers: 0,
            error: null,
          });
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'fleet-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: state => ({
          totalMembers: state.totalMembers,
          activeMembers: state.activeMembers,
        }),
      }
    ),
    {
      name: 'FleetStore',
      enabled: import.meta.env.DEV,
    }
  )
);

// Export selectors
export const selectFleetMembers = (state: FleetStore) => state.members;
export const selectActiveMembers = (state: FleetStore) =>
  state.members.filter(m => m.status === 'active');
export const selectTotalMembers = (state: FleetStore) => state.totalMembers;
export const selectFleetLoading = (state: FleetStore) => state.loading;
export const selectFleetError = (state: FleetStore) => state.error;
