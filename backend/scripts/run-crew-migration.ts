import { AppDataSource } from '../src/config/database';

async function run() {
  await AppDataSource.initialize();
  console.log('Database connected');

  await AppDataSource.query(`
    ALTER TABLE public_job_listings ADD COLUMN IF NOT EXISTS "crewSpotsTotal" integer;
    ALTER TABLE public_job_listings ADD COLUMN IF NOT EXISTS "crewSpotsFilled" integer DEFAULT 0;
    ALTER TABLE public_job_listings ADD COLUMN IF NOT EXISTS "requiredShips" jsonb;
    ALTER TABLE public_job_listings ADD COLUMN IF NOT EXISTS "shipRequirementType" varchar(20) DEFAULT 'none';
  `);

  console.log(
    'Migration applied successfully - added crewSpotsTotal, crewSpotsFilled, requiredShips, shipRequirementType'
  );
  await AppDataSource.destroy();
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
