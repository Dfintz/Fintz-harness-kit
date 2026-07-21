import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class CreateRsiCitizenOrgs1822000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'rsi_citizen_orgs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'citizenHandle',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'organizationSid',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'organizationName',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'rank',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'stars',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'isMain',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isAffiliate',
            type: 'boolean',
            default: false,
          },
          {
            name: 'lastFetchedAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    await queryRunner.createUniqueConstraint(
      'rsi_citizen_orgs',
      new TableUnique({
        name: 'UQ_rsi_citizen_orgs_handle_sid',
        columnNames: ['citizenHandle', 'organizationSid'],
      })
    );

    await queryRunner.createIndices('rsi_citizen_orgs', [
      new TableIndex({
        name: 'IDX_rsi_citizen_orgs_handle',
        columnNames: ['citizenHandle'],
      }),
      new TableIndex({
        name: 'IDX_rsi_citizen_orgs_org_sid',
        columnNames: ['organizationSid'],
      }),
      new TableIndex({
        name: 'IDX_rsi_citizen_orgs_fetched_at',
        columnNames: ['lastFetchedAt'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('rsi_citizen_orgs', true);
  }
}
