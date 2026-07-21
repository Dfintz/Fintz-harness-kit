import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: Add RSI Verification Fields to Organizations
 *
 * Adds fields to support RSI organization verification with code-based validation:
 * - rsiSid: RSI organization SID (Spectrum ID)
 * - rsiVerified: Whether the organization's RSI account is verified
 * - rsiVerifiedAt: Timestamp of verification
 * - rsiVerificationCode: Temporary code for verification process
 * - rsiVerificationCodeExpiresAt: Expiration timestamp for verification code
 *
 * This mirrors the user RSI verification process but for organizations.
 */
export class AddRsiVerificationToOrganizations1768000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('organizations');
    const hasRsiSid = await queryRunner.hasColumn('organizations', 'rsiSid');
    const hasRsiVerified = await queryRunner.hasColumn('organizations', 'rsiVerified');
    const hasRsiVerifiedAt = await queryRunner.hasColumn('organizations', 'rsiVerifiedAt');
    const hasRsiVerificationCode = await queryRunner.hasColumn(
      'organizations',
      'rsiVerificationCode'
    );
    const hasRsiVerificationCodeExpiresAt = await queryRunner.hasColumn(
      'organizations',
      'rsiVerificationCodeExpiresAt'
    );

    if (!hasRsiSid) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'rsiSid',
          type: 'varchar',
          isNullable: true,
          comment: 'RSI organization SID (Spectrum ID)',
        })
      );
    }

    if (!hasRsiVerified) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'rsiVerified',
          type: 'boolean',
          default: false,
          isNullable: false,
          comment: 'Whether the RSI organization is verified',
        })
      );
    }

    if (!hasRsiVerifiedAt) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'rsiVerifiedAt',
          type: 'timestamp',
          isNullable: true,
          comment: 'Timestamp when RSI organization was verified',
        })
      );
    }

    if (!hasRsiVerificationCode) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'rsiVerificationCode',
          type: 'varchar',
          isNullable: true,
          comment: 'Temporary verification code for RSI organization verification',
        })
      );
    }

    if (!hasRsiVerificationCodeExpiresAt) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'rsiVerificationCodeExpiresAt',
          type: 'timestamp',
          isNullable: true,
          comment: 'Expiration timestamp for verification code',
        })
      );
    }

    const hasIndex = table?.indices?.some(index => index.name === 'IDX_organizations_rsiSid');
    if (!hasIndex) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_rsiSid',
          columnNames: ['rsiSid'],
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('organizations');
    const hasIndex = table?.indices?.some(index => index.name === 'IDX_organizations_rsiSid');
    if (hasIndex) {
      await queryRunner.dropIndex('organizations', 'IDX_organizations_rsiSid');
    }

    if (await queryRunner.hasColumn('organizations', 'rsiVerificationCodeExpiresAt')) {
      await queryRunner.dropColumn('organizations', 'rsiVerificationCodeExpiresAt');
    }

    if (await queryRunner.hasColumn('organizations', 'rsiVerificationCode')) {
      await queryRunner.dropColumn('organizations', 'rsiVerificationCode');
    }

    if (await queryRunner.hasColumn('organizations', 'rsiVerifiedAt')) {
      await queryRunner.dropColumn('organizations', 'rsiVerifiedAt');
    }

    if (await queryRunner.hasColumn('organizations', 'rsiVerified')) {
      await queryRunner.dropColumn('organizations', 'rsiVerified');
    }

    if (await queryRunner.hasColumn('organizations', 'rsiSid')) {
      await queryRunner.dropColumn('organizations', 'rsiSid');
    }
  }
}
