# Rosa Gardens School Management System - Backend

A comprehensive backend API for the Rosa Gardens School Management System with multi-tenancy support.

## Features

- **Multi-tenancy**: Single database with tenant isolation
- **Authentication**: JWT-based authentication with role-based access control
- **School Management**: Super-admin can create and manage multiple schools
- **Customizable Settings**: School name, logo, and class creation
- **Complete CRUD**: Students, Teachers, Classes, Fees, Payments, Income, Expenses
- **Audit Logging**: Comprehensive audit trail for all actions
- **File Upload**: Logo upload support

## Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file in the `backend` directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/sms_db
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   PORT=3001
   NODE_ENV=development
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=5242880
   ```

3. **Create Database**
   ```bash
   createdb sms_db
   ```

4. **Run Migrations**
   The database schema will be automatically created on first run. Alternatively:
   ```bash
   npm run migrate
   ```

5. **Start Server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

## Default Super Admin

- **Username**: `superadmin`
- **Password**: `superadmin123`

**Important**: Change the default password after first login!

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/me` - Get current user

### Schools (Super-admin only)
- `GET /api/schools` - List all schools
- `POST /api/schools` - Create new school
- `GET /api/schools/:id` - Get school details
- `PUT /api/schools/:id` - Update school
- `DELETE /api/schools/:id` - Delete school
- `GET /api/schools/:id/users` - Get school users
- `POST /api/schools/:id/users` - Create user for school

### Settings
- `GET /api/settings` - Get school settings
- `PUT /api/settings` - Update school settings
- `POST /api/settings/logo` - Upload logo
- `GET /api/settings/academic-terms` - Get academic terms
- `POST /api/settings/academic-terms` - Create academic term
- `PUT /api/settings/academic-terms/:id` - Update academic term
- `DELETE /api/settings/academic-terms/:id` - Delete academic term

### Students
- `GET /api/students` - List students
- `POST /api/students` - Create student
- `GET /api/students/:id` - Get student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `POST /api/students/:id/promote` - Promote student

### Teachers
- `GET /api/teachers` - List teachers
- `POST /api/teachers` - Create teacher
- `GET /api/teachers/:id` - Get teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Classes
- `GET /api/classes` - List classes
- `POST /api/classes` - Create class
- `GET /api/classes/:id` - Get class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class
- `POST /api/classes/:id/assign-students` - Assign students to class
- `POST /api/classes/:id/promote` - Promote class

### Fees
- `GET /api/fees` - List fee structures
- `POST /api/fees` - Create fee structure
- `GET /api/fees/:id` - Get fee structure
- `PUT /api/fees/:id` - Update fee structure
- `DELETE /api/fees/:id` - Delete fee structure

### Payments
- `GET /api/payments` - List payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment

### Income
- `GET /api/income` - List income records
- `POST /api/income` - Create income record
- `GET /api/income/:id` - Get income record
- `PUT /api/income/:id` - Update income record
- `DELETE /api/income/:id` - Delete income record

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `GET /api/expenses/:id` - Get expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Audit Logs
- `GET /api/audit` - List audit logs
- `GET /api/audit/:id` - Get audit log

## Multi-tenancy

The system uses a single database with tenant isolation. All data tables include a `tenant_id` column that ensures data separation between schools. The super-admin can access any tenant's data by specifying `tenantId` in the query parameters.

## Authentication

All endpoints (except `/api/auth/login` and `/api/health`) require authentication via JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

## Roles

- **super-admin**: Full system access, can manage schools
- **administrator**: School-level admin, can manage students, teachers, classes
- **finance**: Financial operations, can manage fees, payments, income, expenses
- **teacher**: Limited access to assigned classes and students

## Error Handling

All errors return JSON in the format:
```json
{
  "error": "Error message"
}
```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure PostgreSQL connection with SSL
4. Set up proper file storage for uploads
5. Configure CORS for your frontend domain
6. Use a process manager like PM2
