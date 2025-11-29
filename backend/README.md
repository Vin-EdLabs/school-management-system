# Backend - School Management System

This folder contains the Express + TypeScript backend for the School Management System.

-Quick start (local):

- Copy `.env.example` to `.env` and adjust secrets.
- Install dependencies and run locally:

```powershell
cd backend
npm install
npm run dev
```

- Run migrations against your Postgres instance (example using psql):

- Using `db-migrate` (recommended): this repo includes `db-migrate` and `db-migrate-pg`.

- Create a new SQL migration (from the `backend` folder):

```powershell
# create SQL migration (uses npx db-migrate under the hood)
npm run db:create -- initialize --sql-file

# or directly with db-migrate
npx db-migrate create initialize --sql-file
```

- Edit the generated files under `migrations/sqls/` (the `-up.sql` and `-down.sql` pair), then apply the migration:

```powershell
# apply all pending migrations (dev environment)
npm run migrate:up

# rollback last migration
npm run migrate:down

# show migration status
npm run migrate:status
```

- If you prefer to use `psql` directly against a SQL file, run (example):

```powershell
psql -h <db_host> -U <db_user> -d <db_name> -f migrations/sqls/<TIMESTAMP>-initialize-up.sql
```

Backend will be available at `http://localhost:3000` if `PORT` is set to `3000`.

Notes:
- After running migrations, seed an admin user by inserting a bcrypt password hash into `users` table.
- This scaffold provides repositories and services for the main domains. You should secure JWT secret, add validation, monitoring, and production deployment scaffolding before using in production.
Notes:
- The repository contains SQL migrations under `migrations/sqls/`
- `db-migrate` will look for `database.json` or `database.js` in the `backend/` folder. You can also set environment variables: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.
- Important: do not surround `PGPASSWORD` with extra quotes in `.env` (use `PGPASSWORD=secret`, not `PGPASSWORD='secret'`).

Seeding an admin user (quick method)

1. Generate a bcrypt hash for your chosen admin password (runs in the project context):

```powershell
# run from backend/ (bcrypt is a dependency)
#$hash = node -e "const bcrypt=require('bcrypt'); console.log(bcrypt.hashSync(process.argv[1],10));" "ChangeMe123!"
```

Alternatively, create `src/scripts/seed-admin.ts` to insert the user via the app's `pg` pool and run it with `npm run seed-admin` (a `seed-admin` script exists in `package.json`).

- Run the provided smoke test script to exercise endpoints (optional):

```powershell
pwsh ./scripts/run-backend-tests.ps1
```

- Secure secrets (`.env`) and tokens before deploying to production.
