import type { CASActivityTier } from '@sc-fleet-manager/shared-types';
import type { Repository } from 'typeorm';
import { ActivityLevel, PublicOrgProfile } from '../../models/PublicOrgProfile';
export declare function mapCasTierToActivityLevel(tier: CASActivityTier): ActivityLevel;
export declare class CASActivityLevelBridge {
    private readonly profileRepository;
    private subscribed;
    private readonly casUpdatedListener;
    constructor(profileRepository?: Repository<PublicOrgProfile>);
    subscribeToEvents(): void;
    unsubscribeFromEvents(): void;
    private onCasUpdated;
}
export declare function getCASActivityLevelBridge(): CASActivityLevelBridge;
//# sourceMappingURL=CASActivityLevelBridge.d.ts.map