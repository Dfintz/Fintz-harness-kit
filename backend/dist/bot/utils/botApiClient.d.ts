import { AxiosInstance } from 'axios';
declare const botApiClient: AxiosInstance;
export declare function discordHeaders(interaction: {
    guildId: string | null;
    user: {
        id: string;
    };
}): Record<string, string>;
export { botApiClient };
//# sourceMappingURL=botApiClient.d.ts.map