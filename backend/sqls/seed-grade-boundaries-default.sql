-- Idempotent seed: insert default grade boundaries (school-wide, class_id NULL)
-- Runs safely multiple times without creating duplicates.

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'A+', 97, 100, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'A+' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'A', 93, 96, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'A' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'A-', 90, 92, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'A-' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'B+', 87, 89, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'B+' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'B', 83, 86, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'B' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'B-', 80, 82, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'B-' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'C+', 77, 79, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'C+' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'C', 73, 76, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'C' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'C-', 70, 72, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'C-' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'D+', 67, 69, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'D+' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'D', 65, 66, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'D' AND school_id IS NULL AND class_id IS NULL);

INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by)
SELECT 'F', 0, 64, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM grade_boundaries WHERE grade = 'F' AND school_id IS NULL AND class_id IS NULL);
