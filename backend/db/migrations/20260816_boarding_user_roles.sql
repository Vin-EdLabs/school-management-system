-- Allow boarding staff roles on user accounts (matron, house master)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super-admin',
    'administrator',
    'finance',
    'teacher',
    'staff',
    'driver',
    'headmaster',
    'website-manager',
    'matron',
    'house-master'
  ));
