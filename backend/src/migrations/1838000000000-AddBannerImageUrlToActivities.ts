import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBannerImageUrlToActivities1838000000000 implements MigrationInterface {
  name = 'AddBannerImageUrlToActivities1838000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'activities',
      new TableColumn({
        name: 'bannerImageUrl',
        type: 'varchar',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('activities', 'bannerImageUrl');
  }
}
