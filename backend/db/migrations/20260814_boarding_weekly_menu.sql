-- Weekly boarding meal menu (Mon–Fri), not attendance tracking

CREATE TABLE IF NOT EXISTS boarding_weekly_menu (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  menu_item TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, week_start_date, day_of_week, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_boarding_weekly_menu_tenant_week
  ON boarding_weekly_menu(tenant_id, week_start_date);
