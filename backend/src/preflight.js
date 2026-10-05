import prisma from './config/database.js';

/**
 * Make schema deployment safe for existing databases.
 * The phone number is optional and is not a database-level unique field.
 * Older deployments may contain duplicate values, which are valid.
 * This preflight is intentionally non-destructive and only verifies connectivity.
 */
async function main() {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');

    console.log('Database preflight completed. Database connection is ready.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Database preflight failed:', error);
  process.exit(1);
});
