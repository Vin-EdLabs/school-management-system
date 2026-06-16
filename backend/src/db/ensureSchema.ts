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
  await safe(`UPDATE academic_years SET status = 'active' WHERE status IS NULL`, 'academic_years.status backfill');

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

  await safe(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255)`, 'teachers.emergency_contact_name');
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
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super-admin', 'administrator', 'finance', 'teacher', 'staff', 'driver'))`,
    'users.role_check add driver'
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
