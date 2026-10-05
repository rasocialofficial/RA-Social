import prisma from '../config/database.js';

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "PasswordResetChallenge" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0');
    console.log('Password reset attempts column ready');
  } catch (error) {
    console.error('Password reset attempts migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main();
