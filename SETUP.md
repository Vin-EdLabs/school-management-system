# Rosa Gardens School Management System - Setup Guide

This guide will help you set up the complete system with backend and frontend.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ installed and running
- npm or yarn package manager

## Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   Create a `.env` file in the `backend` directory with the following content:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/sms_db
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
   PORT=3001
   NODE_ENV=development
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=5242880
   ```
   
   Replace `username`, `password`, and database name with your PostgreSQL credentials.

4. **Create PostgreSQL database**
   ```bash
   createdb sms_db
   ```
   
   Or using psql:
   ```sql
   CREATE DATABASE sms_db;
   ```

5. **Start the backend server**
   ```bash
   npm run dev
   ```
   
   The server will start on `http://localhost:3001` and automatically create all database tables on first run.

## Frontend Setup

1. **Navigate to project root** (if not already there)
   ```bash
   cd ..
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the frontend development server**
   ```bash
   npm run dev
   ```
   
   The frontend will start on `http://localhost:8080` (or the port specified in vite.config.ts)

## Default Login Credentials

### Super Admin (System-wide)
- **Username**: `superadmin`
- **Password**: `superadmin123`
- **Access**: Can create and manage schools, full system access

**Important**: Change this password immediately after first login!

## Creating Your First School

1. Login as superadmin
2. Navigate to Schools section (if available in UI) or use API directly
3. Create a new school with:
   - School name
   - Admin username and password for the school
   - Optional subdomain

## API Base URL

The frontend is configured to use `http://localhost:3001/api` as the backend API base URL. If you change the backend port, update `src/services/api.ts`.

## Multi-Tenancy

The system uses a single PostgreSQL database with tenant isolation:
- Each school is a "tenant" with a unique `tenant_id`
- All data tables include `tenant_id` for data separation
- Super-admin can access any tenant's data
- Regular users can only access their own tenant's data

## File Structure

```
rosa-gardens-system-hub/
├── backend/
│   ├── src/
│   │   ├── db/          # Database connection and migrations
│   │   ├── middleware/  # Auth, error handling, tenant context
│   │   ├── routes/      # API route handlers
│   │   └── index.ts     # Server entry point
│   ├── uploads/         # Uploaded files (logos, etc.)
│   └── package.json
├── src/
│   ├── components/      # React components
│   ├── contexts/        # React contexts (Auth, Data)
│   ├── services/        # API service
│   └── ...
└── package.json
```

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Ensure database exists: `psql -l | grep sms_db`

### Port Already in Use
- Backend: Change `PORT` in `.env`
- Frontend: Change port in `vite.config.ts`

### CORS Issues
- Ensure backend CORS is configured (already set up in `backend/src/index.ts`)
- Check that frontend URL matches CORS allowed origins

### Authentication Issues
- Verify JWT_SECRET is set in `.env`
- Check that token is being stored in localStorage
- Clear browser localStorage and try logging in again

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use a strong, unique `JWT_SECRET` (32+ characters)
3. Configure PostgreSQL with SSL
4. Set up proper file storage (S3, etc.) for uploads
5. Use PM2 or similar process manager
6. Configure reverse proxy (nginx) if needed

### Frontend
1. Build for production: `npm run build`
2. Serve static files with nginx or similar
3. Configure API base URL for production backend
4. Set up HTTPS

## Support

For issues or questions, refer to:
- Backend README: `backend/README.md`
- API documentation in backend code comments
