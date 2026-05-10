-- ============================================
-- Chat Application Database Initialization Script
-- Matches GORM model definitions exactly
-- ============================================

-- Set timezone
SET TIME ZONE 'UTC';

-- ============================================
-- Users table
-- - email: uniqueIndex (用于登录识别)
-- - username: 可重复，仅普通索引
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'member',
    bio TEXT,
    last_seen TIMESTAMP WITH TIME ZONE,
    is_online BOOLEAN DEFAULT FALSE
);

-- ============================================
-- Channel_groups table (servers/guilds)
-- - invite_code: uniqueIndex (size:12)
-- ============================================
CREATE TABLE IF NOT EXISTS channel_groups (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(12) UNIQUE NOT NULL
);

-- ============================================
-- Channels table
-- - Composite uniqueIndex: idx_channel_group_name (group_id, name)
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    description TEXT,
    group_id INTEGER NOT NULL REFERENCES channel_groups(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Composite unique index for channels (group_id + name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_group_name ON channels(group_id, name) WHERE deleted_at IS NULL;

-- ============================================
-- Messages table
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    content TEXT NOT NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE
);

-- ============================================
-- User_channels table (legacy, may not be used)
-- ============================================
CREATE TABLE IF NOT EXISTS user_channels (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE
);

-- ============================================
-- User_groups table (group membership)
-- ============================================
CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES channel_groups(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member'
);

-- Prevent duplicate membership (user can only join a group once)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_groups_unique ON user_groups(user_id, group_id) WHERE deleted_at IS NULL;

-- ============================================
-- Performance indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channel_groups_invite_code ON channel_groups(invite_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channels_group_id ON channels(group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id) WHERE deleted_at IS NULL;

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_channel_groups_updated_at ON channel_groups;
CREATE TRIGGER update_channel_groups_updated_at
    BEFORE UPDATE ON channel_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
CREATE TRIGGER update_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_channels_updated_at ON user_channels;
CREATE TRIGGER update_user_channels_updated_at
    BEFORE UPDATE ON user_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_groups_updated_at ON user_groups;
CREATE TRIGGER update_user_groups_updated_at
    BEFORE UPDATE ON user_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();