-- Drop trigger and function
DROP TRIGGER IF EXISTS attendance_updated_at ON attendance;
DROP FUNCTION IF EXISTS update_attendance_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_attendance_date;
DROP INDEX IF EXISTS idx_attendance_student_date;
DROP INDEX IF EXISTS idx_attendance_class_date;

-- Drop table
DROP TABLE IF EXISTS attendance;
