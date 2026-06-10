-- School onboarding setup checklist progress (subjects → classes → terms)

CREATE TABLE IF NOT EXISTS school_setup_progress (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  has_subjects BOOLEAN NOT NULL DEFAULT false,
  has_classes BOOLEAN NOT NULL DEFAULT false,
  has_terms BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_school_setup_progress_school ON school_setup_progress (school_id);

-- Refresh helper: recalculate flags from live data
CREATE OR REPLACE FUNCTION refresh_school_setup_progress(p_school_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_subjects BOOLEAN;
  v_classes BOOLEAN;
  v_terms BOOLEAN;
  v_complete BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM subjects WHERE tenant_id = p_school_id) INTO v_subjects;
  SELECT EXISTS(SELECT 1 FROM classes WHERE tenant_id = p_school_id) INTO v_classes;
  SELECT
    EXISTS(SELECT 1 FROM academic_terms WHERE tenant_id = p_school_id)
    OR EXISTS(SELECT 1 FROM academic_years WHERE tenant_id = p_school_id)
  INTO v_terms;

  v_complete := v_subjects AND v_classes AND v_terms;

  INSERT INTO school_setup_progress (school_id, has_subjects, has_classes, has_terms, completed_at, updated_at)
  VALUES (
    p_school_id,
    v_subjects,
    v_classes,
    v_terms,
    CASE WHEN v_complete THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (school_id) DO UPDATE SET
    has_subjects = EXCLUDED.has_subjects,
    has_classes = EXCLUDED.has_classes,
    has_terms = EXCLUDED.has_terms,
    completed_at = CASE
      WHEN EXCLUDED.has_subjects AND EXCLUDED.has_classes AND EXCLUDED.has_terms
      THEN COALESCE(school_setup_progress.completed_at, NOW())
      ELSE NULL
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Triggers keep progress in sync when data is created
CREATE OR REPLACE FUNCTION trg_refresh_setup_on_subject()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_school_setup_progress(NEW.tenant_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS setup_progress_after_subject ON subjects;
CREATE TRIGGER setup_progress_after_subject
  AFTER INSERT ON subjects
  FOR EACH ROW EXECUTE PROCEDURE trg_refresh_setup_on_subject();

CREATE OR REPLACE FUNCTION trg_refresh_setup_on_class()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_school_setup_progress(NEW.tenant_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS setup_progress_after_class ON classes;
CREATE TRIGGER setup_progress_after_class
  AFTER INSERT ON classes
  FOR EACH ROW EXECUTE PROCEDURE trg_refresh_setup_on_class();

CREATE OR REPLACE FUNCTION trg_refresh_setup_on_academic_term()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_school_setup_progress(NEW.tenant_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS setup_progress_after_academic_term ON academic_terms;
CREATE TRIGGER setup_progress_after_academic_term
  AFTER INSERT ON academic_terms
  FOR EACH ROW EXECUTE PROCEDURE trg_refresh_setup_on_academic_term();

CREATE OR REPLACE FUNCTION trg_refresh_setup_on_academic_year()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_school_setup_progress(NEW.tenant_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS setup_progress_after_academic_year ON academic_years;
CREATE TRIGGER setup_progress_after_academic_year
  AFTER INSERT ON academic_years
  FOR EACH ROW EXECUTE PROCEDURE trg_refresh_setup_on_academic_year();

-- Seed rows for existing schools and sync flags
INSERT INTO school_setup_progress (school_id)
SELECT id FROM tenants
ON CONFLICT (school_id) DO NOTHING;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM tenants LOOP
    PERFORM refresh_school_setup_progress(r.id);
  END LOOP;
END $$;
