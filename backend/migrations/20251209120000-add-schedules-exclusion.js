export function up(db) {
  return db.runSql(`
    -- enable btree_gist to allow mixing = with range operators
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    -- add a generated timestamptz range column anchored to a reference week
    ALTER TABLE schedules
      ADD COLUMN IF NOT EXISTS time_range tstzrange GENERATED ALWAYS AS (
        tstzrange(
          (date '2000-01-01' + (day_of_week || ' days')::interval + start_time)::timestamptz,
          (date '2000-01-01' + (day_of_week || ' days')::interval + end_time)::timestamptz,
          '[)'
        )
      ) STORED;

    -- add exclusion constraints to prevent overlapping schedules for same class, teacher, or room on the same day
    ALTER TABLE schedules
      ADD CONSTRAINT IF NOT EXISTS no_class_time_overlap EXCLUDE USING gist (
        class_id WITH =,
        day_of_week WITH =,
        time_range WITH &&
      );

    ALTER TABLE schedules
      ADD CONSTRAINT IF NOT EXISTS no_teacher_time_overlap EXCLUDE USING gist (
        teacher_id WITH =,
        day_of_week WITH =,
        time_range WITH &&
      );

    ALTER TABLE schedules
      ADD CONSTRAINT IF NOT EXISTS no_room_time_overlap EXCLUDE USING gist (
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
  `);
}
