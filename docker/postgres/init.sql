-- ============================================
-- Chat Application Database Initialization Script
-- This script is idempotent and can be run multiple times
-- ============================================

-- Set timezone
SET TIME ZONE 'UTC';

-- Create enum types (if not exists)
DO $$ BEGIN
    CREATE TYPE enum_users_status AS ENUM ('online', 'idle', 'do-not-disturb', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_users_role AS ENUM ('admin', 'moderator', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_channels_type AS ENUM ('text', 'voice', 'video');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_user_channels_role AS ENUM ('admin', 'moderator', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    status enum_users_status DEFAULT 'offline',
    role enum_users_role DEFAULT 'member',
    is_verified BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    type enum_channels_type DEFAULT 'text',
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    content JSONB NOT NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_channels table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_channels (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    role enum_user_channels_role DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, channel_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_user_channels_user_id ON user_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_channel_id ON user_channels(channel_id);

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

-- Insert default channels (if not exists)
INSERT INTO channels (name, type, description)
VALUES 
    ('general', 'text', 'General discussion channel'),
    ('random', 'text', 'Random topics and fun conversations'),
    ('development', 'text', 'Development and coding discussion'),
    ('design', 'text', 'Design and UI/UX discussion'),
    ('voice-1', 'voice', 'General voice channel'),
    ('voice-2', 'voice', 'Private voice channel')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
