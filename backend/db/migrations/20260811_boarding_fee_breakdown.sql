-- Split term boarding fee into lodging (hostel) and feeding components

ALTER TABLE boarding_term_fees
  ADD COLUMN IF NOT EXISTS lodging_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feeding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE boarding_term_fees
SET lodging_amount = amount,
    feeding_amount = 0
WHERE lodging_amount = 0
  AND feeding_amount = 0
  AND amount > 0;
