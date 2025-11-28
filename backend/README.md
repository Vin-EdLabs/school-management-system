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

```powershell
psql -h <db_host> -U <db_user> -d <db_name> -f db/migrations/001_init.sql
```

- Backend will be available at `http://localhost:3000` if `PORT` is set to `3000`.

Notes:
- The repository contains SQL migrations under `db/migrations`.
- After running migrations, seed an admin user by inserting a bcrypt password hash into `users` table.
- This scaffold provides repositories and services for the main domains. You should secure JWT secret, add validation, monitoring, and production deployment scaffolding before using in production.
