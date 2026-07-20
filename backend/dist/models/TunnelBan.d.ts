import { Tunnel } from './Tunnel';
export type TunnelBanType = 'ban' | 'mute';
export declare class TunnelBan {
    id: string;
    tunnelId: string;
    tunnel?: Tunnel;
    userId: string;
    username?: string;
    type: TunnelBanType;
    reason?: string;
    issuedBy: string;
    expiresAt?: Date;
    createdAt: Date;
}
//# sourceMappingURL=TunnelBan.d.ts.map