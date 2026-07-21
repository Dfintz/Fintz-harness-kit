import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * AddUseDiscordForApplicationsToPublicOrgProfile
 *
 * Adds useDiscordForApplications boolean column to public_org_profiles table.
 * When true, the org profile redirects applicants to the org's Discord invite
 * instead of using the in-app application system.
 */
export class AddUseDiscordForApplicationsToPublicOrgProfile1772000000000
  implements MigrationInterface
{
  name = 'AddUseDiscordForApplicationsToPublicOrgProfile1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'public_org_profiles',
      new TableColumn({
        name: 'useDiscordForApplications',
        type: 'boolean',
        default: false,
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('public_org_profiles', 'useDiscordForApplications');
  }
}
