# Quinn — Codebase Map
Last updated: 2026-03-27

## Purpose of this file
Dense function-level index for AI-assisted navigation. Read this before opening any source file.
Navigation chain: quinn-project skill → CLAUDE.md → this file → targeted file read.

---

## index.html (Single-file app — all frontend)
All screens, CSS, and JS inline. No build step. Open in browser to develop.

### App state machine
`appState` variable drives screen rendering:
- `loading` → initial auth check
- `unauthenticated` → kid profile selector (login screen)
- `first-meeting` → meet-and-greet flow (new kid, cannot skip)
- `chat` → active Quinn conversation
- `parent-dashboard` → parent overview (exams, materials, session summaries)
- `parent-onboarding` → first-time parent setup

### Key JS sections (search by comment header):
- `// ── Supabase init ──` — client setup with env keys
- `// ── Auth helpers ──` — session check, kid login, parent login
- `// ── Chat engine ──` — message send, conversation history, call to chat Edge Function
- `// ── Session summary ──` — incremental write, inactivity timeout trigger
- `// ── Meet and greet ──` — first-session flow, initial profile write
- `// ── Parent dashboard ──` — exam CRUD, material upload, summary cards
- `// ── Drift detection ──` — drift score read/display (score sourced from summarize function)

### Important globals:
- `conversationHistory` — in-memory array of `{role, content}` for current session
- `currentKidId` — active child's UUID
- `currentSessionId` — UUID for the active session
- `learnerProfile` — loaded from Supabase at session start, never mutated client-side
- `driftScore` — updated from summarize response, injected into next chat call

---

## supabase/functions/chat/index.ts
**Purpose:** Live Quinn conversation — main AI call every turn.
**Model:** claude-haiku-4-5-20251001 | temp=0.7 | max_tokens=1024

### Handler (Deno.serve)
Accepts: `{ message, kid_id, learner_profile, session_summaries, exams, conversation_history, is_first_meeting, parent_notes, material_summaries, drift_score, session_id }`
Returns: `{ response: string, usage: object }`

Builds two cached system prompt blocks → calls Anthropic API → optionally writes dev_logs → returns response.

### buildCorePersonality() → string
Quinn's immutable personality, voice, safety rules, age-tier calibration, exam behavior, and content guardrails.
~3800 tokens. Never changes within or across sessions. Always Block 1 with `cache_control: ephemeral`.
KV-cache: Identical for every kid and every turn — near 100% cache hit rate after first warm.

### buildKidContext(profile, summaries, exams, isFirstMeeting, parentNotes, materialSummaries, driftScore, conversationHistory) → string
Per-kid context built fresh at session start from Supabase data. Block 2 with `cache_control: ephemeral`.
Sections injected in order:
1. `## This Kid` — name, age, grade
2. `## How to Talk to Them` — communication patterns from observed_patterns
3. `## Current State` — last mood, anxiety level, stressors
4. `## Interests` — from profile.interests
5. `## Creative Interest Note` — injected if interests contain creative keywords (art, draw, write, etc.)
6. `## Academic Profile` — strong/weak subjects, specific gaps
7. `## Upcoming Exams` — daysOut computed from new Date(); buckets: 1/3/7/14+ days out
8. `## Recent Sessions` — last 5 session_summaries condensed
9. `## Pattern Alert` — injected if last 2-3 sessions had zero academic subjects
10. `## Parent Context` — from parent_notes table
11. `## Available Study Materials` — from study_materials.material_summary
12. `## Narrative Length Limit` — injected if quinnTurnCount >= 5 (static text — exact count NOT embedded)
13. `## Drift Correction` — injected if driftScore >= 5 (static text)

KV-cache: Stable within a day (daysOut is day-granular). No dynamic values after quinnTurnCount fix.

---

## supabase/functions/summarize/index.ts
**Purpose:** Writes/updates the session summary incrementally during conversation.
**Model:** claude-haiku-4-5-20251001 | temp=0.2 | max_tokens=1024
**Called by:** Client after every significant exchange; timing is client-controlled.

Accepts: `{ kid_id, conversation_segment, existing_summary, learner_profile }`
Returns: `{ summary: SessionSummary }`

If `existing_summary` is null → first write (sets mood_open from conversation start).
Otherwise → incremental update (preserves mood_open, accumulates all other fields).

### Output fields:
- `mood_open` — set only on first write, never overwritten
- `mood_close` — always updated to current mood
- `subjects_touched` — accumulates across writes, never removes
- `academic_notes`, `personal_notes`, `communication_notes` — append-only running text
- `readiness_estimate` — object keyed by subject, 1-5 scale, merges per-session evidence
- `drift_score` — 0-10 integer; drives drift correction in next chat call

### drift_score scale:
- 0 = fully on-task
- 3 = light tangent / brief creative exchange
- 5 = mixed (some roleplay alongside real conversation)
- 6-8 = sustained co-authorship fiction (multi-paragraph back-and-forth)
- 8-10 = Quinn asking "What happens next?" / full roleplay takeover / entire session is fiction

---

## supabase/functions/update-profile/index.ts
**Purpose:** Updates learner_profile JSON after session ends.
**Model:** claude-haiku-4-5-20251001 | temp=0.2 | max_tokens=2048
**Called by:** Client once after session summary is finalized.

Accepts: `{ kid_id, current_profile, session_summary }`
Returns: `{ profile: object }` (full updated learner_profile JSON)

### Five-tier update rules applied by the model:
- **Tier 1 stable** — only on concrete fact changes (age, grade, name preference)
- **Tier 2 current_state** — always update (mood, subjects, last_active, stressors)
- **Tier 3 observed_patterns** — only if pattern confirmed 2+ sessions; contradictions noted, not overwritten
- **Tier 4 academic** — strong/weak confirmed across sessions; gaps added/removed per evidence
- **Tier 5 interests** — accumulate only, never remove

---

## supabase/functions/ingest-material/index.ts
**Purpose:** Processes uploaded PDFs into study material summaries.
**Model:** claude-sonnet-4-6 | max_tokens=1024 (200K context for large documents)
**Called by:** Parent material upload flow in dashboard.

Accepts: `{ kid_id, subject, pdf_base64, filename, learner_profile }`
Returns: `{ summary: string }`

Passes PDF as base64 document block with kid's name/age/grade for calibrated extraction.
Output format: Overview (2-3 sentences) + Key Concepts + Important Details + Likely Exam Topics.
Summary stored in `study_materials.material_summary`.

---

## supabase/functions/reset-kid-password/index.ts
**Purpose:** Lets parents reset a kid's Supabase auth password. No AI call.

9-step auth chain:
1. Validate body (kid_id, new_password required)
2. Validate password length (min 8 chars)
3. Extract JWT from Authorization header
4. Create user-scoped Supabase client, verify JWT
5. Confirm caller has `is_parent=true` in profiles table
6. Confirm kid belongs to this parent (kids.parent_id = caller.id)
7. Look up kid's auth UUID from profiles.kid_id
8. Create admin client with service role key
9. Update password via `auth.admin.updateUserById`

---

## Supabase Schema Quick Reference
```
kids               — id, parent_id, name, age, grade, created_at, last_active_at
learner_profiles   — id, kid_id, profile_json (JSONB), updated_at
session_summaries  — id, kid_id, started_at, ended_at, duration_minutes,
                     mood_open, mood_close, subjects_touched[], academic_notes,
                     personal_notes, communication_notes, readiness_estimate (JSONB),
                     safety_flag, safety_flag_context
exams              — id, kid_id, subject, exam_type, exam_date, notes, created_at
study_materials    — id, kid_id, subject, source_type, file_url, file_name,
                     material_summary, uploaded_at, archived_at
parent_notes       — id, kid_id, note, created_at
profiles           — id, kid_id, is_parent (links Supabase auth users to kids/parents)
dev_logs           — session_id, kid_id, role, content, drift_score, created_at
```

---

## Model Routing
| Task | Model | Note |
|---|---|---|
| Quinn chat | claude-haiku-4-5-20251001 | Dev cost savings; swap to Sonnet 4.6 for production |
| Session summary | claude-haiku-4-5-20251001 | Structured output, low complexity |
| Profile update | claude-haiku-4-5-20251001 | Structured output, low complexity |
| PDF ingest | claude-sonnet-4-6 | 200K context needed for large documents |

---

## Key Patterns
- **Prompt caching:** Two ephemeral blocks — corePersonality (always hits) + kidContext (stable per day)
- **Incremental summaries:** summarize called mid-session by client; inactivity timeout fires final call
- **Drift guard:** driftScore from summarize response injected into next chat call's kidContext block
- **No secrets in client:** All AI calls proxy through Edge Functions; ANTHROPIC_API_KEY never in index.html
- **Kids close without warning:** Every Quinn response must stand alone as a potential final message
