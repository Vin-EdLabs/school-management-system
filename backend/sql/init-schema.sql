BEGIN;

-- Use this complete block at the top of your SQL script
CREATE OR REPLACE FUNCTION public.make_schedule_time_range(
    day_of_week integer,
    start_time time without time zone,
    end_time time without time zone
)
RETURNS tstzrange AS $$
DECLARE
    -- Determine the current date to use as a reference point for the day_of_week
    ref_date date := now()::date; 
    start_ts timestamp without time zone;
    end_ts timestamp without time zone;
BEGIN
    -- Calculate a timestamp for the specific day_of_week and start_time 
    -- using ISO weeks (Monday=1, Sunday=7)
    start_ts := (ref_date + (day_of_week - extract(isodow from ref_date))::int)::timestamp without time zone + start_time::interval;
    end_ts := (ref_date + (day_of_week - extract(isodow from ref_date))::int)::timestamp without time zone + end_time::interval;

    RETURN tstzrange(start_ts, end_ts, '[)'); -- Return a non-inclusive upper bound range
END;
$$ LANGUAGE plpgsql IMMUTABLE; -- Make sure to fix IMMABLE to IMMUTABLE


CREATE TABLE IF NOT EXISTS public.academic_terms
(
    id serial NOT NULL,
    academic_year_id integer,
    name text COLLATE pg_catalog."default" NOT NULL,
    start_date date,
    end_date date,
    is_active boolean DEFAULT false,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT academic_terms_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.academic_years
(
    id serial NOT NULL,
    year_label text COLLATE pg_catalog."default" NOT NULL,
    start_date date,
    end_date date,
    is_active boolean DEFAULT false,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT academic_years_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.attendance
(
    id serial NOT NULL,
    class_id integer NOT NULL,
    student_id integer NOT NULL,
    attendance_date date NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL,
    marked_by integer,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_pkey PRIMARY KEY (id),
    CONSTRAINT attendance_student_id_attendance_date_key UNIQUE (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.audit_log
(
    id serial NOT NULL,
    user_id integer,
    action text COLLATE pg_catalog."default" NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs
(
    id serial NOT NULL,
    user_id integer,
    action text COLLATE pg_catalog."default" NOT NULL,
    message text COLLATE pg_catalog."default",
    target_type text COLLATE pg_catalog."default",
    target_id integer,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.blacklisted_tokens
(
    id serial NOT NULL,
    token text COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT blacklisted_tokens_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.classes
(
    id serial NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    max_class_size integer NOT NULL DEFAULT 30,
    level text COLLATE pg_catalog."default",
    stream text COLLATE pg_catalog."default",
    CONSTRAINT classes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.events
(
    id serial NOT NULL,
    title text COLLATE pg_catalog."default" NOT NULL,
    date timestamp with time zone NOT NULL,
    "time" text COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    color text COLLATE pg_catalog."default",
    category text COLLATE pg_catalog."default",
    reminder boolean DEFAULT false,
    reminder_time integer,
    location text COLLATE pg_catalog."default",
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.exam_types
(
    id serial NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    weight numeric DEFAULT 0,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT exam_types_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.exams
(
    id serial NOT NULL,
    exam_type_id integer,
    class_id integer,
    subject_id integer,
    term text COLLATE pg_catalog."default",
    exam_date timestamp with time zone,
    is_locked boolean DEFAULT false,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT exams_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.expenses
(
    id serial NOT NULL,
    amount numeric(12, 2) NOT NULL,
    description text COLLATE pg_catalog."default",
    category text COLLATE pg_catalog."default",
    year integer,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT expenses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fee_items
(
    id serial NOT NULL,
    fee_structure_id integer,
    code text COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    amount numeric(12, 2) NOT NULL,
    is_optional boolean DEFAULT false,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT fee_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fee_structures
(
    id serial NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    items jsonb,
    term_id integer,
    class_id integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fee_structures_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grade_audit
(
    id serial NOT NULL,
    grade_id integer,
    changed_by integer,
    old_value jsonb,
    new_value jsonb,
    change_type text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT grade_audit_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grade_boundaries
(
    id serial NOT NULL,
    grade text COLLATE pg_catalog."default" NOT NULL,
    min integer NOT NULL,
    max integer NOT NULL,
    school_id integer,
    class_id integer,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT grade_boundaries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grades
(
    id serial NOT NULL,
    exam_id integer,
    student_id integer,
    score numeric,
    status text COLLATE pg_catalog."default" DEFAULT 'OK'::text,
    remarks text COLLATE pg_catalog."default",
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT grades_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.guardians
(
    id serial NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    relationship text COLLATE pg_catalog."default",
    phone text COLLATE pg_catalog."default",
    email text COLLATE pg_catalog."default",
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT guardians_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.income
(
    id serial NOT NULL,
    amount numeric(12, 2) NOT NULL,
    description text COLLATE pg_catalog."default",
    year integer,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT income_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.invoice_items
(
    id serial NOT NULL,
    invoice_id integer,
    fee_item_id integer,
    description text COLLATE pg_catalog."default",
    amount numeric(12, 2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoice_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.invoices
(
    id serial NOT NULL,
    student_id integer,
    fee_structure_id integer,
    term_id integer,
    due_date date,
    status text COLLATE pg_catalog."default" DEFAULT 'open'::text,
    total_amount numeric(12, 2) DEFAULT 0,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoices_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.migrations
(
    id serial NOT NULL,
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    run_on timestamp without time zone NOT NULL,
    CONSTRAINT migrations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications
(
    id serial NOT NULL,
    user_id integer,
    message text COLLATE pg_catalog."default" NOT NULL,
    level text COLLATE pg_catalog."default" DEFAULT 'info'::text,
    is_read boolean DEFAULT false,
    expires_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payment_allocations
(
    id serial NOT NULL,
    payment_id integer,
    invoice_item_id integer,
    amount numeric(12, 2) NOT NULL,
    CONSTRAINT payment_allocations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payments
(
    id serial NOT NULL,
    student_id integer,
    amount numeric(12, 2) NOT NULL,
    method text COLLATE pg_catalog."default",
    term_id integer,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_deductions
(
    id serial NOT NULL,
    payroll_item_id integer,
    deduction_type character varying(100) COLLATE pg_catalog."default" NOT NULL,
    amount numeric(12, 2) NOT NULL,
    description text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_deductions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_items
(
    id serial NOT NULL,
    payroll_run_id integer,
    staff_id integer,
    base_salary numeric(12, 2) NOT NULL,
    deductions numeric(12, 2) DEFAULT 0,
    bonuses numeric(12, 2) DEFAULT 0,
    net_amount numeric(12, 2) NOT NULL,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_payments
(
    id serial NOT NULL,
    payroll_item_id integer,
    staff_id integer,
    amount numeric(12, 2) NOT NULL,
    payment_method character varying(50) COLLATE pg_catalog."default" DEFAULT 'bank_transfer'::character varying,
    payment_date timestamp with time zone NOT NULL,
    reference_number character varying(100) COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_payments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_reports
(
    id serial NOT NULL,
    payroll_run_id integer,
    report_type character varying(50) COLLATE pg_catalog."default",
    total_staff integer,
    total_paid numeric(12, 2),
    generated_at timestamp with time zone DEFAULT now(),
    generated_by integer,
    CONSTRAINT payroll_reports_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payroll_runs
(
    id serial NOT NULL,
    month_year character varying(10) COLLATE pg_catalog."default" NOT NULL,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'draft'::character varying,
    total_amount numeric(12, 2) DEFAULT 0,
    processed_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_runs_pkey PRIMARY KEY (id),
    CONSTRAINT payroll_runs_month_year_key UNIQUE (month_year)
);

CREATE TABLE IF NOT EXISTS public.schedules
(
    id serial NOT NULL,
    class_id integer,
    teacher_id integer,
    day_of_week smallint NOT NULL DEFAULT 1,
    start_time time without time zone,
    end_time time without time zone,
    room text COLLATE pg_catalog."default",
    subject text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    time_range tstzrange GENERATED ALWAYS AS (make_schedule_time_range((day_of_week)::integer, start_time, end_time)) STORED,
    CONSTRAINT schedules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.settings
(
    key text COLLATE pg_catalog."default" NOT NULL,
    value jsonb,
    CONSTRAINT settings_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.student_guardians
(
    student_id integer NOT NULL,
    guardian_id integer NOT NULL,
    primary_contact boolean DEFAULT false,
    CONSTRAINT student_guardians_pkey PRIMARY KEY (student_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS public.students
(
    id serial NOT NULL,
    first_name text COLLATE pg_catalog."default" NOT NULL,
    last_name text COLLATE pg_catalog."default" NOT NULL,
    class_id integer,
    status text COLLATE pg_catalog."default" DEFAULT 'active'::text,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    admission_no text COLLATE pg_catalog."default",
    gender text COLLATE pg_catalog."default",
    date_of_birth date,
    nationality text COLLATE pg_catalog."default",
    guardian_name text COLLATE pg_catalog."default",
    guardian_contact text COLLATE pg_catalog."default",
    home_address text COLLATE pg_catalog."default",
    previous_school text COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    date_of_admission date,
    CONSTRAINT students_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subjects
(
    id serial NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    class_id integer,
    teacher_id integer,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subjects_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.teacher_classes
(
    teacher_id integer NOT NULL,
    class_id integer NOT NULL,
    CONSTRAINT teacher_classes_pkey PRIMARY KEY (teacher_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.users
(
    id serial NOT NULL,
    username text COLLATE pg_catalog."default" NOT NULL,
    password_hash text COLLATE pg_catalog."default" NOT NULL,
    role text COLLATE pg_catalog."default" NOT NULL DEFAULT 'staff'::text,
    created_at timestamp with time zone DEFAULT now(),
    meta jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    email text COLLATE pg_catalog."default",
    display_name text COLLATE pg_catalog."default",
    password_changed boolean DEFAULT false,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_username_key UNIQUE (username)
);

ALTER TABLE IF EXISTS public.academic_terms
    ADD CONSTRAINT academic_terms_academic_year_id_fkey FOREIGN KEY (academic_year_id)
    REFERENCES public.academic_years (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_academic_terms_year
    ON public.academic_terms(academic_year_id);


ALTER TABLE IF EXISTS public.attendance
    ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id)
    REFERENCES public.classes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.attendance
    ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.attendance
    ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id)
    REFERENCES public.students (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON public.audit_logs(user_id);


ALTER TABLE IF EXISTS public.exams
    ADD CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id)
    REFERENCES public.classes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.exams
    ADD CONSTRAINT exams_exam_type_id_fkey FOREIGN KEY (exam_type_id)
    REFERENCES public.exam_types (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.exams
    ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id)
    REFERENCES public.subjects (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.fee_items
    ADD CONSTRAINT fee_items_fee_structure_id_fkey FOREIGN KEY (fee_structure_id)
    REFERENCES public.fee_structures (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_fee_items_structure
    ON public.fee_items(fee_structure_id);


ALTER TABLE IF EXISTS public.fee_structures
    ADD CONSTRAINT fee_structures_class_id_fkey FOREIGN KEY (class_id)
    REFERENCES public.classes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.grade_audit
    ADD CONSTRAINT grade_audit_grade_id_fkey FOREIGN KEY (grade_id)
    REFERENCES public.grades (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.grades
    ADD CONSTRAINT grades_exam_id_fkey FOREIGN KEY (exam_id)
    REFERENCES public.exams (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.grades
    ADD CONSTRAINT grades_student_id_fkey FOREIGN KEY (student_id)
    REFERENCES public.students (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.invoice_items
    ADD CONSTRAINT invoice_items_fee_item_id_fkey FOREIGN KEY (fee_item_id)
    REFERENCES public.fee_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id)
    REFERENCES public.invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.invoices
    ADD CONSTRAINT invoices_fee_structure_id_fkey FOREIGN KEY (fee_structure_id)
    REFERENCES public.fee_structures (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.invoices
    ADD CONSTRAINT invoices_student_id_fkey FOREIGN KEY (student_id)
    REFERENCES public.students (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.invoices
    ADD CONSTRAINT invoices_term_id_fkey FOREIGN KEY (term_id)
    REFERENCES public.academic_terms (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;


ALTER TABLE IF EXISTS public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.payment_allocations
    ADD CONSTRAINT payment_allocations_invoice_item_id_fkey FOREIGN KEY (invoice_item_id)
    REFERENCES public.invoice_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;


ALTER TABLE IF EXISTS public.payment_allocations
    ADD CONSTRAINT payment_allocations_payment_id_fkey FOREIGN KEY (payment_id)
    REFERENCES public.payments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id)
    REFERENCES public.students (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payments_student
    ON public.payments(student_id);


ALTER TABLE IF EXISTS public.payroll_deductions
    ADD CONSTRAINT payroll_deductions_payroll_item_id_fkey FOREIGN KEY (payroll_item_id)
    REFERENCES public.payroll_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.payroll_items
    ADD CONSTRAINT payroll_items_payroll_run_id_fkey FOREIGN KEY (payroll_run_id)
    REFERENCES public.payroll_runs (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payroll_items_run
    ON public.payroll_items(payroll_run_id);


ALTER TABLE IF EXISTS public.payroll_items
    ADD CONSTRAINT payroll_items_staff_id_fkey FOREIGN KEY (staff_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payroll_items_staff
    ON public.payroll_items(staff_id);


ALTER TABLE IF EXISTS public.payroll_payments
    ADD CONSTRAINT payroll_payments_payroll_item_id_fkey FOREIGN KEY (payroll_item_id)
    REFERENCES public.payroll_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payroll_payments_item
    ON public.payroll_payments(payroll_item_id);


ALTER TABLE IF EXISTS public.payroll_payments
    ADD CONSTRAINT payroll_payments_staff_id_fkey FOREIGN KEY (staff_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.payroll_reports
    ADD CONSTRAINT payroll_reports_generated_by_fkey FOREIGN KEY (generated_by)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.payroll_reports
    ADD CONSTRAINT payroll_reports_payroll_run_id_fkey FOREIGN KEY (payroll_run_id)
    REFERENCES public.payroll_runs (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.schedules
    ADD CONSTRAINT schedules_class_id_fkey FOREIGN KEY (class_id)
    REFERENCES public.classes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.schedules
    ADD CONSTRAINT schedules_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.student_guardians
    ADD CONSTRAINT student_guardians_guardian_id_fkey FOREIGN KEY (guardian_id)
    REFERENCES public.guardians (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.student_guardians
    ADD CONSTRAINT student_guardians_student_id_fkey FOREIGN KEY (student_id)
    REFERENCES public.students (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.students
    ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id)
    REFERENCES public.classes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_students_class
    ON public.students(class_id);


ALTER TABLE IF EXISTS public.subjects
    ADD CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id)
    REFERENCES public.classes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.subjects
    ADD CONSTRAINT subjects_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.teacher_classes
    ADD CONSTRAINT teacher_classes_class_id_fkey FOREIGN KEY (class_id)
    REFERENCES public.classes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.teacher_classes
    ADD CONSTRAINT teacher_classes_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

END;