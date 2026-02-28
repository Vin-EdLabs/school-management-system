# Fix PostgreSQL Permissions

## Quick Fix

Run this command as PostgreSQL superuser (postgres):

```bash
psql -U postgres -d sms_db -c "GRANT ALL ON SCHEMA public TO sms_user; GRANT USAGE ON SCHEMA public TO sms_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sms_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sms_user;"
```

## Step-by-Step Fix

1. **Open PostgreSQL command line as superuser:**
   ```bash
   psql -U postgres
   ```

2. **Connect to your database:**
   ```sql
   \c sms_db
   ```

3. **Grant permissions:**
   ```sql
   GRANT ALL ON SCHEMA public TO sms_user;
   GRANT USAGE ON SCHEMA public TO sms_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sms_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sms_user;
   ```

4. **If tables already exist, grant permissions on them:**
   ```sql
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sms_user;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sms_user;
   ```

5. **Exit psql:**
   ```sql
   \q
   ```

## Using the SQL Script

Run the script **after** connecting to your database. Replace `sms_db` and `sms_user` with your actual database and app user (e.g. from `.env`: `PG_DATABASE`, `PG_USER`).

**From repo root:**
```bash
psql -U postgres -d sms_db -f backend/fix-permissions.sql
```

**From backend folder:**
```bash
cd backend
psql -U postgres -d sms_db -f fix-permissions.sql
```

Edit `fix-permissions.sql` and change `sms_user` to your app’s PostgreSQL username if different.

## After Fixing Permissions

Once permissions are fixed, restart your backend server:

```bash
cd backend
npm run dev
```

The server should now be able to create tables successfully.
