# Complete Setup Instructions

## Quick Start Guide

### 1. Database Setup

**Create PostgreSQL Database:**
```bash
# Windows (PowerShell)
createdb sms_db

# Or using psql
psql -U postgres
CREATE DATABASE sms_db;
\q
```

**Or use the SQL script:**
```bash
psql -U postgres -f backend/create-db.sql
```

### 2. Backend Setup

**Navigate to backend directory:**
```bash
cd backend
```

**Install dependencies:**
```bash
npm install
```

**Configure environment:**
Create a `.env` file in the `backend` directory (already created, just update with your database credentials):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sms_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-characters-long
PORT=3001
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

**Update DATABASE_URL** with your PostgreSQL username and password:
- Replace `postgres:postgres` with `your_username:your_password`
- Replace `localhost:5432` if your PostgreSQL is on a different host/port

**Start the backend server:**
```bash
npm run dev
```

The server will:
- Automatically create all database tables on first run
- Create default super-admin account (username: `superadmin`, password: `superadmin123`)
- Start on `http://localhost:3001`

### 3. Frontend Setup

**Navigate to project root:**
```bash
cd ..
```

**Install dependencies (if not already done):**
```bash
npm install
```

**Start the frontend:**
```bash
npm run dev
```

The frontend will start on `http://localhost:8080` (or the port in vite.config.ts)

### 4. First Login

1. Open `http://localhost:8080` in your browser
2. Login with:
   - **Username**: `superadmin`
   - **Password**: `superadmin123`
   - **Role**: Super Admin

3. **IMPORTANT**: Change the super-admin password immediately after first login!

### 5. Create Your First School

1. After logging in as superadmin, you can create schools
2. Each school will have its own isolated data
3. Create an administrator account for each school

## Features Implemented

### ✅ Multi-Tenancy
- Single database with tenant isolation
- Super-admin can create and manage multiple schools
- Complete data separation between schools

### ✅ Fee Management
- Accurate fee calculations with arrears tracking
- Credit balance for overpayments
- Automatic carryover when students move classes
- Automatic carryover when academic terms change
- Receipt generation with accurate balances

### ✅ Student Management
- Student promotion with fee carryover
- Class promotion with fee carryover
- All student data tied to student ID
- Automatic arrears calculation

### ✅ Settings
- Customizable school name
- Logo upload
- Academic term management
- Class creation

## Troubleshooting

### Backend won't start

**Error: `tsx` is not recognized**
- Solution: Use `npm run dev` which uses the start-server.js script

**Error: Database connection failed**
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `.env` file
- Ensure database exists: `psql -l | grep sms_db`

**Error: Port already in use**
- Change PORT in `.env` file
- Or kill the process using the port

### Frontend can't connect to backend

- Verify backend is running on port 3001
- Check API base URL in `src/services/api.ts`
- Check browser console for CORS errors
- Ensure backend CORS is configured (already done)

### Database tables not created

- Check backend logs for migration errors
- Verify database connection string
- Check PostgreSQL user has CREATE TABLE permissions
- Manually run migrations if needed

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (32+ characters)
3. Configure PostgreSQL with SSL
4. Set up proper file storage for uploads
5. Use PM2 or similar process manager

### Frontend
1. Build: `npm run build`
2. Serve static files with nginx
3. Configure API base URL for production
4. Set up HTTPS

## Support

For issues:
- Check backend logs in terminal
- Check browser console for frontend errors
- Verify database connection
- Check .env file configuration
