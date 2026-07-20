"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipWorkflow = exports.ACTIVITY_PARTICIPANT_TRANSITIONS = exports.INVITATION_TRANSITIONS = exports.ORG_APPLICATION_TRANSITIONS = exports.APPLICATION_TRANSITIONS = exports.JOB_APPLICATION_TRANSITIONS = exports.CREW_TRANSITIONS = void 0;
const apiErrors_1 = require("../../utils/apiErrors");
exports.CREW_TRANSITIONS = {
    active: [
        { to: 'inactive', actor: 'admin', label: 'Deactivate' },
        { to: 'completed', actor: 'admin', label: 'Complete' },
    ],
    inactive: [
        { to: 'active', actor: 'admin', label: 'Reactivate' },
        { to: 'completed', actor: 'admin', label: 'Complete' },
    ],
    completed: [],
};
exports.JOB_APPLICATION_TRANSITIONS = {
    pending: [
        { to: 'approved', actor: 'admin', label: 'Approve' },
        { to: 'rejected', actor: 'admin', label: 'Reject' },
        { to: 'waitlisted', actor: 'admin', label: 'Waitlist' },
        { to: 'withdrawn', actor: 'member', label: 'Withdraw' },
    ],
    waitlisted: [
        { to: 'approved', actor: 'admin', label: 'Approve from waitlist' },
        { to: 'rejected', actor: 'admin', label: 'Reject' },
        { to: 'withdrawn', actor: 'member', label: 'Withdraw' },
    ],
    approved: [{ to: 'withdrawn', actor: 'member', label: 'Leave' }],
    rejected: [],
    withdrawn: [],
};
exports.APPLICATION_TRANSITIONS = {
    pending: [
        { to: 'approved', actor: 'admin', label: 'Approve' },
        { to: 'rejected', actor: 'admin', label: 'Reject' },
        { to: 'withdrawn', actor: 'member', label: 'Withdraw' },
    ],
    approved: [],
    rejected: [],
    withdrawn: [],
};
exports.ORG_APPLICATION_TRANSITIONS = exports.APPLICATION_TRANSITIONS;
exports.INVITATION_TRANSITIONS = {
    pending: [
        { to: 'approved', actor: 'admin', label: 'Approve invite' },
        { to: 'rejected', actor: 'admin', label: 'Reject invite' },
        { to: 'expired', actor: 'system', label: 'Expire' },
    ],
    approved: [
        { to: 'accepted', actor: 'member', label: 'Accept invite' },
        { to: 'declined', actor: 'member', label: 'Decline invite' },
        { to: 'expired', actor: 'system', label: 'Expire' },
    ],
    accepted: [],
    rejected: [],
    declined: [],
    expired: [],
};
exports.ACTIVITY_PARTICIPANT_TRANSITIONS = {
    invited: [
        { to: 'accepted', actor: 'member', label: 'Accept invite' },
        { to: 'declined', actor: 'member', label: 'Decline invite' },
    ],
    accepted: [
        { to: 'withdrawn', actor: 'member', label: 'Leave' },
        { to: 'standby', actor: 'admin', label: 'Move to standby' },
    ],
    standby: [
        { to: 'accepted', actor: 'admin', label: 'Promote to active' },
        { to: 'withdrawn', actor: 'member', label: 'Leave' },
    ],
    declined: [],
    withdrawn: [],
};
class MembershipWorkflow {
    static canTransition(map, currentStatus, newStatus, actor) {
        const allowed = map[currentStatus];
        if (!allowed) {
            return false;
        }
        return allowed.some(t => t.to === newStatus && t.actor === actor);
    }
    static getValidTransitions(map, currentStatus, actor) {
        const allowed = map[currentStatus] ?? [];
        if (!actor) {
            return allowed;
        }
        return allowed.filter(t => t.actor === actor);
    }
    static validateTransition(map, currentStatus, newStatus, actor) {
        if (currentStatus === newStatus) {
            return newStatus;
        }
        if (!MembershipWorkflow.canTransition(map, currentStatus, newStatus, actor)) {
            const validTargets = MembershipWorkflow.getValidTransitions(map, currentStatus, actor);
            if (validTargets.length === 0) {
                throw new apiErrors_1.ValidationError(`Cannot change status from "${currentStatus}" — it is a terminal state`);
            }
            const validNames = validTargets.map(t => `"${t.to}"`).join(', ');
            throw new apiErrors_1.ValidationError(`Cannot transition from "${currentStatus}" to "${newStatus}" as ${actor}. Valid targets: ${validNames}`);
        }
        return newStatus;
    }
    static isTerminal(map, status) {
        const allowed = map[status];
        return !allowed || allowed.length === 0;
    }
}
exports.MembershipWorkflow = MembershipWorkflow;
//# sourceMappingURL=MembershipWorkflow.js.map