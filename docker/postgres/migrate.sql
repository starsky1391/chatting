-- ============================================
-- Migration: Update invite_code to be globally unique
-- ============================================

-- Drop the old composite unique index if exists
DROP INDEX IF EXISTS idx_owner_invite;

-- Alter invite_code column to 12 characters
ALTER TABLE channel_groups ALTER COLUMN invite_code TYPE VARCHAR(12);

-- Create new unique index on invite_code alone
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_groups_invite_code ON channel_groups(invite_code);

-- Clear existing data to avoid conflicts (optional, comment out if you want to keep data)
-- TRUNCATE TABLE user_groups, messages, channels, channel_groups RESTART IDENTITY CASCADE;
