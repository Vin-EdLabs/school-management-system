import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export const initializeDatabase = async () => {
  try {
    // Test connection
    await query('SELECT NOW()');
    console.log('✅ Database connection established');

    // Run migrations
    await runMigrations();

    return true;
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

const runMigrations = async () => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Note: Permissions should be granted by superuser before running migrations

    // School registration requests (from landing page)
    await client.query(`
      CREATE TABLE IF NOT EXISTS school_registrations (
        id SERIAL PRIMARY KEY,
        school_name VARCHAR(255) NOT NULL,
        admin_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(100),
        message TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tenants (schools) table - multi-tenant SaaS
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE,
        subdomain VARCHAR(100) UNIQUE,
        logo_url VARCHAR(500),
        primary_color VARCHAR(20),
        secondary_color VARCHAR(20),
        subscription_status VARCHAR(50) DEFAULT 'active',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns if they don't exist (migration for existing DBs)
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE
    `).catch(() => { });
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)
    `).catch(() => { });
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20)
    `).catch(() => { });
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20)
    `).catch(() => { });
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active'
    `).catch(() => { });
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `).catch(() => { });

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('super-admin', 'administrator', 'finance', 'teacher')),
        teacher_id VARCHAR(100),
        is_primary_admin BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, username)
      )
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN DEFAULT false`).catch(() => { });
    // Set first admin per tenant as primary (for existing data)
    await client.query(`
      UPDATE users SET is_primary_admin = true WHERE id IN (
        SELECT DISTINCT ON (tenant_id) id FROM users 
        WHERE role = 'administrator' AND tenant_id IS NOT NULL 
        ORDER BY tenant_id, created_at ASC
      )
    `).catch(() => { });

    // Create school_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS school_settings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
        school_name VARCHAR(255) NOT NULL,
        address TEXT,
        contact VARCHAR(100),
        email VARCHAR(255),
        logo_url VARCHAR(500),
        current_year VARCHAR(50),
        current_term VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create academic_terms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_terms (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        term_name VARCHAR(100) NOT NULL,
        year VARCHAR(50) NOT NULL,
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create classes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        class_name VARCHAR(255) NOT NULL,
        level VARCHAR(100),
        stream VARCHAR(100),
        assigned_teacher_id INTEGER,
        max_class_size INTEGER DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create students table
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        gender VARCHAR(50),
        date_of_birth DATE,
        nationality VARCHAR(100),
        student_id VARCHAR(100) NOT NULL,
        admission_number VARCHAR(100) NOT NULL,
        class_assigned_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        guardian_name VARCHAR(255),
        guardian_contact VARCHAR(100),
        home_address TEXT,
        number_of_siblings INTEGER DEFAULT 0,
        names_of_siblings TEXT,
        previous_school TEXT,
        date_of_admission DATE,
        notes TEXT,
        passport_photo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id),
        UNIQUE(tenant_id, admission_number)
      )
    `);

    // Create teachers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        gender VARCHAR(50),
        date_of_birth DATE,
        staff_id VARCHAR(100) NOT NULL,
        phone_number VARCHAR(100),
        email VARCHAR(255),
        address TEXT,
        subjects_taught TEXT[],
        class_assigned_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        employment_date DATE,
        monthly_salary DECIMAL(10, 2),
        employment_status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, staff_id)
      )
    `);

    // Class-teachers junction: multiple teachers per class, one main
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_teachers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
        is_main BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(class_id, teacher_id)
      )
    `).catch(() => { });

    // Create subjects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50),
        level VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )
    `);

    // Create fee_structures table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_structures (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        term VARCHAR(100) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        due_date DATE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method VARCHAR(100),
        term VARCHAR(100),
        notes TEXT,
        receipt_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create receipts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        receipt_number VARCHAR(100) UNIQUE,
        receipt_details JSONB,
        issued_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create income table
    await client.query(`
      CREATE TABLE IF NOT EXISTS income (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        source VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        income_date DATE NOT NULL,
        payment_method VARCHAR(100),
        received_by VARCHAR(255),
        notes TEXT,
        description TEXT,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        amount DECIMAL(10, 2) NOT NULL,
        payee_name VARCHAR(255),
        payment_date DATE NOT NULL,
        payment_method VARCHAR(100),
        purpose TEXT,
        notes TEXT,
        description TEXT,
        vendor VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create student_arrears table for tracking outstanding fees (legacy, kept for migration)
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_arrears (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        term VARCHAR(100) NOT NULL,
        academic_year VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id, term, academic_year)
      )
    `);

    // Student arrears balance - tied to student_id only, persists across terms until fully paid
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_arrears_balance (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id)
      )
    `);

    // Payroll: other staff (non-teachers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_other_staff (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        monthly_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
        employment_status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Salary payments (monthly, for teachers + other staff)
    await client.query(`
      CREATE TABLE IF NOT EXISTS salary_payments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        payee_type VARCHAR(50) NOT NULL,
        payee_id INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        paid_date DATE,
        payment_method VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, payee_type, payee_id, month, year)
      )
    `);

    // Attendance records - daily per student
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        present BOOLEAN NOT NULL DEFAULT true,
        recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, class_id, student_id, attendance_date)
      )
    `).catch(() => { });

    // Grade assignments (quizzes, exams, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS grade_assignments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        subject VARCHAR(150) NOT NULL DEFAULT 'General',
        name VARCHAR(255) NOT NULL,
        assignment_type VARCHAR(50) DEFAULT 'Assignment',
        max_score DECIMAL(10, 2) NOT NULL DEFAULT 100,
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });

    // Migration: add subject column to existing grade_assignments tables
    await client.query(`
      ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS subject VARCHAR(150) NOT NULL DEFAULT 'General'
    `).catch(() => { });

    // Student grades
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_grades (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        assignment_id INTEGER REFERENCES grade_assignments(id) ON DELETE CASCADE,
        score DECIMAL(10, 2) NOT NULL,
        graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id, assignment_id)
      )
    `).catch(() => { });

    // Migration: add updated_at to existing student_grades tables
    await client.query(`
      ALTER TABLE student_grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `).catch(() => { });

    // Term report releases — teacher marks a class's term report as "released" for parent viewing
    await client.query(`
      CREATE TABLE IF NOT EXISTS term_report_releases (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        term VARCHAR(150) NOT NULL,
        released_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_released BOOLEAN NOT NULL DEFAULT true,
        UNIQUE(tenant_id, class_id, term)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_term_report_releases_tenant
      ON term_report_releases (tenant_id, class_id, term)
    `).catch(() => { });

    // Parent portal accounts — one per student, password defaults to their admission number
    await client.query(`
      CREATE TABLE IF NOT EXISTS parent_portal_accounts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_portal_tenant_student
      ON parent_portal_accounts (tenant_id, student_id)
    `).catch(() => { });

    // Auto-create parent accounts for any student who doesn't have one yet
    // Default password = their student_id (admission number)
    // We can't bcrypt in SQL, so we insert a placeholder and the login endpoint
    // will lazily create the real hash on first access.
    // Mark must_change_password = true so they're forced to change on first login.

    // Grade audit log — every time a score is created or changed, a row is appended here
    await client.query(`
      CREATE TABLE IF NOT EXISTS grade_audit_log (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        assignment_id INTEGER NOT NULL REFERENCES grade_assignments(id) ON DELETE CASCADE,
        old_score DECIMAL(10, 2),
        new_score DECIMAL(10, 2) NOT NULL,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grade_audit_student_assignment
      ON grade_audit_log (tenant_id, student_id, assignment_id)
    `).catch(() => { });

    // Create student_credits table for tracking overpayments
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_credits (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id)
      )
    `);

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id INTEGER,
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_teachers_tenant ON teachers(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_classes_tenant ON classes(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);
      CREATE INDEX IF NOT EXISTS idx_income_tenant ON income(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_tenant ON student_arrears(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_student ON student_arrears(student_id);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_balance_tenant ON student_arrears_balance(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_balance_student ON student_arrears_balance(student_id);
      CREATE INDEX IF NOT EXISTS idx_student_credits_tenant ON student_credits(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_student_credits_student ON student_credits(student_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_other_staff_tenant ON payroll_other_staff(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_salary_payments_tenant ON salary_payments(tenant_id);
    `);

    // Calendar Events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TIME,
        location VARCHAR(255),
        category VARCHAR(100),
        color VARCHAR(100),
        reminder BOOLEAN DEFAULT false,
        reminder_time VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date)`).catch(() => { });

    // school_registrations: internal_note for super admin
    await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS internal_note TEXT`).catch(() => { });

    // users: full_name and phone for super admins
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(100)`).catch(() => { });

    // Receipt settings in school_settings
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS receipt_prefix VARCHAR(10) DEFAULT 'R'`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS postal_address TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS receipt_footer TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS bank_details TEXT`).catch(() => { });

    // Term/academic_year for income and expenses (term-scoped reporting)
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS term VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS term VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50)`).catch(() => { });

    // Student passport photo
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS passport_photo_url VARCHAR(500)`).catch(() => { });

    // payroll_other_staff: staff_id for login (like TCH001 for teachers)
    await client.query(`ALTER TABLE payroll_other_staff ADD COLUMN IF NOT EXISTS staff_id VARCHAR(100)`).catch(() => { });
    // users: other_staff_id for payroll staff login
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS other_staff_id INTEGER`).catch(() => { });
    // Relax users role check to include 'staff'
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`).catch(() => { });
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super-admin', 'administrator', 'finance', 'teacher', 'staff'))`).catch(() => { });

    // Migrate legacy student_arrears into student_arrears_balance (student-scoped, no term)
    await client.query(`
      INSERT INTO student_arrears_balance (tenant_id, student_id, amount)
      SELECT tenant_id, student_id, SUM(amount) FROM student_arrears GROUP BY tenant_id, student_id
      ON CONFLICT (tenant_id, student_id) DO NOTHING
    `).catch(() => { });

    // Support chat messages (admin/finance from tenants ↔ super-admin)
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        sender_role VARCHAR(50) NOT NULL,
        sender_username VARCHAR(100) NOT NULL,
        tenant_name VARCHAR(255),
        message TEXT,
        image_url VARCHAR(500),
        is_from_superadmin BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS global_chat_messages (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        tenant_name VARCHAR(255),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(100) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        channel VARCHAR(50) DEFAULT 'general',
        reply_to_id INTEGER REFERENCES global_chat_messages(id) ON DELETE SET NULL,
        forwarded_from_id INTEGER REFERENCES global_chat_messages(id) ON DELETE SET NULL,
        is_deleted BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Private Messaging Infrastructure
    await client.query(`
      CREATE TABLE IF NOT EXISTS private_conversations (
        id SERIAL PRIMARY KEY,
        participant_a INTEGER REFERENCES users(id) ON DELETE CASCADE,
        participant_b INTEGER REFERENCES users(id) ON DELETE CASCADE,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(participant_a, participant_b)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES private_conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        reply_to_id INTEGER REFERENCES private_messages(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE global_chat_messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE global_chat_messages ADD COLUMN IF NOT EXISTS forwarded_from_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE global_chat_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`).catch(() => { });
    await client.query(`ALTER TABLE global_chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_global_chat_channel ON global_chat_messages(channel)`).catch(() => { });

    // Receipt number sequence per tenant (R + 8 digits)
    await client.query(`
      CREATE TABLE IF NOT EXISTS receipt_number_seq (
        tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        last_number INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ----- SIMPLE TERM ARREARS TABLE -----
    // Stores carried-forward arrears per student per current term (string-based, no IDs).
    // One row per student per current term. Populated by the "Carry Arrears" button.
    await client.query(`
      CREATE TABLE IF NOT EXISTS term_arrears (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        current_term VARCHAR(150) NOT NULL,
        from_term VARCHAR(150),
        amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id, current_term)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_term_arrears_tenant_term ON term_arrears(tenant_id, current_term)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_term_arrears_student ON term_arrears(student_id)`).catch(() => { });

    // ----- LEDGER-BASED FINANCE (kept for reference, not used by UI) -----
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS carry_forward_balance BOOLEAN DEFAULT true`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        is_current BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_academic_years_tenant ON academic_years(tenant_id)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS terms (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        is_current BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, academic_year_id, name)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_terms_tenant ON terms(tenant_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_terms_academic_year ON terms(academic_year_id)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS ledger_fee_structures (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
        tuition_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
        pta_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
        exam_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total NUMERIC(12, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, class_id, academic_year_id, term_id)
      )
    `);

    // Create term_outstanding_balances table - stores outstanding balance per term per student
    // This is the SOURCE OF TRUTH for what gets carried forward as arrears
    await client.query(`
      CREATE TABLE IF NOT EXISTS term_outstanding_balances (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, term_id, student_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_term_outstanding_tenant_term ON term_outstanding_balances(tenant_id, term_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_term_outstanding_student ON term_outstanding_balances(student_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ledger_fee_structures_tenant ON ledger_fee_structures(tenant_id)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_ledger (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        entry_type VARCHAR(50) NOT NULL DEFAULT 'payment',
        debit NUMERIC(12, 2) NOT NULL DEFAULT 0,
        credit NUMERIC(12, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        receipt_number VARCHAR(100),
        payment_method VARCHAR(100)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_ledger_tenant ON student_ledger(tenant_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_ledger_student ON student_ledger(student_id)`).catch(() => { });
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_ledger_term_fee_once
      ON student_ledger (tenant_id, student_id, academic_year_id, term_id)
      WHERE entry_type = 'term_fee'
    `).catch(() => { });

    // Create default super-admin if it doesn't exist
    const superAdminCheck = await client.query(
      'SELECT id FROM users WHERE username = $1 AND role = $2',
      ['superadmin', 'super-admin']
    );

    if (superAdminCheck.rows.length === 0) {
      const defaultPassword = await bcrypt.hash('superadmin123', 10);
      await client.query(
        'INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, NULL)',
        ['superadmin', defaultPassword, 'super-admin']
      );
      console.log('✅ Default super-admin created (username: superadmin, password: superadmin123)');
    }

    // Create default Rosa tenant if none exist
    const tenantCheck = await client.query('SELECT id FROM tenants LIMIT 1');
    if (tenantCheck.rows.length === 0) {
      const rosaResult = await client.query(
        `INSERT INTO tenants (name, slug, subdomain, is_active, subscription_status)
         VALUES ('Rosa Gardens', 'rosa', 'rosa', true, 'active') RETURNING id`
      );
      const rosaId = rosaResult.rows[0].id;
      await client.query(
        'INSERT INTO school_settings (tenant_id, school_name) VALUES ($1, $2)',
        [rosaId, 'Rosa Gardens']
      );
      const rosaAdminPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (tenant_id, username, password_hash, role, is_primary_admin) VALUES ($1, $2, $3, $4, true)',
        [rosaId, 'admin', rosaAdminPassword, 'administrator']
      );
      console.log('✅ Default tenant (Rosa Gardens) created - login: admin / admin123');
      // Seed ledger: one academic year and one term for the new tenant
      const ay = await client.query(
        'INSERT INTO academic_years (tenant_id, name, is_current) VALUES ($1, $2, true) RETURNING id',
        [rosaId, new Date().getFullYear().toString()]
      );
      const ayId = ay.rows[0].id;
      await client.query(
        'INSERT INTO terms (tenant_id, academic_year_id, name, is_current) VALUES ($1, $2, $3, true)',
        [rosaId, ayId, 'Term 1']
      );
    }

    // Ensure existing tenants have at least one academic year and term for ledger (if tables exist)
    const tenants = await client.query('SELECT id FROM tenants');
    for (const t of tenants.rows) {
      const tid = t.id;
      const hasYear = await client.query('SELECT 1 FROM academic_years WHERE tenant_id = $1 LIMIT 1', [tid]);
      if (hasYear.rows.length === 0) {
        const ay = await client.query(
          'INSERT INTO academic_years (tenant_id, name, is_current) VALUES ($1, $2, true) RETURNING id',
          [tid, new Date().getFullYear().toString()]
        );
        await client.query(
          'INSERT INTO terms (tenant_id, academic_year_id, name, is_current) VALUES ($1, $2, $3, true)',
          [tid, ay.rows[0].id, 'Term 1']
        ).catch(() => { });
      }
    }

    await client.query('COMMIT');
    console.log('✅ Database migrations completed');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
