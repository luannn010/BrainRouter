CREATE TABLE IF NOT EXISTS design_artifacts (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  screen_id TEXT NOT NULL,
  artifact JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, flow_id, screen_id)
);

CREATE INDEX IF NOT EXISTS idx_design_artifacts_user_updated
  ON design_artifacts (user_id, updated_at DESC);
