-- Migration: Add login_at column for absolute session expiry enforcement
-- Run this BEFORE deploying the new backend code.

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS login_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Purge all existing long-lived (30-day) tokens so users re-login after deploy
DELETE FROM refresh_tokens;
