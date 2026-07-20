export type FocusType = 'Primary' | 'Secondary';
export type FocusValue = 'Bounty Hunting' | 'Engineering' | 'Exploration' | 'Medical' | 'Piracy' | 'Infiltration' | 'Resources' | 'Scouting' | 'Security' | 'Smuggling' | 'Trading' | 'Transport';
export interface UserFocus {
    userId: string;
    primaryFocuses: FocusValue[];
    secondaryFocuses: FocusValue[];
}
export interface OrgFocus {
    orgId: string;
    focuses: FocusValue[];
}
export declare class FocusService {
    private get userRepo();
    private get orgRepo();
    getFocusList(): FocusValue[];
    setUserFocus(userId: string, primary: FocusValue[], secondary: FocusValue[]): Promise<void>;
    setOrgFocus(orgId: string, focuses: FocusValue[]): Promise<void>;
    getUserFocus(userId: string): Promise<UserFocus | undefined>;
    getOrgFocus(orgId: string): Promise<OrgFocus | undefined>;
}
//# sourceMappingURL=FocusService.d.ts.map