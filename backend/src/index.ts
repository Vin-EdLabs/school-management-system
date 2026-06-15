import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/connection.js';
import { startReceiptLockJob } from './jobs/receiptLockJob.js';
import { startTeacherSuspensionJob } from './jobs/teacherSuspensionJob.js';
import authRoutes from './routes/auth.js';
import schoolRoutes from './routes/schools.js';
import studentRoutes from './routes/students.js';
import teacherRoutes from './routes/teachers.js';
import otherStaffRoutes from './routes/otherStaff.js';
import classRoutes from './routes/classes.js';
import classLevelsRoutes from './routes/classLevels.js';
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
import termBudgetRoutes from './routes/termBudgets.js';
import paymentAccountsRoutes from './routes/paymentAccounts.js';
import parentRoutes from './routes/parent.js';
import subjectsRoutes from './routes/subjects.js';
import eventsRoutes from './routes/events.js';
import globalChatRoutes from './routes/globalChat.js';
import conversationRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import studentLearningRoutes from './routes/student.js';
import visitRoutes from './routes/visits.js';
import academicCycleRoutes from './routes/academicCycle.js';
import enrollmentsRoutes from './routes/enrollments.js';
import academicTermsRoutes from './routes/academicTerms.js';
import systemRoutes from './routes/system.js';
import superAnnouncementsRoutes from './routes/superAnnouncements.js';
import tenantBackupRoutes from './routes/tenantBackup.js';
import announcementsRoutes from './routes/announcements.js';
import { initSocket } from './socket.js';
import { errorHandler } from './middleware/errorHandler.js';
import { idempotencyGuard } from './middleware/idempotency.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// So req.ip and secure cookies respect X-Forwarded-For (public client IP behind Render/nginx).
if (
  process.env.TRUST_PROXY === '1' ||
  process.env.TRUST_PROXY === 'true' ||
  process.env.RENDER ||
  process.env.NODE_ENV === 'production'
) {
  app.set('trust proxy', 1);
}

// Initialize Socket.IO
initSocket(httpServer);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or direct server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // Whitelist patterns for matching root and subdomains dynamically
    const allowedPatterns = [
      /^https:\/\/([a-z0-9-]+\.)?scholarnerve\.com$/,
      /^http:\/\/([a-z0-9-]+\.)?scholarnerve\.com$/,
      /^http:\/\/([a-z0-9-]+\.)?localhost:(8080|5173|4173)$/,
      /^http:\/\/localhost:(8080|5173|4173)$/,
      /^http:\/\/([a-z0-9-]+\.)?127\.0\.0\.1:(8080|5173|4173)$/,
      /^http:\/\/127\.0\.0\.1:(8080|5173|4173)$/,
      /^http:\/\/([a-z0-9-]+\.)?lvh\.me:(8080|5173|4173)$/,
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'x-tenant-id',
    'X-Tenant-Id',
    'x-tenant-slug',
    'X-Tenant-Slug',
    'X-Forwarded-For',
    'X-Real-Ip',
    'CF-Connecting-IP',
    'X-Idempotency-Key',
  ],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', idempotencyGuard);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SCHOLARNERVE School Management API' });
});

// Public tenant resolution (no auth)
app.use('/api/tenant', tenantRoutes);
app.use('/api/pwa', pwaRoutes);
app.use('/api', visitRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/super/announcements', superAnnouncementsRoutes);
app.use('/api/announcements', announcementsRoutes);

// School registrations (POST public, GET requires super-admin)
app.use('/api/school-registrations', schoolRegistrationsRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/schools', academicCycleRoutes);
app.use('/api/super-admin/tenants', tenantBackupRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/other-staff', otherStaffRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/class-levels', classLevelsRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/academic-terms', academicTermsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/fee-calculations', feeCalculationsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/support-chat', supportChatRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/term-budgets', termBudgetRoutes);
app.use('/api/payment-accounts', paymentAccountsRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/global-chat', globalChatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/student', studentLearningRoutes);

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
initializeDatabase()
  .then(() => {
    startReceiptLockJob();
    startTeacherSuspensionJob();
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
