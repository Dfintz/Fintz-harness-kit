import type { CrewAssignment } from '@sc-fleet-manager/shared-types';
import { useQuery } from '@tanstack/react-query';

import { crewAssignmentService } from '@/services/crewAssignmentService';
import { crewAssignmentKeys } from './queryKeys';

/**
 * Sprint 17 crew-focused query hooks.
 */

export function useCrewAssignmentsQuery(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: crewAssignmentKeys.list(params),
    queryFn: () => crewAssignmentService.getAssignments(params),
  });
}

export function useCrewAssignmentsByShip(shipId: string | undefined) {
  return useQuery({
    queryKey: crewAssignmentKeys.byShip(shipId || ''),
    queryFn: async () => {
      const response = await crewAssignmentService.getAssignments({ page: 1, limit: 200 });
      return response.data.filter((assignment: CrewAssignment) => assignment.shipId === shipId);
    },
    enabled: !!shipId,
  });
}
