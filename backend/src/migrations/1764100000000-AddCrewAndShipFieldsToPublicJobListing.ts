import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Add crew spots tracking and required ships to public job listings
 *
 * New columns:
 * - crewSpotsTotal: Total crew positions available
 * - crewSpotsFilled: How many positions already filled
 * - requiredShips: JSON array of ship names/models required
 * - shipRequirementType: Whether ships are required, preferred, or not needed
 */
export class AddCrewAndShipFieldsToPublicJobListing1764100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('public_job_listings', [
      new TableColumn({
        name: 'crewSpotsTotal',
        type: 'integer',
        isNullable: true,
        comment: 'Total crew positions available for this listing',
      }),
      new TableColumn({
        name: 'crewSpotsFilled',
        type: 'integer',
        default: 0,
        comment: 'Number of crew positions already filled',
      }),
      new TableColumn({
        name: 'requiredShips',
        type: 'jsonb',
        isNullable: true,
        comment: 'JSON array of required/preferred ship models',
      }),
      new TableColumn({
        name: 'shipRequirementType',
        type: 'varchar',
        length: '20',
        isNullable: true,
        default: "'none'",
        comment: "Ship requirement: 'none', 'required', 'preferred'",
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('public_job_listings', 'shipRequirementType');
    await queryRunner.dropColumn('public_job_listings', 'requiredShips');
    await queryRunner.dropColumn('public_job_listings', 'crewSpotsFilled');
    await queryRunner.dropColumn('public_job_listings', 'crewSpotsTotal');
  }
}
