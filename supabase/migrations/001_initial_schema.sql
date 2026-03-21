-- Quinn — Phase 1 Initial Schema
-- Run in Supabase SQL editor or via `supabase db push`

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Links every auth.users row to a role. Parents have is_parent=true.
-- Kids have is_parent=false and kid_id pointing to their kids row.
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_parent  boolean NOT NULL DEFAULT false,
  kid_id     uuid,                        -- null for parents; set for kids
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── kids ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kids (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  age            integer,
  grade          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz
);

-- Close the forward-reference: profiles.kid_id → kids.id
ALTER TABLE profiles
  ADD CONSTRAINT profiles_kid_id_fkey
  FOREIGN KEY (kid_id) REFERENCES kids(id) ON DELETE SET NULL;

-- ── learner_profiles ─────────────────────────────────────────────────────────
-- One living JSONB document per kid, updated after every conversation.
-- profile_json shape (example):
--   { "interests": ["Pokémon","animals"], "learning_style": "...",
--     "font_preference": "dyslexic", "communication_notes": "..." }
CREATE TABLE IF NOT EXISTS learner_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id       uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  profile_json jsonb NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kid_id)
);

-- ── session_summaries ─────────────────────────────────────────────────────────
-- Written incrementally during each conversation; finalised on inactivity timeout.
CREATE TABLE IF NOT EXISTS session_summaries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id               uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  started_at           timestamptz NOT NULL DEFAULT now(),
  ended_at             timestamptz,
  duration_minutes     integer,
  mood_open            text,   -- kid's mood at start of session
  mood_close           text,   -- kid's mood at end of session
  subjects_touched     text[], -- e.g. ARRAY['Math','English']
  academic_notes       text,
  personal_notes       text,   -- NOT shown to parents; used for continuity only
  readiness_estimate   jsonb,  -- e.g. {"Math": 0.7, "English": 0.9}
  communication_notes  text
);

-- ── exams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id     uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  subject    text NOT NULL,
  exam_type  text,           -- e.g. 'quiz', 'midterm', 'final'
  exam_date   date NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz -- null = active; set to archive without deleting
);

-- ── study_materials ───────────────────────────────────────────────────────────
-- source_type is intentionally kept for v2 YouTube co-watching support.
CREATE TABLE IF NOT EXISTS study_materials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id         uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  subject        text,
  source_type    text,     -- 'pdf' | 'youtube' | 'gdoc' | 'text'
  file_url       text,
  file_name      text,
  material_summary text,
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  archived_at      timestamptz -- null = active; set to archive without deleting
);

-- ── parent_notes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id     uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  note       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids              ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_notes      ENABLE ROW LEVEL SECURITY;

-- ── profiles policies ────────────────────────────────────────────────────────
CREATE POLICY "users read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- ── kids policies ────────────────────────────────────────────────────────────
-- Parents can read all their kids.
CREATE POLICY "parents read own kids"
  ON kids FOR SELECT
  USING (parent_id = auth.uid());

-- Kids can read their own record (via profiles.kid_id).
CREATE POLICY "kids read own record"
  ON kids FOR SELECT
  USING (
    id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  );

-- Parents can insert/update/delete kids they own.
CREATE POLICY "parents manage own kids"
  ON kids FOR ALL
  USING (parent_id = auth.uid());

-- ── learner_profiles policies ────────────────────────────────────────────────
CREATE POLICY "kids read own learner profile"
  ON learner_profiles FOR SELECT
  USING (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "parents read kids learner profiles"
  ON learner_profiles FOR SELECT
  USING (
    kid_id IN (SELECT id FROM kids WHERE parent_id = auth.uid())
  );

-- Kids write their own learner profile (saveMeetGreetProfile + updateProfile called from client)
CREATE POLICY "kids write own learner profile"
  ON learner_profiles FOR ALL
  TO authenticated
  USING (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  );

-- ── session_summaries policies ───────────────────────────────────────────────
CREATE POLICY "kids read own summaries"
  ON session_summaries FOR SELECT
  USING (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "parents read kids summaries"
  ON session_summaries FOR SELECT
  USING (
    kid_id IN (SELECT id FROM kids WHERE parent_id = auth.uid())
  );

-- Kids write their own session summaries (writeSummary called from client)
CREATE POLICY "kids write own summaries"
  ON session_summaries FOR ALL
  TO authenticated
  USING (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  );

-- ── exams policies ───────────────────────────────────────────────────────────
CREATE POLICY "kids read own exams"
  ON exams FOR SELECT
  USING (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "parents manage exams"
  ON exams FOR ALL
  USING (
    kid_id IN (SELECT id FROM kids WHERE parent_id = auth.uid())
  );

-- ── study_materials policies ─────────────────────────────────────────────────
CREATE POLICY "kids read own materials"
  ON study_materials FOR SELECT
  USING (
    kid_id = (SELECT kid_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "parents manage materials"
  ON study_materials FOR ALL
  USING (
    kid_id IN (SELECT id FROM kids WHERE parent_id = auth.uid())
  );

-- ── parent_notes policies ────────────────────────────────────────────────────
-- parent_notes are never shown to kids.
CREATE POLICY "parents manage own notes"
  ON parent_notes FOR ALL
  USING (
    kid_id IN (SELECT id FROM kids WHERE parent_id = auth.uid())
  );
