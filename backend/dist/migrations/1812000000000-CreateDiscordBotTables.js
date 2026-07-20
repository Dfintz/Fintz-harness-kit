"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDiscordBotTables1812000000000 = void 0;
class CreateDiscordBotTables1812000000000 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "discord_guild_settings" (
        "id"                       varchar PRIMARY KEY,
        "organizationId"           varchar NOT NULL,
        "guildId"                  varchar NOT NULL,
        "guildName"                varchar,
        "guildIconUrl"             varchar,
        "eventSettings"            jsonb,
        "voiceChannelSettings"     jsonb,
        "tunnelSettings"           jsonb,
        "notificationPreferences"  jsonb,
        "roleSyncSettings"         jsonb,
        "crossModerationSettings"  jsonb,
        "ticketSettings"           jsonb,
        "statSettings"             jsonb,
        "dmNotificationSettings"   jsonb,
        "smartLfgPingSettings"     jsonb,
        "recruitmentSettings"      jsonb,
        "giveawaySettings"         jsonb,
        "advancedEventSettings"    jsonb,
        "roleGatingSettings"       jsonb,
        "lfgNetworkSettings"       jsonb,
        "settingsEnabled"          boolean NOT NULL DEFAULT true,
        "adminUserIds"             text,
        "serverManagerRoleIds"     text,
        "metadata"                 jsonb,
        "lastModifiedBy"           varchar,
        "createdAt"                TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"                TIMESTAMP NOT NULL DEFAULT now(),
        "lastSyncedAt"             TIMESTAMP,
        "syncErrorCount"           integer NOT NULL DEFAULT 0,
        "lastSyncError"            varchar
      )
    `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dgs_org_guild" ON "discord_guild_settings" ("organizationId", "guildId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dgs_org" ON "discord_guild_settings" ("organizationId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dgs_guild" ON "discord_guild_settings" ("guildId")`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channel_counters" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "guildId"        varchar NOT NULL,
        "channelId"      varchar NOT NULL,
        "counterType"    varchar NOT NULL,
        "nameTemplate"   varchar NOT NULL DEFAULT '{value}',
        "enabled"        boolean NOT NULL DEFAULT true,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cc_guild" ON "channel_counters" ("guildId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cc_guild_channel" ON "channel_counters" ("guildId", "channelId")`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "member_engagements" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "guildId"         varchar NOT NULL,
        "userId"          varchar NOT NULL,
        "date"            date NOT NULL,
        "messageCount"    integer NOT NULL DEFAULT 0,
        "voiceMinutes"    integer NOT NULL DEFAULT 0,
        "reactionsGiven"  integer NOT NULL DEFAULT 0,
        "threadsCreated"  integer NOT NULL DEFAULT 0,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_me_guild_user_date" ON "member_engagements" ("guildId", "userId", "date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_me_guild_date" ON "member_engagements" ("guildId", "date")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_me_user" ON "member_engagements" ("userId")`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stat_roles" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "guildId"          varchar NOT NULL,
        "roleId"           varchar NOT NULL,
        "roleName"         varchar NOT NULL,
        "minMessages"      integer NOT NULL DEFAULT 0,
        "minVoiceMinutes"  integer NOT NULL DEFAULT 0,
        "windowDays"       integer NOT NULL DEFAULT 30,
        "autoRemove"       boolean NOT NULL DEFAULT true,
        "enabled"          boolean NOT NULL DEFAULT true,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sr_guild" ON "stat_roles" ("guildId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sr_guild_role" ON "stat_roles" ("guildId", "roleId")`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invite_tracking" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "guildId"         varchar NOT NULL,
        "invitedUserId"   varchar NOT NULL,
        "inviterUserId"   varchar,
        "inviteCode"      varchar,
        "joinedAt"        TIMESTAMP NOT NULL,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_it_guild" ON "invite_tracking" ("guildId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_it_guild_invited" ON "invite_tracking" ("guildId", "invitedUserId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_it_inviter" ON "invite_tracking" ("inviterUserId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "invite_tracking"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "stat_roles"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "member_engagements"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "channel_counters"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "discord_guild_settings"`);
    }
}
exports.CreateDiscordBotTables1812000000000 = CreateDiscordBotTables1812000000000;
//# sourceMappingURL=1812000000000-CreateDiscordBotTables.js.map