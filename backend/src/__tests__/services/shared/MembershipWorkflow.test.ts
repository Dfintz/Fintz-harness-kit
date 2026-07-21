import {
  ACTIVITY_PARTICIPANT_TRANSITIONS,
  APPLICATION_TRANSITIONS,
  CREW_TRANSITIONS,
  INVITATION_TRANSITIONS,
  JOB_APPLICATION_TRANSITIONS,
  MembershipWorkflow,
  ORG_APPLICATION_TRANSITIONS,
} from '../../../services/shared/MembershipWorkflow';
import { ValidationError } from '../../../utils/apiErrors';

describe('MembershipWorkflow', () => {
  describe('canTransition (CREW_TRANSITIONS)', () => {
    it('should allow active → inactive for admin', () => {
      expect(
        MembershipWorkflow.canTransition(CREW_TRANSITIONS, 'active', 'inactive', 'admin')
      ).toBe(true);
    });

    it('should allow active → completed for admin', () => {
      expect(
        MembershipWorkflow.canTransition(CREW_TRANSITIONS, 'active', 'completed', 'admin')
      ).toBe(true);
    });

    it('should allow inactive → active for admin', () => {
      expect(
        MembershipWorkflow.canTransition(CREW_TRANSITIONS, 'inactive', 'active', 'admin')
      ).toBe(true);
    });

    it('should disallow completed → active (terminal)', () => {
      expect(
        MembershipWorkflow.canTransition(CREW_TRANSITIONS, 'completed', 'active', 'admin')
      ).toBe(false);
    });

    it('should disallow member from deactivating crew', () => {
      expect(
        MembershipWorkflow.canTransition(CREW_TRANSITIONS, 'active', 'inactive', 'member')
      ).toBe(false);
    });

    it('should handle unknown from-state gracefully', () => {
      expect(
        MembershipWorkflow.canTransition(
          CREW_TRANSITIONS,
          'nonexistent' as 'active',
          'active',
          'admin'
        )
      ).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for active crew', () => {
      const transitions = MembershipWorkflow.getValidTransitions(CREW_TRANSITIONS, 'active');
      const targets = transitions.map(t => t.to);

      expect(targets).toContain('inactive');
      expect(targets).toContain('completed');
    });

    it('should filter by actor', () => {
      const transitions = MembershipWorkflow.getValidTransitions(
        CREW_TRANSITIONS,
        'active',
        'member'
      );
      expect(transitions).toHaveLength(0); // crew transitions are admin-only
    });

    it('should return empty for terminal state', () => {
      const transitions = MembershipWorkflow.getValidTransitions(CREW_TRANSITIONS, 'completed');
      expect(transitions).toHaveLength(0);
    });

    it('should return empty for unknown state', () => {
      const transitions = MembershipWorkflow.getValidTransitions(
        CREW_TRANSITIONS,
        'unknown' as 'active'
      );
      expect(transitions).toHaveLength(0);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transition', () => {
      expect(() =>
        MembershipWorkflow.validateTransition(CREW_TRANSITIONS, 'active', 'completed', 'admin')
      ).not.toThrow();
    });

    it('should return same status for no-op', () => {
      const result = MembershipWorkflow.validateTransition(
        CREW_TRANSITIONS,
        'active',
        'active',
        'admin'
      );
      expect(result).toBe('active');
    });

    it('should throw ValidationError for invalid transition', () => {
      expect(() =>
        MembershipWorkflow.validateTransition(CREW_TRANSITIONS, 'completed', 'active', 'admin')
      ).toThrow(ValidationError);
    });

    it('should include helpful terminal state message', () => {
      try {
        MembershipWorkflow.validateTransition(CREW_TRANSITIONS, 'completed', 'active', 'admin');
        fail('Should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('completed');
        expect((err as Error).message).toContain('terminal');
      }
    });

    it('should throw for wrong actor', () => {
      expect(() =>
        MembershipWorkflow.validateTransition(CREW_TRANSITIONS, 'active', 'inactive', 'member')
      ).toThrow(ValidationError);
    });
  });

  describe('isTerminal', () => {
    it('should identify completed as terminal for crew', () => {
      expect(MembershipWorkflow.isTerminal(CREW_TRANSITIONS, 'completed')).toBe(true);
    });

    it('should identify active as non-terminal', () => {
      expect(MembershipWorkflow.isTerminal(CREW_TRANSITIONS, 'active')).toBe(false);
    });

    it('should treat unknown state as terminal', () => {
      expect(MembershipWorkflow.isTerminal(CREW_TRANSITIONS, 'xyz' as 'active')).toBe(true);
    });
  });

  describe('JOB_APPLICATION_TRANSITIONS', () => {
    it('should allow pending → approved for admin', () => {
      expect(
        MembershipWorkflow.canTransition(
          JOB_APPLICATION_TRANSITIONS,
          'pending',
          'approved',
          'admin'
        )
      ).toBe(true);
    });

    it('should allow pending → rejected for admin', () => {
      expect(
        MembershipWorkflow.canTransition(
          JOB_APPLICATION_TRANSITIONS,
          'pending',
          'rejected',
          'admin'
        )
      ).toBe(true);
    });

    it('should allow pending → withdrawn for member', () => {
      expect(
        MembershipWorkflow.canTransition(
          JOB_APPLICATION_TRANSITIONS,
          'pending',
          'withdrawn',
          'member'
        )
      ).toBe(true);
    });

    it('should allow waitlisted → approved for admin', () => {
      expect(
        MembershipWorkflow.canTransition(
          JOB_APPLICATION_TRANSITIONS,
          'waitlisted',
          'approved',
          'admin'
        )
      ).toBe(true);
    });

    it('should disallow rejected → approved (terminal)', () => {
      expect(
        MembershipWorkflow.canTransition(
          JOB_APPLICATION_TRANSITIONS,
          'rejected',
          'approved',
          'admin'
        )
      ).toBe(false);
    });
  });

  describe('ACTIVITY_PARTICIPANT_TRANSITIONS', () => {
    it('should allow invited → accepted for member', () => {
      expect(
        MembershipWorkflow.canTransition(
          ACTIVITY_PARTICIPANT_TRANSITIONS,
          'invited',
          'accepted',
          'member'
        )
      ).toBe(true);
    });

    it('should allow accepted → withdrawn for member', () => {
      expect(
        MembershipWorkflow.canTransition(
          ACTIVITY_PARTICIPANT_TRANSITIONS,
          'accepted',
          'withdrawn',
          'member'
        )
      ).toBe(true);
    });

    it('should allow accepted → standby for admin', () => {
      expect(
        MembershipWorkflow.canTransition(
          ACTIVITY_PARTICIPANT_TRANSITIONS,
          'accepted',
          'standby',
          'admin'
        )
      ).toBe(true);
    });

    it('should allow standby → accepted for admin', () => {
      expect(
        MembershipWorkflow.canTransition(
          ACTIVITY_PARTICIPANT_TRANSITIONS,
          'standby',
          'accepted',
          'admin'
        )
      ).toBe(true);
    });

    it('should disallow withdrawn → accepted (terminal)', () => {
      expect(
        MembershipWorkflow.canTransition(
          ACTIVITY_PARTICIPANT_TRANSITIONS,
          'withdrawn',
          'accepted',
          'member'
        )
      ).toBe(false);
    });
  });

  describe('ORG_APPLICATION_TRANSITIONS', () => {
    it('should allow pending → approved for admin', () => {
      expect(
        MembershipWorkflow.canTransition(
          ORG_APPLICATION_TRANSITIONS,
          'pending',
          'approved',
          'admin'
        )
      ).toBe(true);
    });

    it('should allow pending → rejected for admin', () => {
      expect(
        MembershipWorkflow.canTransition(
          ORG_APPLICATION_TRANSITIONS,
          'pending',
          'rejected',
          'admin'
        )
      ).toBe(true);
    });

    it('should allow pending → withdrawn for member', () => {
      expect(
        MembershipWorkflow.canTransition(
          ORG_APPLICATION_TRANSITIONS,
          'pending',
          'withdrawn',
          'member'
        )
      ).toBe(true);
    });

    it('should disallow member from approving', () => {
      expect(
        MembershipWorkflow.canTransition(
          ORG_APPLICATION_TRANSITIONS,
          'pending',
          'approved',
          'member'
        )
      ).toBe(false);
    });

    it('should disallow approved → rejected (terminal)', () => {
      expect(
        MembershipWorkflow.canTransition(
          ORG_APPLICATION_TRANSITIONS,
          'approved',
          'rejected',
          'admin'
        )
      ).toBe(false);
    });

    it('should disallow rejected → approved (terminal)', () => {
      expect(
        MembershipWorkflow.canTransition(
          ORG_APPLICATION_TRANSITIONS,
          'rejected',
          'approved',
          'admin'
        )
      ).toBe(false);
    });

    it('should disallow withdrawn → pending (terminal)', () => {
      expect(
        MembershipWorkflow.canTransition(
          ORG_APPLICATION_TRANSITIONS,
          'withdrawn',
          'pending',
          'member'
        )
      ).toBe(false);
    });

    it('should identify approved as terminal', () => {
      expect(MembershipWorkflow.isTerminal(ORG_APPLICATION_TRANSITIONS, 'approved')).toBe(true);
    });

    it('should identify rejected as terminal', () => {
      expect(MembershipWorkflow.isTerminal(ORG_APPLICATION_TRANSITIONS, 'rejected')).toBe(true);
    });

    it('should identify withdrawn as terminal', () => {
      expect(MembershipWorkflow.isTerminal(ORG_APPLICATION_TRANSITIONS, 'withdrawn')).toBe(true);
    });

    it('should identify pending as non-terminal', () => {
      expect(MembershipWorkflow.isTerminal(ORG_APPLICATION_TRANSITIONS, 'pending')).toBe(false);
    });

    it('should throw ValidationError for invalid transition', () => {
      expect(() =>
        MembershipWorkflow.validateTransition(
          ORG_APPLICATION_TRANSITIONS,
          'approved',
          'pending',
          'admin'
        )
      ).toThrow(ValidationError);
    });
  });

  // ── APPLICATION_TRANSITIONS (unified alias) ─────────────────────

  describe('APPLICATION_TRANSITIONS', () => {
    it('should be the same reference as ORG_APPLICATION_TRANSITIONS', () => {
      expect(APPLICATION_TRANSITIONS).toBe(ORG_APPLICATION_TRANSITIONS);
    });

    it('should allow pending → approved for admin', () => {
      expect(
        MembershipWorkflow.canTransition(APPLICATION_TRANSITIONS, 'pending', 'approved', 'admin')
      ).toBe(true);
    });

    it('should allow pending → withdrawn for member', () => {
      expect(
        MembershipWorkflow.canTransition(APPLICATION_TRANSITIONS, 'pending', 'withdrawn', 'member')
      ).toBe(true);
    });
  });

  // ── INVITATION_TRANSITIONS ──────────────────────────────────────

  describe('INVITATION_TRANSITIONS', () => {
    it('should allow pending → approved for admin', () => {
      expect(
        MembershipWorkflow.canTransition(INVITATION_TRANSITIONS, 'pending', 'approved', 'admin')
      ).toBe(true);
    });

    it('should allow pending → rejected for admin', () => {
      expect(
        MembershipWorkflow.canTransition(INVITATION_TRANSITIONS, 'pending', 'rejected', 'admin')
      ).toBe(true);
    });

    it('should allow pending → expired for system', () => {
      expect(
        MembershipWorkflow.canTransition(INVITATION_TRANSITIONS, 'pending', 'expired', 'system')
      ).toBe(true);
    });

    it('should allow approved → accepted for member (invitee)', () => {
      expect(
        MembershipWorkflow.canTransition(INVITATION_TRANSITIONS, 'approved', 'accepted', 'member')
      ).toBe(true);
    });

    it('should allow approved → declined for member (invitee)', () => {
      expect(
        MembershipWorkflow.canTransition(INVITATION_TRANSITIONS, 'approved', 'declined', 'member')
      ).toBe(true);
    });

    it('should allow approved → expired for system', () => {
      expect(
        MembershipWorkflow.canTransition(INVITATION_TRANSITIONS, 'approved', 'expired', 'system')
      ).toBe(true);
    });

    it('should disallow pending → accepted (must be approved first)', () => {
      expect(
        MembershipWorkflow.canTransition(INVITATION_TRANSITIONS, 'pending', 'accepted', 'member')
      ).toBe(false);
    });

    it('should identify accepted as terminal', () => {
      expect(MembershipWorkflow.isTerminal(INVITATION_TRANSITIONS, 'accepted')).toBe(true);
    });

    it('should identify declined as terminal', () => {
      expect(MembershipWorkflow.isTerminal(INVITATION_TRANSITIONS, 'declined')).toBe(true);
    });

    it('should identify expired as terminal', () => {
      expect(MembershipWorkflow.isTerminal(INVITATION_TRANSITIONS, 'expired')).toBe(true);
    });

    it('should identify rejected as terminal', () => {
      expect(MembershipWorkflow.isTerminal(INVITATION_TRANSITIONS, 'rejected')).toBe(true);
    });

    it('should throw ValidationError for invalid invitation transition', () => {
      expect(() =>
        MembershipWorkflow.validateTransition(
          INVITATION_TRANSITIONS,
          'accepted',
          'pending',
          'admin'
        )
      ).toThrow(ValidationError);
    });
  });
});
