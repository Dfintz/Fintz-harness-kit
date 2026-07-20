import type { VoiceServerConfig } from '@sc-fleet-manager/shared-types';
interface MumbleChannel {
    id: number;
    name: string;
    parentId: number | null;
}
interface MumbleACLGroup {
    name: string;
    members: string[];
}
export declare class MumbleIceBridgeService {
    private static instance;
    private constructor();
    static getInstance(): MumbleIceBridgeService;
    createChannel(config: VoiceServerConfig, name: string, parentId?: number): Promise<MumbleChannel | null>;
    deleteChannel(config: VoiceServerConfig, channelId: number): Promise<boolean>;
    setChannelACL(config: VoiceServerConfig, channelId: number, groups: MumbleACLGroup[]): Promise<boolean>;
    muteUser(config: VoiceServerConfig, username: string, mute: boolean): Promise<boolean>;
    kickUser(config: VoiceServerConfig, username: string, reason?: string): Promise<boolean>;
    banUser(config: VoiceServerConfig, username: string, reason?: string, durationSeconds?: number): Promise<boolean>;
    private callCvpBridge;
}
export {};
//# sourceMappingURL=MumbleIceBridgeService.d.ts.map