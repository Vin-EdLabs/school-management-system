-- In-app messaging: channels, members, messages, DMs

DO $$ BEGIN
  CREATE TYPE chat_channel_type AS ENUM ('general', 'teachers', 'non_teaching', 'announcements', 'dm');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS chat_channels (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  channel_type chat_channel_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_tenant_type_uidx
  ON chat_channels (tenant_id, channel_type)
  WHERE channel_type <> 'dm';

CREATE TABLE IF NOT EXISTS chat_channel_members (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_channel_members_user_idx ON chat_channel_members(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_label VARCHAR(100),
  message TEXT,
  image_url TEXT,
  image_thumbnail_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx
  ON chat_messages(channel_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS dm_conversations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  participant_one INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_two INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, participant_one, participant_two)
);

CREATE INDEX IF NOT EXISTS dm_conversations_participants_idx
  ON dm_conversations(tenant_id, participant_one, participant_two);
