-- Per-school demo meeting link (Google Meet, Zoom, etc.) set by ScholarNerve admin
ALTER TABLE partner_school_leads ADD COLUMN IF NOT EXISTS demo_meeting_url TEXT;
