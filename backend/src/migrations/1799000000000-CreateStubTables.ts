import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class CreateStubTables1799000000000 implements MigrationInterface {
  name = 'CreateStubTables1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== TAGS ====================
    await queryRunner.createTable(
      new Table({
        name: 'tags',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'color', type: 'varchar', length: '7', isNullable: true },
          { name: 'description', type: 'varchar', length: '500', isNullable: true },
          { name: 'createdBy', type: 'uuid', isNullable: false },
          { name: 'sharedWithOrgs', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
        uniques: [new TableUnique({ columnNames: ['organizationId', 'name'] })],
      }),
      true
    );

    // ==================== TAG ASSIGNMENTS ====================
    await queryRunner.createTable(
      new Table({
        name: 'tag_assignments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'tagId', type: 'uuid', isNullable: false },
          { name: 'resourceType', type: 'varchar', length: '64', isNullable: false },
          { name: 'resourceId', type: 'varchar', length: '255', isNullable: false },
          { name: 'assignedBy', type: 'uuid', isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
        uniques: [new TableUnique({ columnNames: ['tagId', 'resourceType', 'resourceId'] })],
        foreignKeys: [
          {
            columnNames: ['tagId'],
            referencedTableName: 'tags',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // ==================== COMMENTS ====================
    await queryRunner.createTable(
      new Table({
        name: 'comments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'content', type: 'text', isNullable: false },
          { name: 'resourceType', type: 'varchar', length: '64', isNullable: false },
          { name: 'resourceId', type: 'varchar', length: '255', isNullable: false },
          { name: 'createdBy', type: 'uuid', isNullable: false },
          { name: 'createdByName', type: 'varchar', length: '255', isNullable: true },
          { name: 'parentId', type: 'uuid', isNullable: true },
          { name: 'likeCount', type: 'int', default: 0 },
          { name: 'replyCount', type: 'int', default: 0 },
          { name: 'isEdited', type: 'boolean', default: false },
          { name: 'editedAt', type: 'timestamp', isNullable: true },
          { name: 'sharedWithOrgs', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'comments',
      new TableIndex({
        name: 'IDX_comments_org_resource',
        columnNames: ['organizationId', 'resourceType', 'resourceId'],
      })
    );

    // ==================== COMMENT LIKES ====================
    await queryRunner.createTable(
      new Table({
        name: 'comment_likes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'commentId', type: 'uuid', isNullable: false },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
        uniques: [new TableUnique({ columnNames: ['commentId', 'userId'] })],
        foreignKeys: [
          {
            columnNames: ['commentId'],
            referencedTableName: 'comments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // ==================== SKILLS ====================
    await queryRunner.createTable(
      new Table({
        name: 'skills',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '200', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'other'",
          },
          { name: 'createdBy', type: 'uuid', isNullable: false },
          { name: 'sharedWithOrgs', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
        uniques: [new TableUnique({ columnNames: ['organizationId', 'name'] })],
      }),
      true
    );

    // ==================== USER SKILLS ====================
    await queryRunner.createTable(
      new Table({
        name: 'user_skills',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'skillId', type: 'uuid', isNullable: false },
          {
            name: 'level',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'beginner'",
          },
          { name: 'endorsementCount', type: 'int', default: 0 },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
        uniques: [new TableUnique({ columnNames: ['organizationId', 'userId', 'skillId'] })],
        foreignKeys: [
          {
            columnNames: ['skillId'],
            referencedTableName: 'skills',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // ==================== SKILL ENDORSEMENTS ====================
    await queryRunner.createTable(
      new Table({
        name: 'skill_endorsements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userSkillId', type: 'uuid', isNullable: false },
          { name: 'endorsedBy', type: 'uuid', isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
        uniques: [new TableUnique({ columnNames: ['userSkillId', 'endorsedBy'] })],
        foreignKeys: [
          {
            columnNames: ['userSkillId'],
            referencedTableName: 'user_skills',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // ==================== CERTIFICATIONS ====================
    await queryRunner.createTable(
      new Table({
        name: 'certifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '200', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'requirements', type: 'text', isNullable: true },
          { name: 'createdBy', type: 'uuid', isNullable: false },
          { name: 'sharedWithOrgs', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
        uniques: [new TableUnique({ columnNames: ['organizationId', 'name'] })],
      }),
      true
    );

    // ==================== USER CERTIFICATIONS ====================
    await queryRunner.createTable(
      new Table({
        name: 'user_certifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'certificationId', type: 'uuid', isNullable: false },
          { name: 'status', type: 'varchar', length: '20', isNullable: false, default: "'active'" },
          { name: 'awardedBy', type: 'uuid', isNullable: false },
          { name: 'awardedAt', type: 'timestamp', default: 'now()' },
          { name: 'revokedBy', type: 'uuid', isNullable: true },
          { name: 'revokedAt', type: 'timestamp', isNullable: true },
          { name: 'revokeReason', type: 'varchar', length: '500', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
        uniques: [
          new TableUnique({ columnNames: ['organizationId', 'userId', 'certificationId'] }),
        ],
        foreignKeys: [
          {
            columnNames: ['certificationId'],
            referencedTableName: 'certifications',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_certifications', true);
    await queryRunner.dropTable('certifications', true);
    await queryRunner.dropTable('skill_endorsements', true);
    await queryRunner.dropTable('user_skills', true);
    await queryRunner.dropTable('skills', true);
    await queryRunner.dropTable('comment_likes', true);
    await queryRunner.dropTable('comments', true);
    await queryRunner.dropTable('tag_assignments', true);
    await queryRunner.dropTable('tags', true);
  }
}
