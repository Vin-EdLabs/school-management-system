import { query } from './connection.js';

/** Run idempotent DDL on every server start — safe if already applied. */
async function safe(sql: string, label?: string): Promise<void> {
  try {
    await query(sql);
  } catch (err: any) {
    console.warn(`ensureSchema${label ? ` (${label})` : ''}:`, err?.message || err);
  }
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Supplemental schema: tables/columns from SQL migrations that must exist even when
 * file migrations were never run manually (e.g. fresh production deploy).
 */
export async function ensureSupplementalSchema(): Promise<void> {
  console.log('🔧 Ensuring supplemental schema (tables & columns)...');

  // --- base tables (must exist before FKs below) ---
  await safe(
    `
    CREATE TABLE IF NOT EXISTS academic_years (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, name)
    )
  `,
    'academic_years'
  );
  await safe(`CREATE INDEX IF NOT EXISTS idx_academic_years_tenant ON academic_years(tenant_id)`, 'idx_academic_years_tenant');

  await safe(
    `
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
  `,
    'academic_terms'
  );
  await safe(
    `ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`,
    'academic_terms.is_archived'
  );

  // --- academic_years (end-of-year cycle) ---
  await safe(`ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS start_date DATE`, 'academic_years.start_date');
  await safe(`ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS end_date DATE`, 'academic_years.end_date');
  await safe(
    `ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
    'academic_years.status'
  );
  await safe(`ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS label VARCHAR(20)`, 'academic_years.label');
  await safe(
    `UPDATE academic_years SET label = LEFT(TRIM(name), 20) WHERE label IS NULL AND name IS NOT NULL`,
    'academic_years.label backfill'
  );
  await safe(`UPDATE academic_years SET status = 'active' WHERE status IS NULL`, 'academic_years.status backfill');
  await safe(`ALTER TABLE terms ADD COLUMN IF NOT EXISTS start_date DATE`, 'terms.start_date');
  await safe(`ALTER TABLE terms ADD COLUMN IF NOT EXISTS end_date DATE`, 'terms.end_date');
  await safe(
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_current_term_per_tenant ON terms (tenant_id) WHERE is_current = true`,
    'unique_current_term_per_tenant'
  );

  // --- classes ---
  await safe(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS level_order INTEGER`, 'classes.level_order');
  await safe(
    `ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_final_class BOOLEAN NOT NULL DEFAULT false`,
    'classes.is_final_class'
  );

  // --- students ---
  await safe(
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(50) DEFAULT 'active'`,
    'students.enrollment_status'
  );
  await safe(
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_academic_term_id INTEGER REFERENCES academic_terms(id)`,
    'students.admission_academic_term_id'
  );
  await safe(
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMPTZ`,
    'students.inactivated_at'
  );
  await safe(
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS inactivated_academic_term_id INTEGER REFERENCES academic_terms(id)`,
    'students.inactivated_academic_term_id'
  );
  await safe(
    `UPDATE students s
     SET inactivated_at = COALESCE(s.inactivated_at, s.updated_at)
     WHERE LOWER(COALESCE(s.enrollment_status, 'active')) = 'inactive'
       AND s.inactivated_at IS NULL
       AND s.updated_at IS NOT NULL`,
    'students.inactivated_at backfill'
  );
  await safe(
    `UPDATE students s
     SET inactivated_academic_term_id = picked.term_id
     FROM (
       SELECT s2.id AS student_id,
              (
                SELECT at.id
                FROM academic_terms at
                WHERE at.tenant_id = s2.tenant_id
                  AND COALESCE(s2.inactivated_at, s2.updated_at)::date
                      >= COALESCE(at.start_date, '1900-01-01'::date)
                  AND COALESCE(s2.inactivated_at, s2.updated_at)::date
                      <= COALESCE(at.end_date, CURRENT_DATE)
                ORDER BY at.start_date DESC NULLS LAST, at.id DESC
                LIMIT 1
              ) AS term_id
       FROM students s2
       WHERE LOWER(COALESCE(s2.enrollment_status, 'active')) = 'inactive'
         AND s2.inactivated_academic_term_id IS NULL
         AND COALESCE(s2.inactivated_at, s2.updated_at) IS NOT NULL
     ) picked
     WHERE s.id = picked.student_id
       AND picked.term_id IS NOT NULL`,
    'students.inactivated_academic_term_id backfill'
  );
  await safe(
    `UPDATE students SET enrollment_status = 'active' WHERE enrollment_status IS NULL`,
    'students.enrollment_status backfill'
  );

  // --- parent desk ---
  await safe(
    `ALTER TABLE parent_messages ADD COLUMN IF NOT EXISTS is_read_by_school BOOLEAN NOT NULL DEFAULT false`,
    'parent_messages.is_read_by_school'
  );

  // --- subjects (in case inline migration skipped) ---
  await safe(
    `
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
  `,
    'subjects'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS teacher_subject_classes (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, teacher_id, subject_id, class_id)
    )
  `,
    'teacher_subject_classes'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_teacher_subject_classes_teacher ON teacher_subject_classes (tenant_id, teacher_id)`,
    'idx_teacher_subject_classes_teacher'
  );

  // --- student_class_enrollments ---
  await safe(
    `
    CREATE TABLE IF NOT EXISTS student_class_enrollments (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'promoted', 'repeated', 'graduated', 'transferred')),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, student_id, academic_year_id, class_id)
    )
  `,
    'student_class_enrollments'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_sce_tenant_year ON student_class_enrollments (tenant_id, academic_year_id)`,
    'idx_sce_tenant_year'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_sce_student ON student_class_enrollments (student_id, academic_year_id)`,
    'idx_sce_student'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_sce_class_year ON student_class_enrollments (class_id, academic_year_id)`,
    'idx_sce_class_year'
  );

  // --- graduation_details (alumni) ---
  await safe(
    `
    CREATE TABLE IF NOT EXISTS graduation_details (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      graduated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, student_id, academic_year_id)
    )
  `,
    'graduation_details'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_graduation_tenant_year ON graduation_details (tenant_id, academic_year_id)`,
    'idx_graduation_tenant_year'
  );

  // --- school setup checklist ---
  await safe(
    `
    CREATE TABLE IF NOT EXISTS school_setup_progress (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      has_subjects BOOLEAN NOT NULL DEFAULT false,
      has_classes BOOLEAN NOT NULL DEFAULT false,
      has_terms BOOLEAN NOT NULL DEFAULT false,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'school_setup_progress'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_setup_progress_school ON school_setup_progress (school_id)`,
    'idx_school_setup_progress'
  );

  // Setup progress is refreshed from the API layer (notifySetupProgressChanged).
  // Drop DB triggers so INSERT into classes/subjects/terms never fails on partial schema.
  await safe(`DROP TRIGGER IF EXISTS setup_progress_after_subject ON subjects`, 'drop trigger subject');
  await safe(`DROP TRIGGER IF EXISTS setup_progress_after_class ON classes`, 'drop trigger class');
  await safe(`DROP TRIGGER IF EXISTS setup_progress_after_academic_term ON academic_terms`, 'drop trigger term');
  await safe(`DROP TRIGGER IF EXISTS setup_progress_after_academic_year ON academic_years`, 'drop trigger year');

  await safe(
    `INSERT INTO school_setup_progress (school_id) SELECT id FROM tenants ON CONFLICT (school_id) DO NOTHING`,
    'seed school_setup_progress'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS global_chat_reactions (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES global_chat_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji VARCHAR(32) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji)
    )
  `,
    'global_chat_reactions'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_global_chat_reactions_message ON global_chat_reactions(message_id)`,
    'idx_global_chat_reactions_message'
  );

  // --- protect financial records on student delete ---
  await safe(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey`, 'payments fk drop');
  await safe(
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_category VARCHAR(20) DEFAULT 'term_fee'`,
    'payments payment_category'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_payments_category ON payments(tenant_id, student_id, payment_category)`,
    'idx_payments_category'
  );
  await safe(
    `
    ALTER TABLE payments ADD CONSTRAINT payments_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  `,
    'payments fk add'
  );
  await safe(`ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_student_id_fkey`, 'receipts fk drop');
  await safe(
    `
    ALTER TABLE receipts ADD CONSTRAINT receipts_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  `,
    'receipts fk add'
  );
  await safe(`ALTER TABLE student_ledger DROP CONSTRAINT IF EXISTS student_ledger_student_id_fkey`, 'ledger fk drop');
  await safe(
    `
    ALTER TABLE student_ledger ADD CONSTRAINT student_ledger_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  `,
    'ledger fk add'
  );
  await safe(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS reference VARCHAR(255)`, 'ledger reference');
  await safe(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id)`, 'ledger payment_id');
  await safe(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`, 'ledger created_by');
  await safe(`ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`, 'ledger metadata');

  await safe(`CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES terms(id),
    academic_year_id INTEGER REFERENCES academic_years(id),
    invoice_number VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    term_fee NUMERIC(10,2) DEFAULT 0,
    individual_charges NUMERIC(10,2) DEFAULT 0,
    arrears NUMERIC(10,2) DEFAULT 0,
    credit_applied NUMERIC(10,2) DEFAULT 0,
    total_due NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'issued',
    line_items JSONB DEFAULT '[]'::jsonb,
    generated_by_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, invoice_number)
  )`, 'invoices table');
  await safe(`CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id, tenant_id)`, 'invoices student idx');
  await safe(`CREATE INDEX IF NOT EXISTS idx_invoices_term ON invoices(term_id, tenant_id)`, 'invoices term idx');

  // --- term budgets ---
  await safe(
    `
    CREATE TABLE IF NOT EXISTS budget_categories (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      is_system BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'budget_categories'
  );
  await safe(`CREATE INDEX IF NOT EXISTS idx_budget_categories_tenant ON budget_categories(tenant_id)`, 'idx_budget_categories_tenant');
  await safe(
    `
    CREATE TABLE IF NOT EXISTS term_budgets (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      academic_year VARCHAR(50) NOT NULL,
      term VARCHAR(100) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, academic_year, term)
    )
  `,
    'term_budgets'
  );
  await safe(
    `
    CREATE TABLE IF NOT EXISTS budget_lines (
      id SERIAL PRIMARY KEY,
      budget_id INTEGER REFERENCES term_budgets(id) ON DELETE CASCADE,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      category_name VARCHAR(255) NOT NULL,
      category_type VARCHAR(50) NOT NULL,
      budgeted_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      alert_threshold INTEGER DEFAULT 90,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'budget_lines'
  );
  await safe(
    `
    CREATE TABLE IF NOT EXISTS budget_alerts (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      budget_id INTEGER REFERENCES term_budgets(id) ON DELETE CASCADE,
      budget_line_id INTEGER REFERENCES budget_lines(id) ON DELETE CASCADE,
      alert_level VARCHAR(50) NOT NULL,
      percentage_used NUMERIC(5,2),
      message TEXT,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(budget_line_id, alert_level)
    )
  `,
    'budget_alerts'
  );
  await safe(`ALTER TABLE budget_alerts ADD COLUMN IF NOT EXISTS message TEXT`, 'budget_alerts.message');

  await safe(
    `
    CREATE TABLE IF NOT EXISTS global_announcements (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'info',
      target VARCHAR(50) NOT NULL DEFAULT 'all',
      target_tenant_ids INTEGER[] DEFAULT NULL,
      scheduled_at TIMESTAMP DEFAULT NULL,
      expires_at TIMESTAMP DEFAULT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'global_announcements'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_global_announcements_active ON global_announcements(is_active)`,
    'idx_global_announcements_active'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS announcement_reads (
      id SERIAL PRIMARY KEY,
      announcement_id INTEGER NOT NULL REFERENCES global_announcements(id) ON DELETE CASCADE,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(announcement_id, user_id)
    )
  `,
    'announcement_reads'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id)`,
    'idx_announcement_reads_user'
  );

  // --- other_staff (non-teaching staff) + teacher emergency/bank fields ---
  await safe(
    `
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
      monthly_salary NUMERIC(10,2) DEFAULT 0,
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
  `,
    'other_staff'
  );
  await safe(`CREATE INDEX IF NOT EXISTS idx_other_staff_tenant ON other_staff(tenant_id)`, 'idx_other_staff_tenant');

  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS headmaster_title VARCHAR(120) DEFAULT 'Headmaster'`, 'teachers.headmaster_title');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(100)`, 'teachers.emergency_contact_phone');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100)`, 'teachers.emergency_contact_relationship');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255)`, 'teachers.bank_name');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100)`, 'teachers.bank_account_number');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255)`, 'teachers.bank_branch');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255)`, 'teachers.bank_account_name');

  await safe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS other_staff_id INTEGER`, 'users.other_staff_id');
  await safe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(100)`, 'users.phone');
  await safe(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_other_staff_id_fkey`, 'users_other_staff_id_fkey_drop');
  await safe(
    `ALTER TABLE users ADD CONSTRAINT users_other_staff_id_fkey FOREIGN KEY (other_staff_id) REFERENCES other_staff(id) ON DELETE SET NULL`,
    'users_other_staff_id_fkey'
  );

  // Migrate legacy payroll_other_staff rows if table still exists
  if (await tableExists('payroll_other_staff')) {
    await safe(
      `
      INSERT INTO other_staff (
        id, tenant_id, staff_id, full_name, position, monthly_salary,
        employment_status, notes, ssnit_enabled, created_at, updated_at
      )
      SELECT
        p.id,
        p.tenant_id,
        CASE
          WHEN p.staff_id IS NULL OR TRIM(p.staff_id) = '' THEN 'STF' || LPAD(p.id::text, 3, '0')
          WHEN UPPER(p.staff_id) LIKE 'STAFF%' THEN REPLACE(UPPER(p.staff_id), 'STAFF', 'STF')
          WHEN UPPER(p.staff_id) LIKE 'OTH%' THEN REPLACE(UPPER(p.staff_id), 'OTH', 'STF')
          ELSE p.staff_id
        END,
        p.full_name,
        p.role,
        COALESCE(p.monthly_salary, 0),
        COALESCE(NULLIF(LOWER(TRIM(p.employment_status)), ''), 'active'),
        p.notes,
        COALESCE(p.ssnit_enabled, false),
        p.created_at,
        p.updated_at
      FROM payroll_other_staff p
      WHERE NOT EXISTS (SELECT 1 FROM other_staff o WHERE o.id = p.id)
      ON CONFLICT (tenant_id, staff_id) DO NOTHING
    `,
      'migrate_payroll_other_staff'
    );
  }

  // --- transport management schema ---
  await safe(
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
    'users.role_check drop'
  );
  await safe(
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super-admin', 'administrator', 'finance', 'teacher', 'staff', 'driver', 'headmaster', 'website-manager'))`,
    'users.role_check add headmaster'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plate_number VARCHAR(100) NOT NULL,
      vehicle_name VARCHAR(255) NOT NULL,
      capacity INT NOT NULL,
      model VARCHAR(255),
      color VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_tenant_plate UNIQUE (tenant_id, plate_number)
    )
  `,
    'vehicles'
  );
  await safe(
    `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL`,
    'vehicles.instructor_id'
  );
  await safe(`CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id)`, 'idx_vehicles_tenant');

  await safe(
    `
    CREATE TABLE IF NOT EXISTS routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      time_of_day VARCHAR(50) NOT NULL DEFAULT 'both' CHECK (time_of_day IN ('morning', 'afternoon', 'both')),
      vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
      driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      color VARCHAR(50) NOT NULL DEFAULT '#3b82f6',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'routes'
  );
  await safe(`CREATE INDEX IF NOT EXISTS idx_routes_tenant ON routes(tenant_id)`, 'idx_routes_tenant');
  await safe(
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS driver_staff_id INTEGER REFERENCES other_staff(id) ON DELETE SET NULL`,
    'routes.driver_staff_id'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_routes_driver_staff ON routes(driver_staff_id)`,
    'idx_routes_driver_staff'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS transport_drivers (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      license_number VARCHAR(100),
      email VARCHAR(255),
      notes TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'transport_drivers'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_transport_drivers_tenant ON transport_drivers(tenant_id)`,
    'idx_transport_drivers_tenant'
  );
  await safe(
    `ALTER TABLE transport_drivers ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL`,
    'transport_drivers.vehicle_id'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_transport_drivers_vehicle ON transport_drivers(vehicle_id)`,
    'idx_transport_drivers_vehicle'
  );
  await safe(
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS transport_driver_id INTEGER REFERENCES transport_drivers(id) ON DELETE SET NULL`,
    'routes.transport_driver_id'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_routes_transport_driver ON routes(transport_driver_id)`,
    'idx_routes_transport_driver'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS stops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      latitude NUMERIC(10, 7) NOT NULL,
      longitude NUMERIC(10, 7) NOT NULL,
      order_index INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'stops'
  );
  await safe(`CREATE INDEX IF NOT EXISTS idx_stops_route ON stops(route_id)`, 'idx_stops_route');

  await safe(
    `
    CREATE TABLE IF NOT EXISTS student_transport (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      CONSTRAINT unique_student_route UNIQUE (student_id, route_id)
    )
  `,
    'student_transport'
  );
  await safe(`CREATE INDEX IF NOT EXISTS idx_student_transport_student ON student_transport(student_id)`, 'idx_student_transport_student');
  await safe(`CREATE INDEX IF NOT EXISTS idx_student_transport_route ON student_transport(route_id)`, 'idx_student_transport_route');

  await safe(
    `
    CREATE TABLE IF NOT EXISTS driver_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      license_number VARCHAR(100) NOT NULL,
      photo_url TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'driver_profiles'
  );

  // --- teachers: position, department, soft delete ---
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS position VARCHAR(150)`, 'teachers.position');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS department VARCHAR(150)`, 'teachers.department');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS qualification TEXT`, 'teachers.qualification');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS specialization TEXT`, 'teachers.specialization');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS national_id VARCHAR(100)`, 'teachers.national_id');
  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50)`, 'teachers.employment_type');
  await safe(
    `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    'teachers.deleted_at'
  );
  await safe(
    `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deletion_type VARCHAR(10)`,
    'teachers.deletion_type'
  );
  await safe(
    `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS removed_original_name VARCHAR(255)`,
    'teachers.removed_original_name'
  );
  await safe(
    `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS removed_original_staff_id VARCHAR(50)`,
    'teachers.removed_original_staff_id'
  );
  await safe(
    `ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS counts_as_staff BOOLEAN NOT NULL DEFAULT true`,
    'other_staff.counts_as_staff'
  );
  await safe(
    `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false`,
    'teachers.is_deleted'
  );
  await safe(
    `ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false`,
    'other_staff.is_deleted'
  );
  await safe(
    `ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    'other_staff.deleted_at'
  );
  await safe(
    `ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS deletion_type VARCHAR(10)`,
    'other_staff.deletion_type'
  );
  await safe(
    `ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS removed_original_name VARCHAR(255)`,
    'other_staff.removed_original_name'
  );
  await safe(
    `ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS removed_original_staff_id VARCHAR(50)`,
    'other_staff.removed_original_staff_id'
  );
  await safe(
    `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS parent_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL`,
    'teachers.parent_teacher_id'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_teachers_parent_teacher_id ON teachers (tenant_id, parent_teacher_id)`,
    'idx_teachers_parent_teacher_id'
  );
  await safe(
    `UPDATE teachers SET full_name = removed_original_name
     WHERE TRIM(COALESCE(full_name, '')) = '[Removed]'
       AND removed_original_name IS NOT NULL AND TRIM(removed_original_name) <> ''`,
    'teachers.restore_removed_full_name'
  );
  await safe(
    `UPDATE other_staff SET full_name = removed_original_name
     WHERE TRIM(COALESCE(full_name, '')) = '[Removed]'
       AND removed_original_name IS NOT NULL AND TRIM(removed_original_name) <> ''`,
    'other_staff.restore_removed_full_name'
  );
  await safe(`ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS qualification TEXT`, 'other_staff.qualification');
  await safe(`ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS specialization TEXT`, 'other_staff.specialization');

  await safe(
    `
    CREATE TABLE IF NOT EXISTS staff_field_suggestions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('position', 'department')),
      name VARCHAR(150) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    'staff_field_suggestions'
  );
  await safe(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_field_suggestions_name
     ON staff_field_suggestions (tenant_id, field_type, lower(trim(name)))`,
    'uq_staff_field_suggestions_name'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_staff_field_suggestions_tenant
     ON staff_field_suggestions (tenant_id, field_type)`,
    'idx_staff_field_suggestions_tenant'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS birthday_wishes_sent (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      person_type VARCHAR(20) NOT NULL CHECK (person_type IN ('student', 'teacher')),
      person_id INTEGER NOT NULL,
      wish_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, person_type, person_id, wish_date)
    )
  `,
    'birthday_wishes_sent'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_birthday_wishes_sent_tenant_date
     ON birthday_wishes_sent (tenant_id, wish_date)`,
    'idx_birthday_wishes_sent_tenant_date'
  );

  await safe(
    `ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS birthday_message_config JSONB DEFAULT '{}'::jsonb`,
    'school_settings.birthday_message_config'
  );

  await safe(
    `ALTER TABLE classes ADD COLUMN IF NOT EXISTS fee_mode VARCHAR(20) DEFAULT 'term'`,
    'classes.fee_mode'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS daily_fee_structures (
      id                BIGSERIAL PRIMARY KEY,
      tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      class_id          INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      term_id           INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      academic_year_id  INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      daily_rate        NUMERIC(10,2) NOT NULL DEFAULT 0,
      weekly_rate       NUMERIC(10,2) NOT NULL DEFAULT 0,
      monthly_rate      NUMERIC(10,2) NOT NULL DEFAULT 0,
      termly_rate       NUMERIC(10,2) NOT NULL DEFAULT 0,
      school_days_count INTEGER NOT NULL DEFAULT 0,
      created_by        INTEGER,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, class_id, term_id)
    )
  `,
    'daily_fee_structures'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS school_closure_days (
      id          BIGSERIAL PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      term_id     INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      closure_date DATE NOT NULL,
      reason      VARCHAR(255),
      created_by  INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, term_id, closure_date)
    )
  `,
    'school_closure_days'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS daily_fee_payments (
      id                  BIGSERIAL PRIMARY KEY,
      tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id            INTEGER NOT NULL REFERENCES classes(id),
      term_id             INTEGER NOT NULL REFERENCES terms(id),
      academic_year_id    INTEGER NOT NULL REFERENCES academic_years(id),
      payment_type        VARCHAR(20) NOT NULL CHECK (payment_type IN ('daily', 'weekly', 'monthly', 'termly')),
      amount_paid         NUMERIC(10,2) NOT NULL,
      payment_date        DATE NOT NULL,
      coverage_start_date DATE NOT NULL,
      coverage_end_date   DATE NOT NULL,
      school_days_covered INTEGER NOT NULL,
      next_due_date       DATE,
      payment_method      VARCHAR(100) DEFAULT 'cash',
      payment_account_id  INTEGER,
      receipt_number      VARCHAR(100),
      notes               TEXT,
      recorded_by_user_id INTEGER,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `,
    'daily_fee_payments'
  );

  await safe(
    `CREATE INDEX IF NOT EXISTS idx_daily_fee_payments_tenant ON daily_fee_payments(tenant_id)`,
    'idx_daily_fee_payments_tenant'
  );

  await safe(
    `
    CREATE TABLE IF NOT EXISTS daily_fee_collection_records (
      id                    BIGSERIAL PRIMARY KEY,
      tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      student_id            INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id              INTEGER NOT NULL REFERENCES classes(id),
      term_id               INTEGER NOT NULL REFERENCES terms(id),
      collection_date       DATE NOT NULL,
      status                VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('paid', 'school_closed', 'pending')),
      daily_fee_payment_id  INTEGER REFERENCES daily_fee_payments(id) ON DELETE SET NULL,
      created_at            TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, student_id, collection_date)
    )
  `,
    'daily_fee_collection_records'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS platform_settings (
      key VARCHAR(64) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    )`,
    'platform_settings'
  );
  await safe(
    `INSERT INTO platform_settings (key, value)
     VALUES ('ui', '{"zoomNudgeEnabled": true}'::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    'platform_settings_seed'
  );

  await safe(
    `INSERT INTO platform_settings (key, value)
     VALUES ('ui', '{"zoomNudgeEnabled": true}'::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    'platform_settings_seed'
  );

  // --- in-app messaging (chat) ---
  await safe(
    `DO $$ BEGIN
      CREATE TYPE chat_channel_type AS ENUM ('general', 'teachers', 'non_teaching', 'announcements', 'dm');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    'chat_channel_type'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS chat_channels (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      channel_type chat_channel_type NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'chat_channels'
  );
  await safe(
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_tenant_type_uidx
     ON chat_channels (tenant_id, channel_type)
     WHERE channel_type <> 'dm'`,
    'chat_channels_tenant_type_uidx'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS chat_channel_members (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_read_at TIMESTAMPTZ,
      UNIQUE(channel_id, user_id)
    )`,
    'chat_channel_members'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS chat_channel_members_user_idx ON chat_channel_members(user_id)`,
    'chat_channel_members_user_idx'
  );
  await safe(
    `ALTER TABLE chat_channel_members ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN NOT NULL DEFAULT false`,
    'chat_channel_members_notifications_muted'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sender_label VARCHAR(100),
      message TEXT,
      image_url TEXT,
      image_thumbnail_url TEXT,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'chat_messages'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx
     ON chat_messages(channel_id, created_at DESC, id DESC)`,
    'chat_messages_channel_created_idx'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS dm_conversations (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      participant_one INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participant_two INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, participant_one, participant_two)
    )`,
    'dm_conversations'
  );

  // --- school website module ---
  await safe(
    `CREATE TABLE IF NOT EXISTS school_websites (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      is_enabled BOOLEAN NOT NULL DEFAULT false,
      is_published BOOLEAN NOT NULL DEFAULT false,
      accent_color VARCHAR(20) DEFAULT '#2563eb',
      logo_url TEXT,
      banner_image_url TEXT,
      tagline TEXT,
      welcome_text TEXT,
      welcome_image_url TEXT,
      highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
      stats JSONB NOT NULL DEFAULT '{"founded_year":null,"student_count":null,"programs_count":null}'::jsonb,
      social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_websites'
  );
  await safe(
    `ALTER TABLE school_websites ADD COLUMN IF NOT EXISTS public_subdomain VARCHAR(63)`,
    'school_websites.public_subdomain'
  );
  await safe(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_school_websites_public_subdomain_lower
       ON school_websites (LOWER(public_subdomain))
       WHERE public_subdomain IS NOT NULL AND TRIM(public_subdomain) <> ''`,
    'school_websites.public_subdomain_idx'
  );
  await safe(
    `ALTER TABLE school_websites ADD COLUMN IF NOT EXISTS website_url_suffix VARCHAR(20) NOT NULL DEFAULT 'edu'`,
    'school_websites.website_url_suffix'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_about (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      history TEXT,
      vision TEXT,
      mission TEXT,
      core_values JSONB NOT NULL DEFAULT '[]'::jsonb,
      director_message TEXT,
      director_name TEXT,
      director_title TEXT,
      director_photo_url TEXT,
      institution_overview TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_about'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_admission_config (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      requirements TEXT,
      programs JSONB NOT NULL DEFAULT '[]'::jsonb,
      applications_open BOOLEAN NOT NULL DEFAULT true,
      open_date DATE,
      close_date DATE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_admission_config'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_careers_config (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      applications_open BOOLEAN NOT NULL DEFAULT true,
      intro_text TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_careers_config'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_applications (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      applicant_name TEXT NOT NULL,
      dob DATE,
      gender TEXT,
      nationality TEXT,
      program_applied TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      parent_email TEXT,
      relationship TEXT,
      documents JSONB NOT NULL DEFAULT '[]'::jsonb,
      application_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_applications'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_applications_tenant
     ON school_website_applications (tenant_id, submitted_at DESC)`,
    'idx_school_website_applications_tenant'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_gallery (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      category TEXT NOT NULL DEFAULT 'facilities',
      sort_order INTEGER NOT NULL DEFAULT 0,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_gallery'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_gallery_tenant
     ON school_website_gallery (tenant_id, sort_order ASC, id ASC)`,
    'idx_school_website_gallery_tenant'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_contact (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      primary_phone TEXT,
      secondary_phone TEXT,
      email TEXT,
      address TEXT,
      map_embed_url TEXT,
      working_hours TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_contact'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_contact_messages (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_contact_messages'
  );
  await safe(
    `ALTER TABLE school_website_contact_messages ADD COLUMN IF NOT EXISTS phone TEXT`,
    'school_website_contact_messages.phone'
  );
  await safe(
    `ALTER TABLE school_website_contact_messages ALTER COLUMN email DROP NOT NULL`,
    'school_website_contact_messages.email_nullable'
  );
  await safe(
    `ALTER TABLE school_website_contact_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false`,
    'school_website_contact_messages.is_read'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_employment_applications (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      position_applied TEXT,
      message TEXT,
      documents JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_employment_applications'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_employment_tenant
       ON school_website_employment_applications (tenant_id, submitted_at DESC)`,
    'idx_school_website_employment_tenant'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_enable_requests (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      requested_by_name TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'handled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_enable_requests'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_enable_requests_tenant
       ON school_website_enable_requests (tenant_id, created_at DESC)`,
    'idx_school_website_enable_requests_tenant'
  );

  await safe(
    `ALTER TABLE school_website_applications ADD COLUMN IF NOT EXISTS application_data JSONB NOT NULL DEFAULT '{}'::jsonb`,
    'school_website_applications.application_data'
  );
  await safe(
    `ALTER TABLE school_website_applications ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL`,
    'school_website_applications.student_id'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_applications_student
       ON school_website_applications (tenant_id, student_id)
       WHERE student_id IS NOT NULL`,
    'idx_school_website_applications_student'
  );
  await safe(
    `ALTER TABLE school_websites ADD COLUMN IF NOT EXISTS welcome_image_secondary_url TEXT`,
    'school_websites.welcome_image_secondary_url'
  );
  await safe(
    `ALTER TABLE school_websites ADD COLUMN IF NOT EXISTS home_content JSONB NOT NULL DEFAULT '{}'::jsonb`,
    'school_websites.home_content'
  );
  await safe(
    `ALTER TABLE school_website_about ADD COLUMN IF NOT EXISTS history_image_url TEXT`,
    'school_website_about.history_image_url'
  );
  await safe(
    `ALTER TABLE school_website_about ADD COLUMN IF NOT EXISTS overview_image_url TEXT`,
    'school_website_about.overview_image_url'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_events (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      event_date DATE NOT NULL,
      event_time TIME,
      location TEXT,
      cover_image_url TEXT,
      gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_published BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_events'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_events_tenant_date
     ON school_website_events (tenant_id, event_date DESC)`,
    'idx_school_website_events_tenant_date'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_transcript_requests (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      completion_year TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      document_type TEXT NOT NULL DEFAULT 'transcript'
        CHECK (document_type IN ('transcript', 'bece', 'both', 'testimonial')),
      notes TEXT,
      is_read BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_transcript_requests'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_transcript_requests_tenant
       ON school_website_transcript_requests (tenant_id, created_at DESC)`,
    'idx_school_website_transcript_requests_tenant'
  );
  await safe(
    `ALTER TABLE school_website_transcript_requests
       DROP CONSTRAINT IF EXISTS school_website_transcript_requests_document_type_check`,
    'school_website_transcript_requests_document_type_check_drop'
  );
  await safe(
    `ALTER TABLE school_website_transcript_requests
       ADD CONSTRAINT school_website_transcript_requests_document_type_check
       CHECK (document_type IN ('transcript', 'bece', 'both', 'testimonial'))`,
    'school_website_transcript_requests_document_type_check'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_testimonial_submissions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      completion_year TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_testimonial_submissions'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_testimonial_submissions_tenant
       ON school_website_testimonial_submissions (tenant_id, created_at DESC)`,
    'idx_school_website_testimonial_submissions_tenant'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_team_members (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      member_type TEXT NOT NULL DEFAULT 'leadership'
        CHECK (member_type IN ('leadership', 'teacher')),
      position TEXT NOT NULL DEFAULT 'other',
      full_name TEXT NOT NULL,
      photo_url TEXT,
      bio TEXT,
      subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_team_members'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_team_members_tenant
       ON school_website_team_members (tenant_id, member_type, sort_order ASC, id ASC)`,
    'idx_school_website_team_members_tenant'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS school_website_alumni_profiles (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      graduation_year TEXT,
      photo_url TEXT,
      achievement TEXT,
      testimonial TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'school_website_alumni_profiles'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_school_website_alumni_profiles_tenant
       ON school_website_alumni_profiles (tenant_id, sort_order ASC, id ASC)`,
    'idx_school_website_alumni_profiles_tenant'
  );

  // --- ScholarNerve Partner Network ---
  await safe(
    `CREATE TABLE IF NOT EXISTS partners (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20) NOT NULL,
      whatsapp VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      region VARCHAR(100) NOT NULL,
      occupation VARCHAR(100),
      momo_number VARCHAR(20) NOT NULL,
      momo_network VARCHAR(20) NOT NULL,
      schools_target VARCHAR(20),
      motivation TEXT,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      rejection_note TEXT,
      partner_id VARCHAR(20) UNIQUE,
      tier VARCHAR(30) DEFAULT 'partner' CHECK (tier IN ('partner', 'senior_partner', 'team_leader', 'regional_director')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    'partners'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partners_status ON partners (status)`,
    'idx_partners_status'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS profile_photo_url TEXT`,
    'partners_profile_photo_url'
  );
  await safe(
    `ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_status_check`,
    'partners_status_check_drop'
  );
  await safe(
    `ALTER TABLE partners ADD CONSTRAINT partners_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'))`,
    'partners_status_check'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS suspension_note TEXT`,
    'partners_suspension_note'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS town VARCHAR(100)`,
    'partners_town'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS restoration_note TEXT`,
    'partners_restoration_note'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`,
    'partners_gender'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS heard_from VARCHAR(30)`,
    'partners_heard_from'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20)`,
    'partners_referred_by'
  );
  await safe(
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS referral_earnings NUMERIC(12,2) DEFAULT 0`,
    'partners_referral_earnings'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partners_referred_by ON partners (referred_by)`,
    'idx_partners_referred_by'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS partner_password_reset_tokens (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    'partner_password_reset_tokens'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_reset_token_hash ON partner_password_reset_tokens (token_hash)`,
    'idx_partner_reset_token_hash'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_reset_partner ON partner_password_reset_tokens (partner_id, created_at DESC)`,
    'idx_partner_reset_partner'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS partner_school_leads (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER REFERENCES partners(id),
      school_name VARCHAR(255) NOT NULL,
      proprietor_name VARCHAR(255),
      phone VARCHAR(20),
      region VARCHAR(100),
      student_count VARCHAR(50),
      status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_booked', 'converted', 'dead')),
      converted_school_id INTEGER,
      converted_at TIMESTAMP,
      plan_amount NUMERIC(10,2),
      commission_rate NUMERIC(5,2),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    'partner_school_leads'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_leads_partner
       ON partner_school_leads (partner_id, created_at DESC)`,
    'idx_partner_leads_partner'
  );
  await safe(
    `ALTER TABLE partner_school_leads ADD COLUMN IF NOT EXISTS demo_date DATE`,
    'partner_school_leads_demo_date'
  );
  await safe(
    `ALTER TABLE partner_school_leads ADD COLUMN IF NOT EXISTS demo_meeting_url TEXT`,
    'partner_school_leads_demo_meeting_url'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS partner_commissions (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER REFERENCES partners(id),
      school_id INTEGER,
      lead_id INTEGER REFERENCES partner_school_leads(id),
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      plan_amount NUMERIC(10,2) NOT NULL,
      commission_rate NUMERIC(5,2) NOT NULL,
      commission_amount NUMERIC(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
      paid_at TIMESTAMP,
      momo_reference VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (lead_id, month, year)
    )`,
    'partner_commissions'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner
       ON partner_commissions (partner_id, year DESC, month DESC)`,
    'idx_partner_commissions_partner'
  );
  await safe(
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS commission_type VARCHAR(30) DEFAULT 'school'`,
    'partner_commissions_commission_type'
  );
  await safe(
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS recruit_partner_id INTEGER REFERENCES partners(id)`,
    'partner_commissions_recruit_partner_id'
  );
  await safe(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_commissions_recruitment_unique
       ON partner_commissions (partner_id, recruit_partner_id, month, year)
       WHERE commission_type = 'recruitment_bonus'`,
    'idx_partner_commissions_recruitment_unique'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS partner_notifications (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER REFERENCES partners(id),
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    'partner_notifications'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_notifications_partner
       ON partner_notifications (partner_id, created_at DESC)`,
    'idx_partner_notifications_partner'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS partner_training_videos (
      id SERIAL PRIMARY KEY,
      youtube_url VARCHAR(500) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    'partner_training_videos'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS partner_video_progress (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER REFERENCES partners(id),
      video_id INTEGER REFERENCES partner_training_videos(id) ON DELETE CASCADE,
      watched_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(partner_id, video_id)
    )`,
    'partner_video_progress'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS partner_push_subscriptions (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (partner_id, endpoint)
    )`,
    'partner_push_subscriptions'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_push_subscriptions_partner
       ON partner_push_subscriptions (partner_id)`,
    'idx_partner_push_subscriptions_partner'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS partner_fcm_tokens (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (partner_id, token)
    )`,
    'partner_fcm_tokens'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_fcm_tokens_partner
       ON partner_fcm_tokens (partner_id)`,
    'idx_partner_fcm_tokens_partner'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS partner_emails (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
      template VARCHAR(50) NOT NULL DEFAULT 'custom',
      subject VARCHAR(255) NOT NULL,
      body_preview TEXT,
      batch_id UUID,
      sent_at TIMESTAMP DEFAULT NOW()
    )`,
    'partner_emails'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_emails_sent ON partner_emails (sent_at DESC)`,
    'idx_partner_emails_sent'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_emails_batch ON partner_emails (batch_id)`,
    'idx_partner_emails_batch'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS partner_login_events (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('login', 'logout')),
      ip_address VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    'partner_login_events'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_login_events_created
       ON partner_login_events (created_at DESC)`,
    'idx_partner_login_events_created'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_login_events_partner
       ON partner_login_events (partner_id, created_at DESC)`,
    'idx_partner_login_events_partner'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS partner_support_messages (
      id SERIAL PRIMARY KEY,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('partner', 'super-admin')),
      sender_username VARCHAR(100),
      message TEXT NOT NULL,
      is_from_superadmin BOOLEAN NOT NULL DEFAULT false,
      read_at TIMESTAMP,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    'partner_support_messages'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_partner_support_partner
       ON partner_support_messages (partner_id, created_at DESC)`,
    'idx_partner_support_partner'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS tenant_paystack_config (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      mode VARCHAR(20) NOT NULL DEFAULT 'scholarnerve',
      enabled BOOLEAN NOT NULL DEFAULT false,
      super_admin_enabled BOOLEAN NOT NULL DEFAULT false,
      fee_bearer VARCHAR(20) NOT NULL DEFAULT 'parent',
      subaccount_code VARCHAR(80),
      payout_account VARCHAR(120),
      own_secret_key_encrypted TEXT,
      own_public_key VARCHAR(120),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'tenant_paystack_config'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_tenant_paystack_config_tenant ON tenant_paystack_config(tenant_id)`,
    'idx_tenant_paystack_config_tenant'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS payment_transactions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      reference VARCHAR(80) NOT NULL UNIQUE,
      amount_kobo INTEGER NOT NULL,
      fee_kobo INTEGER NOT NULL DEFAULT 0,
      total_kobo INTEGER NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      mode VARCHAR(20) NOT NULL,
      paystack_id VARCHAR(80),
      payment_channel VARCHAR(40),
      paid_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'payment_transactions'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON payment_transactions(tenant_id, created_at DESC)`,
    'idx_payment_transactions_tenant'
  );
  await safe(
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_transaction_id INTEGER REFERENCES payment_transactions(id) ON DELETE SET NULL`,
    'payments_payment_transaction_id'
  );
  await safe(
    `ALTER TABLE tenant_paystack_config ADD COLUMN IF NOT EXISTS super_admin_enabled BOOLEAN NOT NULL DEFAULT false`,
    'tenant_paystack_config_super_admin_enabled'
  );
  await safe(
    `ALTER TABLE tenant_paystack_config ADD COLUMN IF NOT EXISTS fee_bearer VARCHAR(20) NOT NULL DEFAULT 'parent'`,
    'tenant_paystack_config_fee_bearer'
  );
  await safe(
    `INSERT INTO platform_settings (key, value) VALUES ('paystack', '{"useLiveKeys":false}'::jsonb) ON CONFLICT (key) DO NOTHING`,
    'platform_settings_paystack_seed'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS periods (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'periods'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_periods_tenant_order ON periods(tenant_id, order_index)`,
    'idx_periods_tenant_order'
  );
  await safe(
    `ALTER TABLE periods ADD COLUMN IF NOT EXISTS is_break BOOLEAN NOT NULL DEFAULT false`,
    'periods.is_break'
  );
  await safe(
    `ALTER TABLE periods ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE`,
    'periods.class_id'
  );
  await safe(
    `ALTER TABLE periods ADD COLUMN IF NOT EXISTS term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE`,
    'periods.term_id'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_periods_class_term_order ON periods(tenant_id, class_id, term_id, order_index)`,
    'idx_periods_class_term_order'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS class_timetable (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      day_of_week VARCHAR(12) NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, class_id, term_id, day_of_week, period_id)
    )`,
    'class_timetable'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_class_timetable_lookup ON class_timetable(tenant_id, class_id, term_id)`,
    'idx_class_timetable_lookup'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_class_timetable_teacher ON class_timetable(tenant_id, term_id, teacher_id, day_of_week, period_id)`,
    'idx_class_timetable_teacher'
  );
  await safe(
    `CREATE TABLE IF NOT EXISTS exam_timetable (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      exam_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      venue VARCHAR(200),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'exam_timetable'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_exam_timetable_lookup ON exam_timetable(tenant_id, class_id, term_id, exam_date)`,
    'idx_exam_timetable_lookup'
  );

  await safe(
    `CREATE TABLE IF NOT EXISTS platform_inquiries (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      school_name VARCHAR(200),
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      inquiry_type VARCHAR(40) NOT NULL DEFAULT 'contact',
      message TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      internal_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'platform_inquiries'
  );
  await safe(
    `CREATE INDEX IF NOT EXISTS idx_platform_inquiries_status ON platform_inquiries(status, created_at DESC)`,
    'idx_platform_inquiries_status'
  );

  const critical = [
    'subjects',
    'classes',
    'students',
    'academic_terms',
    'academic_years',
    'student_class_enrollments',
    'graduation_details',
    'school_setup_progress',
  ];
  for (const name of critical) {
    if (!(await tableExists(name))) {
      console.error(`❌ Critical table missing after ensureSchema: ${name}`);
    }
  }

  console.log('✅ Supplemental schema ensured');
}

const invokedDirectly =
  process.argv[1]?.replace(/\\/g, '/').endsWith('/ensureSchema.js') ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('/ensureSchema.ts');

if (invokedDirectly) {
  ensureSupplementalSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
