// One-time script to create (or promote) an admin account.
// Run from the backend folder:
//   node src/scripts/createAdmin.js <admin-email> <strong-password> "Admin User"

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../config/database.js';

dotenv.config();

async function main() {
  const [, , email, password, fullName] = process.argv;

  if (!email || !password) {
    console.error('Usage: node src/scripts/createAdmin.js <email> <password> [fullName]');
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const existing = await prisma.user.findUnique({ where: { email } });

  let admin;
  if (existing) {
    admin = await prisma.user.update({
      where: { email },
      data: { role: 'admin', passwordHash },
    });
    console.log(`Existing user promoted to admin: ${admin.email}`);
  } else {
    admin = await prisma.user.create({
      data: {
        username: email.split('@')[0],
        email,
        passwordHash,
        fullName: fullName || 'Admin',
        role: 'admin',
        status: 'active',
      },
    });
    console.log(`Admin user created: ${admin.email}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
