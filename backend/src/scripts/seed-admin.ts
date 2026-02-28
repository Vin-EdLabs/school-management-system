import bcrypt from "bcrypt";
import pool from "../config/db.js";
import {
  createUser,
  findByUsername,
  updateUser,
} from "../repositories/user.repository.js";

const seedscript = async () => {
  try {
    const argv = process.argv.slice(2);
    // Support both username and staff id env names for backwards compatibility
    const staffIdEnv =
      process.env.SEED_ADMIN_STAFF_ID ||
      process.env.SEED_ADMIN_STAFFID ||
      undefined;
    // Use staffId env if provided, otherwise fall back to username value
    const identifier =
      staffIdEnv ?? process.env.SEED_ADMIN_USER ?? argv[0] ?? "admin";
    // support both SEED_ADMIN_PASS and SEED_ADMIN_PASSWORD env var names (backwards compatibility)
    const password = process.env.SEED_ADMIN_PASS || argv[1] || "Admin123!";
    const role = process.env.SEED_ADMIN_ROLE || "SuperAdmin";
    const force =
      process.env.SEED_ADMIN_FORCE === "true" ||
      argv.includes("--reset") ||
      argv.includes("--force");
    // configurable bcrypt rounds
    const rounds =
      Number(process.env.BCRYPT_ROUNDS || process.env.BCRYPT_COST) || 10;

    // print-only / dry-run option. Accept env PRINT_ONLY=true or CLI flag --print-hash or --print-only
    const printOnly =
      process.env.PRINT_ONLY === "true" ||
      argv.includes("--print-hash") ||
      argv.includes("--print-only");

    // If print-only mode requested, just print the hash and return (no DB changes)
    if (printOnly) {
      const hash = await bcrypt.hash(password, rounds);
      console.log(hash);
      return;
    }

    // Check if user exists using repository helper
    const existing = await findByUsername(identifier);
    if (existing) {
      console.log(`User '${identifier}' already exists (id=${existing.id}).`);
      if (force) {
        // update password and role using repository helpers
        const hash = await bcrypt.hash(password, rounds);
        await updateUser(existing.id, { password_hash: hash });
        // update role separately (updateUser doesn't manage role)
        try {
          await pool.query("UPDATE users SET role = $1 WHERE id = $2", [
            role,
            existing.id,
          ]);
        } catch (e) {
          // best-effort: if role column isn't present or query fails, ignore
          console.warn(
            "Failed to update role for existing user:",
            e instanceof Error ? e.message : e,
          );
        }
        console.log(
          `Updated password and role for existing user '${identifier}'.`,
        );
        return;
      }
      console.log(
        "Use SEED_ADMIN_FORCE=true or --reset to update the password for an existing user. Nothing to do.",
      );
      return;
    }

    // Hash password and insert via repository so meta column is populated
    const hash = await bcrypt.hash(password, rounds);
    const meta = {
      fullName: process.env.SEED_ADMIN_FULLNAME,
      email: process.env.SEED_ADMIN_EMAIL || "",
    };
    const created = await createUser(identifier, hash, role, meta);
    if (!created) {
      console.error("Failed to create admin user via repository");
      return;
    }
    console.log(`Inserted admin user '${identifier}' with id=${created.id}`);
    return;
  } catch (err) {
    console.error("Failed to seed admin user:", err);
    return;
  }
};

export default seedscript;
