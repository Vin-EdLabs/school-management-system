import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { applyPendingSqlFileMigrations } from './fileMigrations.js';
import { ensureSupplementalSchema } from './ensureSchema.js';

dotenv.config();

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.PG_HOST,
        port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
);

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error: any) {
    console.error('Database query error:', {
      message: error?.message,
      code: error?.code,
      table: error?.table,
      position: error?.position,
      queryPreview: text.length > 300 ? `${text.slice(0, 300)}…` : text,
    });
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
    await ensureSupplementalSchema();
    try {
      await applyPendingSqlFileMigrations();
    } catch (migrationErr: any) {
      console.error('⚠️ SQL file migrations warning:', migrationErr?.message || migrationErr);
    }

    return true;
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

const runMigrations = async () => {
  const client = await getClient();

  try {
    // Do not wrap all compatibility migrations in one transaction.
    // This file intentionally tolerates many ALTER failures with .catch(() => {}),
    // and PostgreSQL would mark the whole transaction as aborted after the first error.

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        visitor_id VARCHAR(120) NOT NULL UNIQUE,
        page VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits(visitor_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visits_page ON visits(page)`).catch(() => { });

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
      ALTER TABLE tenants ALTER COLUMN logo_url TYPE TEXT
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
    // Legacy schema compatibility for users table
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS other_staff_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN DEFAULT false`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await client.query(`UPDATE users SET is_active = true WHERE is_active IS NULL`).catch(() => { });
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
        logo_url TEXT,
        current_year VARCHAR(50),
        current_term VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE school_settings ALTER COLUMN logo_url TYPE TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS email VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS grade_scale JSONB DEFAULT NULL`).catch(() => { });

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
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(
      `ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`
    ).catch(() => { });
    await client.query(
      `UPDATE academic_terms SET is_archived = false WHERE is_archived IS NULL`
    ).catch(() => { });

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
    // Legacy schema compatibility for classes table
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS level VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS stream VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS assigned_teacher_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_class_size INTEGER DEFAULT 30`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await client.query(`UPDATE classes SET class_name = name WHERE class_name IS NULL AND name IS NOT NULL`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS level_order INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_final_class BOOLEAN NOT NULL DEFAULT false`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_setup_progress (
        id SERIAL PRIMARY KEY,
        school_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        has_subjects BOOLEAN NOT NULL DEFAULT false,
        has_classes BOOLEAN NOT NULL DEFAULT false,
        has_terms BOOLEAN NOT NULL DEFAULT false,
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });

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
        passport_photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id),
        UNIQUE(tenant_id, admission_number)
      )
    `);
    // Legacy schema compatibility for students table
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS class_assigned_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS student_id VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(50)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_contact VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_2_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_2_contact VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_2_relationship VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS home_address TEXT`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS number_of_siblings INTEGER DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS names_of_siblings TEXT`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_school TEXT`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_admission DATE`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS passport_photo_url TEXT`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS is_beneficiary BOOLEAN DEFAULT false`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS beneficiary_type VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS beneficiary_notes TEXT`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await client.query(
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(50) DEFAULT 'active'`
    ).catch(() => { });
    await client.query(`UPDATE students SET enrollment_status = 'active' WHERE enrollment_status IS NULL`).catch(() => { });
    await client.query(`UPDATE students SET class_assigned_id = class_id WHERE class_assigned_id IS NULL AND class_id IS NOT NULL`).catch(() => { });
    await client.query(`ALTER TABLE students ALTER COLUMN passport_photo_url TYPE TEXT`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS is_beneficiary BOOLEAN DEFAULT false`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS beneficiary_type VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) CHECK (discount_type IN ('percentage', 'fixed'))`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS beneficiary_notes TEXT`).catch(() => { });

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
    // Legacy schema compatibility for teachers table
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS class_assigned_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(10, 2) DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'active'`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS staff_id VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS signature TEXT`).catch(() => { });
    await client.query(`UPDATE teachers SET class_assigned_id = class_id WHERE class_assigned_id IS NULL AND class_id IS NOT NULL`).catch(() => { });

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

    // Teacher subject-class junction: subject taught in specific class context
    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_subject_classes (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, teacher_id, subject_id, class_id)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teacher_subject_classes_teacher
      ON teacher_subject_classes (tenant_id, teacher_id)
    `).catch(() => { });

    // Per-school extra class levels (dropdown); standard levels are defined in API (DEFAULT_CLASS_LEVELS)
    await client.query(`
      CREATE TABLE IF NOT EXISTS school_class_levels (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS school_class_levels_tenant_name_lower
      ON school_class_levels (tenant_id, lower(trim(name)))
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
    // Legacy schema compatibility for fee_structures table
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS class_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS term VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2)`).catch(() => { });
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS due_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => { });
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await client.query(`ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });

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
    // Legacy schema compatibility for payments table
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS term VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2)`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP`).catch(() => { });
    await client.query(`UPDATE payments SET amount_paid = amount WHERE amount_paid IS NULL AND amount IS NOT NULL`).catch(() => { });
    await client.query(`UPDATE payments SET payment_date = created_at WHERE payment_date IS NULL AND created_at IS NOT NULL`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_snapshot JSONB`).catch(() => { });
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_term ON payments(tenant_id, term_id)`).catch(() => { });
    await client.query(`
      UPDATE payments p SET term_id = sl.term_id
      FROM student_ledger sl
      WHERE sl.payment_id = p.id AND p.term_id IS NULL AND sl.term_id IS NOT NULL
    `).catch(() => { });

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
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS income_date TIMESTAMP`).catch(() => { });
    await client.query(`UPDATE income SET income_date = created_at WHERE income_date IS NULL AND created_at IS NOT NULL`).catch(() => { });
    // Legacy DBs may have an older income table without these columns (CREATE IF NOT EXISTS skips them)
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS source VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS received_by VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS category VARCHAR(100)`).catch(() => { });
    await client.query(`UPDATE income SET source = title WHERE source IS NULL AND title IS NOT NULL`).catch(() => { });
    await client.query(`UPDATE income SET source = description WHERE source IS NULL AND description IS NOT NULL`).catch(() => { });

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
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP`).catch(() => { });
    await client.query(`UPDATE expenses SET payment_date = created_at WHERE payment_date IS NULL AND created_at IS NOT NULL`).catch(() => { });
    // Legacy DBs may have been created without `title` (payroll and expenses API expect it)
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title VARCHAR(255)`).catch(() => { });
    await client.query(`
      UPDATE expenses SET title = LEFT(COALESCE(NULLIF(TRIM(title), ''), description, notes, purpose, 'Expense'), 255)
      WHERE title IS NULL OR TRIM(COALESCE(title, '')) = ''
    `).catch(() => { });
    // Older installs may predate these columns; payroll + finance POST require them
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purpose TEXT`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor VARCHAR(255)`).catch(() => { });

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

    // Non-teaching staff (other_staff)
    await client.query(`
      CREATE TABLE IF NOT EXISTS other_staff (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        staff_id VARCHAR(100) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        gender VARCHAR(50),
        date_of_birth DATE,
        passport_photo_url TEXT,
        phone_number VARCHAR(100),
        email VARCHAR(255),
        home_address TEXT,
        national_id VARCHAR(100),
        position VARCHAR(255),
        department VARCHAR(255),
        employment_type VARCHAR(50),
        employment_date DATE,
        monthly_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
        ssnit_number VARCHAR(100),
        ssnit_enabled BOOLEAN DEFAULT false,
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(100),
        emergency_contact_relationship VARCHAR(100),
        bank_name VARCHAR(255),
        bank_account_number VARCHAR(100),
        bank_branch VARCHAR(255),
        bank_account_name VARCHAR(255),
        employment_status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, staff_id)
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
    await client.query(`
      ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS term VARCHAR(150)
    `).catch(() => { });
    await client.query(`
      ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50)
    `).catch(() => { });
    await client.query(`
      UPDATE grade_assignments ga
      SET
        term = COALESCE(NULLIF(TRIM(ga.term), ''), ss.current_term),
        academic_year = COALESCE(NULLIF(TRIM(ga.academic_year), ''), ss.current_year)
      FROM school_settings ss
      WHERE ga.tenant_id = ss.tenant_id
        AND (ga.term IS NULL OR TRIM(ga.term) = '' OR ga.academic_year IS NULL OR TRIM(ga.academic_year) = '')
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_grade_assignments_term
      ON grade_assignments (tenant_id, class_id, term, academic_year)
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS term_report_comments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        term VARCHAR(150) NOT NULL,
        academic_year VARCHAR(50) NOT NULL,
        subject VARCHAR(150),
        remark_type VARCHAR(50) NOT NULL,
        remark TEXT,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id, class_id, term, academic_year, subject, remark_type)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_term_report_comments_student
      ON term_report_comments (tenant_id, student_id, class_id, term, academic_year, remark_type)
    `).catch(() => { });
    await client.query(`
      UPDATE term_report_comments SET subject = '' WHERE subject IS NULL
    `).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS report_card_archive (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        academic_year VARCHAR(50) NOT NULL,
        term VARCHAR(150) NOT NULL,
        class_name VARCHAR(255),
        student_admission_number VARCHAR(100),
        student_first_name VARCHAR(255),
        student_last_name VARCHAR(255),
        snapshot_json JSONB NOT NULL,
        grades_snapshot JSONB,
        remarks_snapshot JSONB,
        signatures_snapshot JSONB,
        html_snapshot TEXT,
        position INTEGER,
        percentage NUMERIC(6, 2),
        grand_total NUMERIC(10, 2),
        released_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        released_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, student_id, term, academic_year)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_report_card_archive_student
      ON report_card_archive (tenant_id, student_id, academic_year DESC, term)
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_report_card_archive_class_term
      ON report_card_archive (tenant_id, class_id, term, academic_year)
    `).catch(() => { });

    // Parent portal accounts — one per student, password defaults to their admission number
    await client.query(`
      CREATE TABLE IF NOT EXISTS parent_portal_accounts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_portal_tenant_student
      ON parent_portal_accounts (tenant_id, student_id)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS parent_portal_family_groups (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_portal_family_groups_tenant
      ON parent_portal_family_groups (tenant_id)
    `).catch(() => { });
    await client.query(`
      ALTER TABLE parent_portal_accounts
      ADD COLUMN IF NOT EXISTS family_group_id INTEGER REFERENCES parent_portal_family_groups(id) ON DELETE SET NULL
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_portal_accounts_family_group
      ON parent_portal_accounts (tenant_id, family_group_id)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS parent_push_subscriptions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        parent_account_id INTEGER NOT NULL REFERENCES parent_portal_accounts(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(parent_account_id, endpoint)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_push_subscriptions_parent
      ON parent_push_subscriptions (parent_account_id)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_user_push_subscriptions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, endpoint)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_user_push_tenant
      ON staff_user_push_subscriptions (tenant_id)
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_user_push_user
      ON staff_user_push_subscriptions (user_id)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS parent_fcm_tokens (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        parent_account_id INTEGER NOT NULL REFERENCES parent_portal_accounts(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(parent_account_id, token)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_fcm_tokens_parent
      ON parent_fcm_tokens (parent_account_id)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS parent_notifications (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        parent_account_id INTEGER NOT NULL REFERENCES parent_portal_accounts(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        url TEXT,
        icon TEXT,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent
      ON parent_notifications (parent_account_id, created_at DESC)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_questions (
        id SERIAL PRIMARY KEY,
        class_level VARCHAR(20) NOT NULL,
        subject VARCHAR(50) NOT NULL,
        term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option VARCHAR(1) NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
        question_source VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (question_source IN ('system', 'teacher')),
        school_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_learning_questions_lookup
      ON learning_questions (class_level, subject, term, is_active)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_teacher_quizzes (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        teacher_name VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        due_date DATE,
        is_published BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_learning_teacher_quizzes_class
      ON learning_teacher_quizzes (tenant_id, class_id, due_date)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_teacher_quiz_questions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        teacher_quiz_id INTEGER NOT NULL REFERENCES learning_teacher_quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option VARCHAR(1) NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
        marks INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      ALTER TABLE learning_teacher_quiz_questions
      ADD COLUMN IF NOT EXISTS marks INTEGER NOT NULL DEFAULT 1
    `).catch(() => { });
    await client.query(`
      ALTER TABLE learning_teacher_quiz_questions
      ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) NOT NULL DEFAULT 'mcq'
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_teacher_question_bank (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        question_type VARCHAR(20) NOT NULL DEFAULT 'mcq',
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL DEFAULT '',
        option_d TEXT NOT NULL DEFAULT '',
        correct_option VARCHAR(1) NOT NULL,
        marks INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_learning_question_bank_teacher
      ON learning_teacher_question_bank (tenant_id, teacher_user_id, subject)
    `).catch(() => { });
    await client.query(`
      ALTER TABLE learning_teacher_question_bank
      ADD COLUMN IF NOT EXISTS item_title VARCHAR(200)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        class_level VARCHAR(20) NOT NULL,
        source VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (source IN ('daily', 'teacher')),
        teacher_quiz_id INTEGER REFERENCES learning_teacher_quizzes(id) ON DELETE SET NULL,
        total_questions INTEGER NOT NULL,
        correct_answers INTEGER NOT NULL,
        points_earned INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_weekly
      ON quiz_sessions (tenant_id, student_id, completed_at DESC)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_points (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        total_points INTEGER NOT NULL DEFAULT 0,
        weekly_points INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        last_quiz_date DATE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id)
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_points_tenant
      ON student_points (tenant_id, student_id)
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_teacher_quiz_attempts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        teacher_quiz_id INTEGER NOT NULL REFERENCES learning_teacher_quizzes(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        score INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL DEFAULT 0,
        correct_answers INTEGER NOT NULL DEFAULT 0,
        wrong_answers INTEGER NOT NULL DEFAULT 0,
        total_marks INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(teacher_quiz_id, student_id)
      )
    `).catch(() => { });
    await client.query(`ALTER TABLE learning_teacher_quiz_attempts ADD COLUMN IF NOT EXISTS correct_answers INTEGER NOT NULL DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE learning_teacher_quiz_attempts ADD COLUMN IF NOT EXISTS wrong_answers INTEGER NOT NULL DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE learning_teacher_quiz_attempts ADD COLUMN IF NOT EXISTS total_marks INTEGER NOT NULL DEFAULT 0`).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS parent_messages (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        parent_account_id INTEGER NOT NULL REFERENCES parent_portal_accounts(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('absence', 'fee', 'academic', 'teacher', 'late', 'general')),
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        attachment_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'urgent')),
        is_read_by_school BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_replies (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES parent_messages(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('parent', 'school')),
        reply_text TEXT NOT NULL,
        attachment_url TEXT,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parent_messages_parent
      ON parent_messages (parent_account_id, created_at DESC)
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_message_replies_message
      ON message_replies (message_id, created_at ASC)
    `).catch(() => { });
    await client.query(`
      ALTER TABLE parent_portal_accounts
      ADD COLUMN IF NOT EXISTS unread_replies_count INTEGER DEFAULT 0
    `).catch(() => { });
    await client.query(`
      ALTER TABLE parent_portal_accounts
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
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
        before_values JSONB,
        after_values JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Real-time presence for super-admin "Online Users" (shared across PM2 workers / proxies)
    await client.query(`
      CREATE TABLE IF NOT EXISTS active_socket_sessions (
        socket_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        username TEXT NOT NULL,
        full_name TEXT,
        role TEXT NOT NULL,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_active_socket_sessions_user ON active_socket_sessions(user_id)
    `).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_active_socket_sessions_last_seen ON active_socket_sessions(last_seen_at)
    `).catch(() => { });

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
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(tenant_id, module);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_tenant ON student_arrears(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_student ON student_arrears(student_id);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_balance_tenant ON student_arrears_balance(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_student_arrears_balance_student ON student_arrears_balance(student_id);
      CREATE INDEX IF NOT EXISTS idx_student_credits_tenant ON student_credits(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_student_credits_student ON student_credits(student_id);
      CREATE INDEX IF NOT EXISTS idx_other_staff_tenant ON other_staff(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_salary_payments_tenant ON salary_payments(tenant_id);
    `).catch(() => { });

    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(120)`).catch(() => { });
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'success'`).catch(() => { });
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS summary TEXT`).catch(() => { });
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role VARCHAR(64)`).catch(() => { });
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_values JSONB`).catch(() => { });
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_values JSONB`).catch(() => { });
    await client.query(`UPDATE audit_logs SET status = 'success' WHERE status IS NULL`).catch(() => { });

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`).catch(() => { });

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
    // Legacy schema compatibility for events table
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time TIME`).catch(() => { });
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await client.query(`UPDATE events SET event_date = date::date WHERE event_date IS NULL AND date IS NOT NULL`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date)`).catch(() => { });

    // school_registrations: internal_note for super admin
    await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS internal_note TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL`).catch(() => { });
    await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS generated_password VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS generated_username VARCHAR(100)`).catch(() => { });

    // users: full_name and phone for super admins
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(100)`).catch(() => { });

    // Receipt settings in school_settings
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS receipt_prefix VARCHAR(10) DEFAULT 'R'`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS postal_address TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS receipt_footer TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS bank_details TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS phone_number VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS office_hours VARCHAR(150)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS physical_address TEXT`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_latitude NUMERIC(10, 7)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_longitude NUMERIC(10, 7)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_location_label VARCHAR(255)`).catch(() => { });

    // Term/academic_year for income and expenses (term-scoped reporting)
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS term VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50)`).catch(() => { });
    await client.query(`ALTER TABLE income ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS term VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50)`).catch(() => { });

    // Student passport photo
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS passport_photo_url VARCHAR(500)`).catch(() => { });

    // Teacher passport photo + status management + appointment letters
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS passport_photo_url TEXT`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status_reason TEXT`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status_changed_by INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS suspension_start_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS suspension_end_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deactivation_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS appointment_letter_config JSONB DEFAULT '{}'::jsonb`).catch(() => { });
    await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS admission_letter_config JSONB DEFAULT '{}'::jsonb`).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_appointment_letters (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL DEFAULT 1,
        reference_number VARCHAR(80),
        position_title VARCHAR(255),
        employment_type VARCHAR(80),
        monthly_salary NUMERIC(12, 2),
        letter_content JSONB NOT NULL DEFAULT '{}'::jsonb,
        pdf_data TEXT,
        generated_by INTEGER REFERENCES users(id),
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, teacher_id, version_number)
      )
    `).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS role VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS department VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS start_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS probation_period VARCHAR(120)`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS working_hours VARCHAR(120)`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS leave_entitlement VARCHAR(120)`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS notice_period VARCHAR(120)`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS body_opening TEXT`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS body_closing TEXT`).catch(() => { });
    await client.query(`ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS letter_date DATE`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_admission_letters (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        student_id INTEGER NOT NULL REFERENCES students(id),
        version_number INTEGER DEFAULT 1,
        reference_number TEXT,
        letter_content JSONB DEFAULT '{}'::jsonb,
        pdf_data TEXT,
        generated_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });

    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100)`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255)`).catch(() => { });
    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255)`).catch(() => { });
    // users: other_staff_id for non-teaching staff login
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS other_staff_id INTEGER`).catch(() => { });
    // Relax users role check to include 'staff'
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`).catch(() => { });
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super-admin', 'administrator', 'finance', 'teacher', 'staff'))`).catch(() => { });

    // Payroll settings (per tenant)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_settings (
        tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        default_ssnit_percent NUMERIC(8, 4) NOT NULL DEFAULT 5.5,
        currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
        payroll_generation_day SMALLINT NOT NULL DEFAULT 1,
        auto_generate_payroll BOOLEAN NOT NULL DEFAULT false,
        payslip_footer_text TEXT,
        payslip_signature_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });

    await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS ssnit_enabled BOOLEAN NOT NULL DEFAULT true`).catch(() => { });
    await client.query(`ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS ssnit_enabled BOOLEAN NOT NULL DEFAULT true`).catch(() => { });

    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12, 2)`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS ssnit_percent NUMERIC(8, 4)`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS ssnit_amount NUMERIC(12, 2)`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS ssnit_manual_amount NUMERIC(10, 2)`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS allowances NUMERIC(12, 2) NOT NULL DEFAULT 0`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS net_salary NUMERIC(12, 2)`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS payroll_notes TEXT`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS expense_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => { });
    await client.query(
      `ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS gross_manual BOOLEAN NOT NULL DEFAULT false`
    ).catch(() => { });

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE salary_payments
          ADD CONSTRAINT salary_payments_expense_id_fkey
          FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `).catch(() => { });

    // Remove duplicate period rows (keeps newest id) so a unique index can be created
    await client.query(`
      DELETE FROM salary_payments sp
      WHERE EXISTS (
        SELECT 1 FROM salary_payments sp2
        WHERE sp2.tenant_id = sp.tenant_id
          AND sp2.payee_type = sp.payee_type
          AND sp2.payee_id = sp.payee_id
          AND sp2.month = sp.month
          AND sp2.year = sp.year
          AND sp2.id > sp.id
      )
    `).catch((e) => console.warn('[migration] salary_payments dedupe:', (e as Error).message));

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_payments_period
      ON salary_payments(tenant_id, payee_type, payee_id, month, year)
    `).catch((e) => console.warn('[migration] uq_salary_payments_period:', (e as Error).message));

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
        image_url TEXT,
        is_from_superadmin BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE support_messages ALTER COLUMN image_url TYPE TEXT`).catch(() => { });
    // Super-admin replies were incorrectly inserted with read_at set; school-unread uses read_at on SA rows.
    await client
      .query(`UPDATE support_messages SET read_at = NULL WHERE is_from_superadmin = true`)
      .catch(() => { });
    await client.query(`ALTER TABLE global_chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT`).catch(() => { });
    await client.query(`ALTER TABLE global_chat_messages ALTER COLUMN media_url TYPE TEXT`).catch(() => { });

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS global_chat_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES global_chat_messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, emoji)
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_global_chat_reactions_message ON global_chat_reactions(message_id)`).catch(() => { });

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
    await client.query(`ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS start_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS end_date DATE`).catch(() => { });
    await client.query(`ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`).catch(() => { });

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
    await client.query(`ALTER TABLE terms ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`).catch(() => { });
    await client.query(`ALTER TABLE terms ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`).catch(() => { });
    await client.query(`ALTER TABLE terms ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`).catch(() => { });
    await client.query(`ALTER TABLE terms ADD COLUMN IF NOT EXISTS snapshot_completed_at TIMESTAMP`).catch(() => { });
    await client.query(`UPDATE terms SET status = 'active' WHERE status IS NULL`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS term_snapshots (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE,
        academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
        snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        total_students INTEGER,
        total_fees_billed NUMERIC(12, 2),
        total_collected NUMERIC(12, 2),
        total_outstanding NUMERIC(12, 2),
        total_credits NUMERIC(12, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_term_snapshots_tenant_term ON term_snapshots(tenant_id, term_id)`).catch(() => { });

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
      CREATE TABLE IF NOT EXISTS fee_structure_items (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        fee_structure_id INTEGER NOT NULL REFERENCES ledger_fee_structures(id) ON DELETE CASCADE,
        item_name VARCHAR(255) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(fee_structure_id, item_name)
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fsi_tenant ON fee_structure_items(tenant_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fsi_fee_structure ON fee_structure_items(fee_structure_id)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_charges (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
        description VARCHAR(500) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        reason TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
        paid_at TIMESTAMP,
        ledger_entry_id INTEGER,
        payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_charges_tenant ON student_charges(tenant_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_charges_student ON student_charges(student_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_charges_term ON student_charges(term_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_charges_status ON student_charges(status)`).catch(() => { });

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

    // Manual balance override / audit fields (append-only ledger adjustments)
    await client.query(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS adjustment_category VARCHAR(120)`).catch(() => { });
    await client.query(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS adjustment_notes TEXT`).catch(() => { });
    await client.query(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS supporting_document_url TEXT`).catch(() => { });
    await client.query(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER`).catch(() => { });
    await client.query(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(12, 2)`).catch(() => { });
    await client.query(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS period_label VARCHAR(200)`).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_student_ledger_manual_adj
      ON student_ledger (tenant_id, created_at DESC)
      WHERE entry_type = 'manual_adjustment'
    `).catch(() => { });

    // Detect legacy schemas that do not have users.tenant_id
    const usersTenantCol = await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id' LIMIT 1"
    ).catch(() => ({ rows: [] as any[] }));
    const hasUsersTenantId = usersTenantCol.rows.length > 0;

    // Create default super-admin if it doesn't exist
    const superAdminCheck = await client.query(
      'SELECT id FROM users WHERE username = $1 AND role = $2',
      ['superadmin', 'super-admin']
    );

    if (superAdminCheck.rows.length === 0) {
      const defaultPassword = await bcrypt.hash('superadmin123', 10);
      if (hasUsersTenantId) {
        await client.query(
          'INSERT INTO users (username, password_hash, role, tenant_id) VALUES ($1, $2, $3, NULL)',
          ['superadmin', defaultPassword, 'super-admin']
        );
      } else {
        await client.query(
          'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
          ['superadmin', defaultPassword, 'super-admin']
        );
      }
      console.log('✅ Default super-admin created (username: superadmin, password: superadmin123)');
    }

    // Create default Rosa tenant if none exist
    const tenantCheck = await client.query('SELECT id FROM tenants LIMIT 1').catch(() => ({ rows: [] as any[] }));
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
      if (hasUsersTenantId) {
        await client.query(
          'INSERT INTO users (tenant_id, username, password_hash, role, is_primary_admin) VALUES ($1, $2, $3, $4, true)',
          [rosaId, 'admin', rosaAdminPassword, 'administrator']
        );
      } else {
        console.log('ℹ️ Skipping tenant-bound default admin creation on legacy users schema');
      }
      console.log('✅ Default tenant (Rosa Gardens) created - login: admin / admin123');
      // Seed ledger: one academic year and one term for the new tenant
      const yearStart = new Date().getFullYear();
      const yearLabel = `${yearStart}/${yearStart + 1}`;
      const ay = await client.query(
        'INSERT INTO academic_years (tenant_id, name, is_current) VALUES ($1, $2, true) RETURNING id',
        [rosaId, yearLabel]
      );
      const ayId = ay.rows[0].id;
      await client.query(
        'INSERT INTO terms (tenant_id, academic_year_id, name, is_current) VALUES ($1, $2, $3, true)',
        [rosaId, ayId, 'Term 1']
      );
    }

    // Ensure existing tenants have at least one academic year and term for ledger (if tables exist)
    const tenants = await client.query('SELECT id FROM tenants').catch(() => ({ rows: [] as any[] }));
    for (const t of tenants.rows) {
      const tid = t.id;
      const hasYear = await client.query('SELECT 1 FROM academic_years WHERE tenant_id = $1 LIMIT 1', [tid]);
      if (hasYear.rows.length === 0) {
        const yearStart = new Date().getFullYear();
        const yearLabel = `${yearStart}/${yearStart + 1}`;
        const ay = await client.query(
          'INSERT INTO academic_years (tenant_id, name, is_current) VALUES ($1, $2, true) RETURNING id',
          [tid, yearLabel]
        );
        await client.query(
          'INSERT INTO terms (tenant_id, academic_year_id, name, is_current) VALUES ($1, $2, $3, true)',
          [tid, ay.rows[0].id, 'Term 1']
        ).catch(() => { });
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_errors (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        stack TEXT,
        source VARCHAR(50) NOT NULL DEFAULT 'backend',
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        endpoint VARCHAR(500),
        action VARCHAR(500),
        severity VARCHAR(20) NOT NULL DEFAULT 'warning',
        status VARCHAR(20) NOT NULL DEFAULT 'new',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_system_errors_created_at ON system_errors(created_at DESC)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_system_errors_status ON system_errors(status)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_system_errors_tenant_id ON system_errors(tenant_id)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_system_errors_source ON system_errors(source)`).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_system_errors_severity ON system_errors(severity)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS personal_todos (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT false,
        reminder_at TIMESTAMP,
        reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_personal_todos_user ON personal_todos(user_id, tenant_id)`).catch(() => { });
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_personal_todos_reminder
      ON personal_todos(reminder_at)
      WHERE reminder_sent = false AND reminder_at IS NOT NULL
    `).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS id_card_templates (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        card_type VARCHAR(20) NOT NULL,
        primary_color VARCHAR(20) DEFAULT '#1a3a6b',
        accent_color VARCHAR(20) DEFAULT '#c9a227',
        footer_bg VARCHAR(20) DEFAULT '#1a3a6b',
        powered_by_color VARCHAR(20) DEFAULT '#ffffff',
        school_slogan VARCHAR(120) DEFAULT 'Excellence • Discipline • Character',
        school_phone VARCHAR(80) DEFAULT '',
        school_website VARCHAR(200) DEFAULT '',
        school_code VARCHAR(20) DEFAULT '',
        school_email VARCHAR(255) DEFAULT '',
        back_header_text VARCHAR(300) DEFAULT 'This card is the property of {schoolName}.',
        instructions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, card_type)
      )
    `);
    await client.query(`ALTER TABLE id_card_templates ADD COLUMN IF NOT EXISTS school_slogan VARCHAR(120) DEFAULT 'Excellence • Discipline • Character'`).catch(() => { });
    await client.query(`ALTER TABLE id_card_templates ADD COLUMN IF NOT EXISTS school_phone VARCHAR(80) DEFAULT ''`).catch(() => { });
    await client.query(`ALTER TABLE id_card_templates ADD COLUMN IF NOT EXISTS school_website VARCHAR(200) DEFAULT ''`).catch(() => { });
    await client.query(`ALTER TABLE id_card_templates ADD COLUMN IF NOT EXISTS school_code VARCHAR(20) DEFAULT ''`).catch(() => { });
    await client.query(`ALTER TABLE id_card_templates ADD COLUMN IF NOT EXISTS school_email VARCHAR(255) DEFAULT ''`).catch(() => { });
    await client.query(`ALTER TABLE id_card_templates ADD COLUMN IF NOT EXISTS back_header_text VARCHAR(300) DEFAULT 'This card is the property of {schoolName}.'`).catch(() => { });
    await client.query(`ALTER TABLE id_card_templates ADD COLUMN IF NOT EXISTS instructions JSONB DEFAULT '[]'::jsonb`).catch(() => { });
    await client.query(`
      CREATE TABLE IF NOT EXISTS generated_id_cards (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type VARCHAR(20) NOT NULL,
        entity_id INTEGER NOT NULL,
        card_data JSONB NOT NULL,
        generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'ACTIVE'
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_generated_id_cards_tenant ON generated_id_cards(tenant_id, generated_at DESC)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS lost_card_reports (
        id UUID PRIMARY KEY,
        reference_code VARCHAR(20) UNIQUE NOT NULL,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type VARCHAR(20) NOT NULL,
        entity_id INTEGER NOT NULL,
        scanned_id VARCHAR(100) NOT NULL,
        bearer_name VARCHAR(255) NOT NULL,
        card_type_label VARCHAR(50) DEFAULT 'Student Card',
        reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(64),
        initial_notified_at TIMESTAMP,
        found_location TEXT,
        collection_point TEXT,
        reporter_phone VARCHAR(50),
        details_submitted_at TIMESTAMP,
        detail_skipped BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'PENDING',
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolution_note TEXT
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lost_card_reports_tenant ON lost_card_reports(tenant_id, reported_at DESC)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_admin_notifications (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL DEFAULT 'lost-card',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500),
        priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
        report_id UUID REFERENCES lost_card_reports(id) ON DELETE CASCADE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tenant_admin_notifications ON tenant_admin_notifications(tenant_id, read_at, created_at DESC)`).catch(() => { });

    await client.query(`
      CREATE TABLE IF NOT EXISTS promotion_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        from_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        academic_year VARCHAR(30) DEFAULT '',
        promoted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        promoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action_type VARCHAR(20) DEFAULT 'PROMOTE'
      )
    `).catch(() => { });
    await client.query(`CREATE INDEX IF NOT EXISTS idx_promotion_history_tenant ON promotion_history(tenant_id, promoted_at DESC)`).catch(() => { });

    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
