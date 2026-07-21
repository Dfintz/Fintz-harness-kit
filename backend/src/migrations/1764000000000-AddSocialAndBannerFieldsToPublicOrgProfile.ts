import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * AddSocialAndBannerFieldsToPublicOrgProfile
 *
 * Adds twitterUrl, youtubeUrl, twitchUrl, websiteUrl, bannerUrl columns
 * to the public_org_profiles table for social links and card banner images.
 */
export class AddSocialAndBannerFieldsToPublicOrgProfile1764000000000 implements MigrationInterface {
  name = 'AddSocialAndBannerFieldsToPublicOrgProfile1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('public_org_profiles', [
      new TableColumn({
        name: 'twitterUrl',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'youtubeUrl',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'twitchUrl',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'websiteUrl',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bannerUrl',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('public_org_profiles', 'bannerUrl');
    await queryRunner.dropColumn('public_org_profiles', 'websiteUrl');
    await queryRunner.dropColumn('public_org_profiles', 'twitchUrl');
    await queryRunner.dropColumn('public_org_profiles', 'youtubeUrl');
    await queryRunner.dropColumn('public_org_profiles', 'twitterUrl');
  }
}
