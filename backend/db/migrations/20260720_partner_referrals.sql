-- Partner-to-partner referral network

ALTER TABLE partners ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS referral_earnings NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_partners_referred_by ON partners (referred_by);

ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS commission_type VARCHAR(30) DEFAULT 'school';
ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS recruit_partner_id INTEGER REFERENCES partners(id);

UPDATE partner_commissions SET commission_type = 'school' WHERE commission_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_commissions_recruitment_unique
  ON partner_commissions (partner_id, recruit_partner_id, month, year)
  WHERE commission_type = 'recruitment_bonus';
