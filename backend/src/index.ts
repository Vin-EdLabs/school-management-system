import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/connection.js';
import authRoutes from './routes/auth.js';
import schoolRoutes from './routes/schools.js';
import studentRoutes from './routes/students.js';
import teacherRoutes from './routes/teachers.js';
import classRoutes from './routes/classes.js';
import feeRoutes from './routes/fees.js';
import paymentRoutes from './routes/payments.js';
import incomeRoutes from './routes/income.js';
import expenseRoutes from './routes/expenses.js';
import settingsRoutes from './routes/settings.js';
import auditRoutes from './routes/audit.js';
import feeCalculationsRoutes from './routes/feeCalculations.js';
import payrollRoutes from './routes/payroll.js';
import attendanceRoutes from './routes/attendance.js';
import gradesRoutes from './routes/grades.js';
import tenantRoutes from './routes/tenant.js';
import pwaRoutes from './routes/pwa.js';
import schoolRegistrationsRoutes from './routes/schoolRegistrations.js';
import supportChatRoutes from './routes/supportChat.js';
import recordsRoutes from './routes/records.js';
import reportsRoutes from './routes/reports.js';
import financeRoutes from './routes/finance.js';
import parentRoutes from './routes/parent.js';
import subjectsRoutes from './routes/subjects.js';
import eventsRoutes from './routes/events.js';
import globalChatRoutes from './routes/globalChat.js';
import conversationRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import { initSocket } from './socket.js';
import { errorHandler } from './middleware/errorHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.IO
initSocket(httpServer);

// Middleware
app.use(cors({
  origin: ['https://scholarnerve.onrender.com', 'http://localhost:8080', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TECHNERVE School Management API' });
});

// Public tenant resolution (no auth)
app.use('/api/tenant', tenantRoutes);
app.use('/api/pwa', pwaRoutes);

// School registrations (POST public, GET requires super-admin)
app.use('/api/school-registrations', schoolRegistrationsRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/fee-calculations', feeCalculationsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/support-chat', supportChatRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/global-chat', globalChatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messagesRoutes);

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
initializeDatabase()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Database connected`);
      console.log(`💬 Socket.IO initialized`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  });
