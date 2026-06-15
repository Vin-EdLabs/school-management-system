-- Standardize non-teaching staff IDs to STF001 format
UPDATE other_staff
SET staff_id = 'STF' || LPAD(
  COALESCE(NULLIF(REGEXP_REPLACE(UPPER(staff_id), '[^0-9]', '', 'g'), ''), id::text),
  3, '0'
)
WHERE staff_id IS NULL
   OR TRIM(staff_id) = ''
   OR UPPER(staff_id) LIKE 'OTH%'
   OR UPPER(staff_id) LIKE 'STAFF%';
