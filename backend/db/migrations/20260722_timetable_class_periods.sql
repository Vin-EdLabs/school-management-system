-- Scope timetable columns (periods) per class + term so each class has its own times/breaks.

ALTER TABLE periods ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE periods ADD COLUMN IF NOT EXISTS term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_periods_class_term_order
  ON periods(tenant_id, class_id, term_id, order_index);
