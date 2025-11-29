import bcrypt from 'bcrypt';
import pool from '../config/db.js';

const seedscript = async () => {
  try {
    const argv = process.argv.slice(2);
    const username = process.env.SEED_ADMIN_USER || argv[0] || 'littleWolf';
    // support both SEED_ADMIN_PASS and SEED_ADMIN_PASSWORD env var names (backwards compatibility)
    const password = process.env.SEED_ADMIN_PASS || process.env.SEED_ADMIN_PASSWORD || argv[1] || 'Admin123!';
    const role = process.env.SEED_ADMIN_ROLE || 'SuperAdmin';
    const force = (process.env.SEED_ADMIN_FORCE === 'true') || argv.includes('--reset') || argv.includes('--force');

    // configurable bcrypt rounds
    const rounds = Number(process.env.BCRYPT_ROUNDS || process.env.BCRYPT_COST) || 10;

    // print-only / dry-run option. Accept env PRINT_ONLY=true or CLI flag --print-hash or --print-only
    const printOnly = (process.env.PRINT_ONLY === 'true') || argv.includes('--print-hash') || argv.includes('--print-only');

    // If print-only mode requested, just print the hash and return (no DB changes)
    if (printOnly) {
      const hash = await bcrypt.hash(password, rounds);
      console.log(hash);
      return;
    }

    // Check if user exists
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (rows.length > 0) {
      console.log(`User '${username}' already exists (id=${rows[0].id}).`);
      if (force) {
        // update password and role
        const hash = await bcrypt.hash(password, rounds);
        await pool.query('UPDATE users SET password_hash = $1, role = $2 WHERE username = $3', [hash, role, username]);
        console.log(`Updated password and role for existing user '${username}'.`);
        return;
      }
      console.log('Use SEED_ADMIN_FORCE=true or --reset to update the password for an existing user. Nothing to do.');
      return;
    }

    // Hash password and insert
    const hash = await bcrypt.hash(password, rounds);
    const insertRes = await pool.query(
      'INSERT INTO users (username, password_hash, role, created_at) VALUES ($1, $2, $3, now()) RETURNING id',
      [username, hash, role]
    );

    console.log(`Inserted admin user '${username}' with id=${insertRes.rows[0].id}`);
    return;
  } catch (err) {
    console.error('Failed to seed admin user:', err);
    return;
  }
}

export default seedscript;
