export type Actor = 'member' | 'admin' | 'system';
export interface TransitionDef<S extends string = string> {
    to: S;
    actor: Actor;
    label?: string;
}
export type TransitionMap<S extends string = string> = Record<S, TransitionDef<S>[]>;
export declare const CREW_TRANSITIONS: TransitionMap<'active' | 'inactive' | 'completed'>;
export declare const JOB_APPLICATION_TRANSITIONS: TransitionMap<'pending' | 'approved' | 'rejected' | 'waitlisted' | 'withdrawn'>;
export declare const APPLICATION_TRANSITIONS: TransitionMap<'pending' | 'approved' | 'rejected' | 'withdrawn'>;
export declare const ORG_APPLICATION_TRANSITIONS: TransitionMap<'pending' | 'approved' | 'rejected' | 'withdrawn'>;
export declare const INVITATION_TRANSITIONS: TransitionMap<'pending' | 'approved' | 'accepted' | 'rejected' | 'declined' | 'expired'>;
export declare const ACTIVITY_PARTICIPANT_TRANSITIONS: TransitionMap<'invited' | 'accepted' | 'declined' | 'standby' | 'withdrawn'>;
export declare class MembershipWorkflow {
    static canTransition<S extends string>(map: TransitionMap<S>, currentStatus: S, newStatus: S, actor: Actor): boolean;
    static getValidTransitions<S extends string>(map: TransitionMap<S>, currentStatus: S, actor?: Actor): TransitionDef<S>[];
    static validateTransition<S extends string>(map: TransitionMap<S>, currentStatus: S, newStatus: S, actor: Actor): S;
    static isTerminal<S extends string>(map: TransitionMap<S>, status: S): boolean;
}
//# sourceMappingURL=MembershipWorkflow.d.ts.map