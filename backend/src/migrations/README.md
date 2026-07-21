# Database Migrations

This directory contains TypeORM database migrations for the SC Fleet Manager application.

## 🚨 Important: Migrations vs Synchronize

**Production Deployments**: Always use migrations instead of TypeORM's `synchronize` option.

- ✅ **DO**: Use migrations for production
- ❌ **DON'T**: Use `synchronize: true` in production (can cause data loss)

## Setup Migration System

### 1. Update TypeORM Configuration

Add to `backend/src/config/database.ts`:

```typescript
migrations: [__dirname + '/../migrations/*.{ts,js}'],
cli: {
    migrationsDir: 'src/migrations'
}
```

### 2. Add Migration Scripts

Add to `backend/package.json`:

```json
"scripts": {
    "migration:generate": "typeorm migration:generate -d src/config/database.ts",
    "migration:create": "typeorm migration:create",
    "migration:run": "typeorm migration:run -d src/config/database.ts",
    "migration:revert": "typeorm migration:revert -d src/config/database.ts",
    "migration:show": "typeorm migration:show -d src/config/database.ts"
}
```

## Creating Migrations

### Generate from Entity Changes

```bash
npm run migration:generate -- src/migrations/InitialSchema
```

This will automatically detect changes between your entities and database.

### Create Empty Migration

```bash
npm run migration:create -- src/migrations/AddUserIndexes
```

## Running Migrations

### Apply All Pending Migrations

```bash
npm run migration:run
```

### Revert Last Migration

```bash
npm run migration:revert
```

### Show Migration Status

```bash
npm run migration:show
```

## Migration Best Practices

### 1. Version Control
- ✅ Always commit migrations to version control
- ✅ Never modify existing migrations (create new ones instead)
- ✅ Use descriptive names with timestamps

### 2. Testing
- ✅ Test migrations on a copy of production data
- ✅ Always have a rollback plan
- ✅ Test both up and down migrations

### 3. Data Safety
- ✅ Back up database before running migrations in production
- ✅ Use transactions for data modifications
- ✅ Handle NULL values and defaults carefully

### 4. Performance
- ✅ Create indexes in separate migrations if they take long
- ✅ Use `CONCURRENTLY` for index creation in PostgreSQL
- ✅ Consider maintenance windows for large migrations

## Example Migration

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserEmailIndex1234567890 implements MigrationInterface {
    name = 'AddUserEmailIndex1234567890'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX "IDX_user_email" ON "user" ("email")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "IDX_user_email"
        `);
    }
}
```

## Deployment Process

### Development
1. Make entity changes
2. Generate migration: `npm run migration:generate -- src/migrations/YourChangeName`
3. Review generated SQL
4. Test migration locally
5. Commit migration file

### Production
1. Deploy new code (with migrations)
2. Run migrations: `npm run migration:run`
3. Verify application works
4. Monitor for issues

## Troubleshooting

### Migration Already Applied
If migration fails because it's already applied:
```bash
npm run migration:show
```

### Reset Database (Development Only)
⚠️ **Never do this in production!**
```bash
# Drop all tables and re-run migrations
npm run migration:revert -- -all
npm run migration:run
```

### Manual Intervention Required
If a migration fails:
1. Check the error message
2. Verify database state
3. Fix the issue manually if needed
4. Mark migration as completed if you fixed it manually:
   ```sql
   INSERT INTO migrations (timestamp, name) VALUES (1234567890, 'YourMigration1234567890');
   ```

## Current Status

🚧 **Migration system needs to be fully configured**

Next steps:
1. Update `database.ts` with migration configuration
2. Add migration scripts to `package.json`
3. Generate initial migration from current entities
4. Test migration system in development
5. Disable `synchronize` in production configuration

## Resources

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Zero-Downtime Migrations](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/advanced-migrate-scenarios)
