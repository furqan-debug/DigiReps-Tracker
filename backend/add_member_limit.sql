-- Add member_limit column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS member_limit INTEGER;
