import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create RSI Crawler tables
 * Creates tables for storing crawled RSI organization and member data
 */
export class CreateRsiCrawlerTables1776000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create rsi_crawled_organizations table
    await queryRunner.createTable(
      new Table({
        name: 'rsi_crawled_organizations',
        columns: [
          {
            name: 'sid',
            type: 'varchar',
            length: '20',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'banner',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'logo',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'archetype',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'commitment',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'roleplay',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'memberCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'affiliateCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'focus',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'recruiting',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'language',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'links',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'firstCrawledAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'lastCrawledAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'crawlError',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'crawlFailed',
            type: 'boolean',
            default: false,
          },
        ],
      }),
      true
    );

    // Create indexes for rsi_crawled_organizations
    await queryRunner.createIndex(
      'rsi_crawled_organizations',
      new TableIndex({
        name: 'IDX_rsi_crawled_organizations_sid',
        columnNames: ['sid'],
      })
    );

    await queryRunner.createIndex(
      'rsi_crawled_organizations',
      new TableIndex({
        name: 'IDX_rsi_crawled_organizations_lastCrawledAt',
        columnNames: ['lastCrawledAt'],
      })
    );

    // Create rsi_crawled_members table
    await queryRunner.createTable(
      new Table({
        name: 'rsi_crawled_members',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '100',
            isPrimary: true,
          },
          {
            name: 'organizationSid',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'handle',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'rank',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'stars',
            type: 'integer',
            default: 0,
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
            name: 'isHidden',
            type: 'boolean',
            default: false,
          },
          {
            name: 'avatar',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'enlisted',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'firstCrawledAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'lastCrawledAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'crawlError',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'crawlFailed',
            type: 'boolean',
            default: false,
          },
        ],
      }),
      true
    );

    // Create indexes for rsi_crawled_members
    await queryRunner.createIndex(
      'rsi_crawled_members',
      new TableIndex({
        name: 'IDX_rsi_crawled_members_organizationSid_handle',
        columnNames: ['organizationSid', 'handle'],
      })
    );

    await queryRunner.createIndex(
      'rsi_crawled_members',
      new TableIndex({
        name: 'IDX_rsi_crawled_members_handle',
        columnNames: ['handle'],
      })
    );

    await queryRunner.createIndex(
      'rsi_crawled_members',
      new TableIndex({
        name: 'IDX_rsi_crawled_members_lastCrawledAt',
        columnNames: ['lastCrawledAt'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('rsi_crawled_members', true);
    await queryRunner.dropTable('rsi_crawled_organizations', true);
  }
}
