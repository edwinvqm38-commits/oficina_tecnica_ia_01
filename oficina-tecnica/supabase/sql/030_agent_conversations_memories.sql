-- ────────────────────────────────────────────────────────────────────────────
-- 030  Agent Conversations & Memories Tables
-- Paste this entire file in the Supabase SQL Editor and click Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ── agent_conversations ────────────────────────────────────────────────────
-- Stores every chat message between a user and an AI agent.
-- user_id stores the email (matches the value used in saveConversation()).
CREATE TABLE IF NOT EXISTS agent_conversations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text        NOT NULL,
  agent_id    text        NOT NULL,          -- 'ic' | 'pm' | 'ie' | 'gg'
  project_id  text,                          -- cotización code, optional
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  model_used  text,                          -- e.g. 'gemini/gemini-1.5-flash'
  complexity  text,                          -- 'simple' | 'technical' | 'analytical' | 'generative'
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ac_user_agent
  ON agent_conversations (user_id, agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ac_project
  ON agent_conversations (project_id, agent_id)
  WHERE project_id IS NOT NULL;

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_conversations" ON agent_conversations;
CREATE POLICY "users_own_conversations" ON agent_conversations
  FOR ALL
  USING  (auth.email() = user_id)
  WITH CHECK (auth.email() = user_id);

DROP POLICY IF EXISTS "admin_read_conversations" ON agent_conversations;
CREATE POLICY "admin_read_conversations" ON agent_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gerencia')
    )
  );


-- ── agent_memories ─────────────────────────────────────────────────────────
-- Stores learned decisions and operational criteria by agent.
CREATE TABLE IF NOT EXISTS agent_memories (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id     text        NOT NULL,
  project_id   text,
  memory_type  text        NOT NULL CHECK (memory_type IN ('decision', 'learning', 'context')),
  content      text        NOT NULL,
  importance   integer     DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
  created_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_am_agent
  ON agent_memories (agent_id, importance DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_am_project
  ON agent_memories (project_id, agent_id)
  WHERE project_id IS NOT NULL;

ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_memories" ON agent_memories;
CREATE POLICY "authenticated_read_memories" ON agent_memories
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_write_memories" ON agent_memories;
CREATE POLICY "admin_write_memories" ON agent_memories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gerencia', 'responsable')
    )
  );


-- ── verify ─────────────────────────────────────────────────────────────────
SELECT table_name,
       pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
FROM   information_schema.tables
WHERE  table_schema = 'public'
  AND  table_name IN ('agent_conversations', 'agent_memories')
ORDER  BY table_name;
