-- Apply with psql before starting the API.
-- Passwords are Argon2id hashes. Refresh tokens are SHA-256 digests only.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email_lookup_hash TEXT NOT NULL CHECK (length(email_lookup_hash) = 64),
  email_lookup_key_version INTEGER NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email_lookup_key_version, email_lookup_hash)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expiry_idx ON refresh_tokens(expires_at);

-- AES-256-GCM protected fields keep ciphertext, nonce, authentication tag,
-- and key version together for safe decryption and future key rotation.
CREATE TABLE IF NOT EXISTS encrypted_profile_fields (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL CHECK (octet_length(nonce) = 12),
  auth_tag BYTEA NOT NULL CHECK (octet_length(auth_tag) = 16),
  key_version INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, field_name)
);
