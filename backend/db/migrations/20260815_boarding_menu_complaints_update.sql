-- Permanent tenant meal menu (Mon–Sun, no week dates) + align complaint statuses

ALTER TABLE boarding_weekly_menu DROP CONSTRAINT IF EXISTS boarding_weekly_menu_day_of_week_check;
ALTER TABLE boarding_weekly_menu ADD CONSTRAINT boarding_weekly_menu_day_of_week_check
  CHECK (day_of_week BETWEEN 1 AND 7);

DELETE FROM boarding_weekly_menu a
USING boarding_weekly_menu b
WHERE a.tenant_id = b.tenant_id
  AND a.day_of_week = b.day_of_week
  AND a.meal_type = b.meal_type
  AND a.updated_at < b.updated_at;

ALTER TABLE boarding_weekly_menu DROP CONSTRAINT IF EXISTS boarding_weekly_menu_tenant_id_week_start_date_day_of_week_meal_type_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boarding_weekly_menu' AND column_name = 'week_start_date'
  ) THEN
    ALTER TABLE boarding_weekly_menu DROP COLUMN week_start_date;
  END IF;
END $$;

ALTER TABLE boarding_weekly_menu DROP CONSTRAINT IF EXISTS boarding_weekly_menu_tenant_day_meal_unique;
ALTER TABLE boarding_weekly_menu
  ADD CONSTRAINT boarding_weekly_menu_tenant_day_meal_unique UNIQUE (tenant_id, day_of_week, meal_type);

DROP INDEX IF EXISTS idx_boarding_weekly_menu_tenant_week;
CREATE INDEX IF NOT EXISTS idx_boarding_weekly_menu_tenant ON boarding_weekly_menu(tenant_id);

UPDATE boarding_complaints SET status = 'pending' WHERE status = 'open';
UPDATE boarding_complaints SET status = 'under_review' WHERE status IN ('reviewed', 'escalated');

ALTER TABLE boarding_complaints DROP CONSTRAINT IF EXISTS boarding_complaints_status_check;
ALTER TABLE boarding_complaints ADD CONSTRAINT boarding_complaints_status_check
  CHECK (status IN ('pending', 'under_review', 'resolved'));
