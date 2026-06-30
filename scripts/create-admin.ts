/**
 * Create the first admin user for ICE Pulse.
 * Run: npx tsx scripts/create-admin.ts
 *
 * Set ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD env vars, or pass them as args:
 *   npx tsx scripts/create-admin.ts admin@icecreates.com "Admin Name" "password123"
 */
import './_env';
import { hash } from 'bcryptjs';
import { findUserByEmail, createUser } from '../src/server/db/repositories/users.repo';
import { closePool } from '../src/server/db/pool';

async function main() {
  const [, , emailArg, nameArg, passArg] = process.argv;
  const email = emailArg ?? process.env.ADMIN_EMAIL ?? '';
  const name = nameArg ?? process.env.ADMIN_NAME ?? 'ICE Admin';
  const password = passArg ?? process.env.ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <name> <password>');
    console.error('Or set ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD env vars.');
    process.exit(1);
  }

  const existing = await findUserByEmail(email).catch(() => null);
  if (existing) {
    console.log(`User ${email} already exists (id=${existing.id}, role=${existing.role}).`);
    await closePool();
    return;
  }

  const passwordHash = await hash(password, 12);
  const user = await createUser({ email, passwordHash, name, role: 'admin', clientId: null });
  console.log(`Admin created: id=${user.id}  email=${user.email}  role=${user.role}`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
