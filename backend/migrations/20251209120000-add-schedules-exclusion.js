export function up(db) {
  return db.runSql(`
    -- enable btree_gist to allow mixing = with range operators
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    -- create an immutable function to build time ranges
    CREATE OR REPLACE FUNCTION make_schedule_time_range(day_of_week INTEGER, start_time TIME, end_time TIME)
    RETURNS tstzrange
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT tstzrange(
        (date '2000-01-01' + (day_of_week || ' days')::interval + start_time)::timestamptz,
        (date '2000-01-01' + (day_of_week || ' days')::interval + end_time)::timestamptz,
        '[)'
      );
    $$;

    -- add a generated timestamptz range column using the immutable function
    ALTER TABLE schedules
      ADD COLUMN IF NOT EXISTS time_range tstzrange 
      GENERATED ALWAYS AS (make_schedule_time_range(day_of_week, start_time, end_time)) STORED;

    -- add exclusion constraints to prevent overlapping schedules for same class, teacher, or room on the same day
    ALTER TABLE schedules
      ADD CONSTRAINT no_class_time_overlap EXCLUDE USING gist (
        class_id WITH =,
        day_of_week WITH =,
        time_range WITH &&
      );

    ALTER TABLE schedules
      ADD CONSTRAINT no_teacher_time_overlap EXCLUDE USING gist (
        teacher_id WITH =,
        day_of_week WITH =,
        time_range WITH &&
      );

    ALTER TABLE schedules
      ADD CONSTRAINT no_room_time_overlap EXCLUDE USING gist (
        room WITH =,
        day_of_week WITH =,
        time_range WITH &&
      );
  `);
}

export function down(db) {
  return db.runSql(`
    ALTER TABLE schedules DROP CONSTRAINT IF EXISTS no_room_time_overlap;
    ALTER TABLE schedules DROP CONSTRAINT IF EXISTS no_teacher_time_overlap;
    ALTER TABLE schedules DROP CONSTRAINT IF EXISTS no_class_time_overlap;
    ALTER TABLE schedules DROP COLUMN IF EXISTS time_range;
    DROP FUNCTION IF EXISTS make_schedule_time_range(INTEGER, TIME, TIME);
  `);
}
