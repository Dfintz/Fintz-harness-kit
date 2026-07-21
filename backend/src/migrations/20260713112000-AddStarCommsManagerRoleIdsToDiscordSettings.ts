import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStarCommsManagerRoleIdsToDiscordSettings20260713112000 implements MigrationInterface {
  name = 'AddStarCommsManagerRoleIdsToDiscordSettings20260713112000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOrgColumn = await queryRunner.hasColumn(
      'discord_guild_settings',
      'starCommsManagerRoleIds'
    );
    if (!hasOrgColumn) {
      await queryRunner.addColumn(
        'discord_guild_settings',
        new TableColumn({
          name: 'starCommsManagerRoleIds',
          type: 'text',
          isNullable: true,
        })
      );
    }

    const hasFederationColumn = await queryRunner.hasColumn(
      'federation_discord_guild_settings',
      'starCommsManagerRoleIds'
    );
    if (!hasFederationColumn) {
      await queryRunner.addColumn(
        'federation_discord_guild_settings',
        new TableColumn({
          name: 'starCommsManagerRoleIds',
          type: 'text',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasFederationColumn = await queryRunner.hasColumn(
      'federation_discord_guild_settings',
      'starCommsManagerRoleIds'
    );
    if (hasFederationColumn) {
      await queryRunner.dropColumn('federation_discord_guild_settings', 'starCommsManagerRoleIds');
    }

    const hasOrgColumn = await queryRunner.hasColumn(
      'discord_guild_settings',
      'starCommsManagerRoleIds'
    );
    if (hasOrgColumn) {
      await queryRunner.dropColumn('discord_guild_settings', 'starCommsManagerRoleIds');
    }
  }
}
