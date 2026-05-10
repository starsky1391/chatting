-- ============================================
-- Chat Application Database Initialization Script
-- This script is idempotent and can be run multiple times
-- ============================================

-- Set timezone
SET TIME ZONE 'UTC';

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'member',
    bio TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create channel_groups table (servers/guilds)
CREATE TABLE IF NOT EXISTS channel_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create channels table (composite unique: group_id + name)
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    description TEXT,
    group_id INTEGER NOT NULL REFERENCES channel_groups(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(group_id, name)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create user_groups table (group membership)
CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES channel_groups(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, group_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_channels_group_id ON channels(group_id);
CREATE INDEX IF NOT EXISTS idx_channel_groups_invite_code ON channel_groups(invite_code);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
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

DROP TRIGGER IF EXISTS update_user_groups_updated_at ON user_groups;
CREATE TRIGGER update_user_groups_updated_at
    BEFORE UPDATE ON user_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
