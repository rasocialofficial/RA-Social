import prisma from '../config/database.js';

/**
 * The Post model used to have a boolean `hidden` column. It was replaced by
 * a `status` string column ('approved' | 'hidden' | ...), but on databases
 * created before that change, the old `hidden` column is still physically
 * present with real data in it (Render's deploy log showed 14 non-null
 * values). `prisma db push` refuses to drop a column with data unless told
 * to accept data loss — and blindly accepting that would silently lose
 * which posts were hidden.
 *
 * This script runs BEFORE `prisma db push`, while the old column still
 * exists, and copies its value into `status` first. After this runs, the
 * `hidden` column is fully empty of useful info and safe to drop.
 * It's a no-op (skips instantly) on databases that never had this column.
 */
async function main() {
  try {
    const columns = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Post' AND column_name = 'hidden'`
    );

    if (!columns || columns.length === 0) {
      console.log('migrateHiddenColumn: no legacy `hidden` column found, skipping.');
      return;
    }

    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Post" SET status = 'hidden' WHERE "hidden" = true AND status IS DISTINCT FROM 'hidden'`
    );

    console.log(`migrateHiddenColumn: migrated ${result} row(s) from legacy \`hidden\` column into \`status\`. Safe to drop the column now.`);
  } catch (error) {
    // Non-fatal: if this fails, prisma db push will still surface the
    // original data-loss error rather than deploying with silently lost data.
    console.error('migrateHiddenColumn: could not run migration check:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
