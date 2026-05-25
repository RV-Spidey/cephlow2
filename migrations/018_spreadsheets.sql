CREATE TABLE IF NOT EXISTS spreadsheets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       TEXT        NOT NULL,
  name          TEXT        NOT NULL DEFAULT 'Untitled Spreadsheet',
  columns       TEXT[]      NOT NULL DEFAULT '{}',
  rows          JSONB       NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spreadsheets_workspace_idx ON spreadsheets(workspace_id);
