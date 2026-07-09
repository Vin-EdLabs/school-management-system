-- Soft-delete for parent desk and support chat messages
ALTER TABLE message_replies ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE parent_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Allow super-admin push subscriptions without a school tenant
ALTER TABLE staff_user_push_subscriptions ALTER COLUMN tenant_id DROP NOT NULL;
