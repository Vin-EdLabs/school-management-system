-- Detect class conflicts: two schedules for same class overlapping on same day
SELECT a.*, b.id as conflicting_id, b.class_id as conflicting_class_id, b.teacher_id as conflicting_teacher_id, b.start_time as conflicting_start_time, b.end_time as conflicting_end_time
FROM schedules a
JOIN schedules b ON a.class_id = b.class_id AND a.id <> b.id AND a.day_of_week = b.day_of_week
WHERE NOT (a.end_time <= b.start_time OR a.start_time >= b.end_time)
ORDER BY a.class_id, a.day_of_week, a.start_time;

-- Detect teacher conflicts: teacher assigned to overlapping schedules on same day
SELECT a.*, b.id as conflicting_id, b.class_id as conflicting_class_id, b.teacher_id as conflicting_teacher_id, b.start_time as conflicting_start_time, b.end_time as conflicting_end_time
FROM schedules a
JOIN schedules b ON a.teacher_id = b.teacher_id AND a.id <> b.id AND a.day_of_week = b.day_of_week
WHERE a.teacher_id IS NOT NULL AND NOT (a.end_time <= b.start_time OR a.start_time >= b.end_time)
ORDER BY a.teacher_id, a.day_of_week, a.start_time;

-- Detect room conflicts
SELECT a.*, b.id as conflicting_id, b.room as conflicting_room, b.start_time as conflicting_start_time, b.end_time as conflicting_end_time
FROM schedules a
JOIN schedules b ON a.room = b.room AND a.id <> b.id AND a.day_of_week = b.day_of_week
WHERE a.room IS NOT NULL AND NOT (a.end_time <= b.start_time OR a.start_time >= b.end_time)
ORDER BY a.room, a.day_of_week, a.start_time;
