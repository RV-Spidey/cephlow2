-- Split Google tokens by scope type so users can connect only what they need.
-- Existing tokens (pre-split) are treated as 'all' scope.

ALTER TABLE user_google_tokens
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'all';

-- Change PK to (user_id, scope_type)
ALTER TABLE user_google_tokens DROP CONSTRAINT IF EXISTS user_google_tokens_pkey;
ALTER TABLE user_google_tokens ADD PRIMARY KEY (user_id, scope_type);

-- Also store scope_type in the pending auth flow
ALTER TABLE pending_google_auth
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'all';
