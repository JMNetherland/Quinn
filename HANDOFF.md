# Quinn — Project Handoff Document

> **Update this document after every build step.**
> Last updated: 2026-03-20 (Session 4)

---

## Project Overview

Quinn is a personal AI learning companion for three kids. It builds real relationships through persistent memory — not a tutor, but a named AI friend. Single HTML file deployed to GitHub Pages, with a Supabase backend and Claude API for all AI tasks (conversation, summaries, document ingestion).

**Kids:** Mason (age 10), Joie (age 13), Bella (age 15)
**Parents:** Jason + Keri (parent dashboard access)

**Stack:**
| Layer | Choice |
|---|---|
| Frontend | Single HTML file (`index.html`) |
| Deployment | GitHub Pages |
| Database + Auth | Supabase (Postgres + Supabase Auth) |
| AI — Chat | Claude Sonnet 4.6 (via Edge Function) |
| AI — Summaries / Profile updates | Claude Haiku 4.5 (via Edge Function) |
| AI — Document ingestion | Claude Sonnet 4.6 (via Edge Function — 200K context, no Gemini needed) |
| API key handling | ANTHROPIC_API_KEY via Supabase Edge Functions only — never client-side |

---

## Key Decisions (locked)

| Decision | Choice |
|---|---|
| AI model (chat) | Claude Sonnet 4.6 |
| AI model (summaries/profile updates) | Claude Haiku 4.5 |
| Document ingestion | Claude Sonnet 4.6 — 200K context window is sufficient for school materials; simplifies architecture to one API/one key/one SDK. Gemini dropped. |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Front end | Single HTML file |
| Deployment | GitHub Pages |
| API keys | ANTHROPIC_API_KEY via Edge Functions only — never client-side. No GEMINI_API_KEY needed. |
| Full transcripts visible to parents | Never — summaries only |
| Sibling visibility | Zero — fully isolated profiles |

---

## Session Log

---

### Session 1 — March 20, 2026

#### Pre-session state (review findings)

- `index.html` was 940 lines — polished UI shell with zero backend
- Four views existed: sign-in, chat, meet & greet, parent dashboard
- Quinn's Möbius animation was complete: 6 emotional states (listening, curious, engaged, celebrating, soft, sad), smooth lerp transitions, drives `--accent` CSS variables in real time
- Auth was fake: email prefix matching only, no password check
- Chat returned a hardcoded placeholder string after a 1.4s fake delay — no Claude API
- Meet & Greet view existed in HTML but was unreachable — routing always went to chat
- Parent dashboard was 100% hardcoded static HTML, no dynamic data
- No Supabase client imported anywhere
- `sw.js` service worker: navigation requests = network-first, external assets = cache-first. Clean 49-line implementation.

#### Work completed

**1. Supabase wiring (`index.html`)**
- Added Supabase JS ESM client via CDN
- Converted script to ES module
- Initialized Supabase client with URL + anon key (only anon key client-side)
- Replaced fake auth with real `supabase.auth.signInWithPassword`
- Real error messages shown on failed login
- Forgot Password calls `supabase.auth.resetPasswordForEmail`
- Session restore on page refresh via `supabase.auth.getSession()`
- Sign out wired to all back buttons and parent header

**2. Smart routing (`routeUser` function)**
- On login: fetches `profiles` row to determine account type
- Parent account → parent dashboard view
- Kid account, no `learner_profiles` row → Meet & Greet (first-run flow now reachable)
- Kid account, has profile → parallel loads last 5 `session_summaries` + upcoming `exams` → chat view
- Personalized greeting via `buildGreeting()`: checks last session mood, upcoming exams, interests

**3. SQL migration (new file)**
- Created `supabase/migrations/001_initial_schema.sql`
- Tables: `profiles`, `kids`, `learner_profiles`, `session_summaries`, `exams`, `study_materials`, `parent_notes`
- RLS on every table: kids see only their own rows, parents see all their kids' rows

---

## Current State

| Area | Status |
|---|---|
| UI shell (all 4 views) | ✅ Complete |
| Möbius animation (6 emotional states) | ✅ Complete |
| Supabase client wiring | ✅ Complete |
| Auth (sign in / sign out / forgot password) | ✅ Complete |
| Session restore on refresh | ✅ Complete |
| Smart routing (parent / new kid / returning kid) | ✅ Complete |
| Learner profile loading | ✅ Loads from Supabase |
| Session summaries loading | ✅ Loads last 5 |
| Upcoming exams loading | ✅ Loads from Supabase |
| SQL migration file | ✅ Created — **not yet run** |
| Meet & Greet routing | ✅ First-run flow now reachable |
| Meet & Greet conversation | ✅ Wired — real API, exchange counter, profile save after 8 turns |
| Claude API chat integration | ✅ Complete |
| Supabase Edge Functions (`chat`) | ✅ Complete — deploy required |
| Session summary writing (incremental) | ✅ Complete |
| Learner profile update after session | ✅ Complete |
| Parent dashboard (dynamic data) | ✅ Complete — loads from Supabase |
| Exam management (add/delete per kid) | ✅ Complete |
| Study material upload + Claude ingestion | ✅ Complete |
| Parent notes (per kid, injected into Quinn context) | ✅ Complete |
| Edge Function — `ingest-material` | ✅ Complete — deploy required |
| Supabase migration run in project | ⏳ Pending Jason |

---

## Next Steps (in order)

1. **Run migration + seed data + deploy** — see "Needs Jason" section above
2. **Parent dashboard** — Dynamic data from Supabase (kids, exams, summaries) replacing hardcoded HTML
3. **Bella dyslexia font** — Apply OpenDyslexic when `learner_profile.stable.dyslexia_font === true`
4. **Exam entry UI** — Parent dashboard form to add/edit exams
5. **Study material upload + Gemini ingestion** — PDF/doc upload → Gemini summary → stored in `study_materials`
6. **Parent notes** — Simple free-text notes per kid visible in parent dashboard

---

---

### Session 2 — March 20, 2026

#### Pre-session state (review findings)

- `sendMessage()` was a stub: fake 1.4s timeout returning a hardcoded placeholder string
- Meet & Greet view was reachable but completely inert — no API call, opening message included the kid's name (wrong per PRD)
- No Edge Functions existed
- `conversationHistory` state did not exist — every send was stateless

#### Work completed

**1. Supabase Edge Function — `chat` (`supabase/functions/chat/index.ts`)**
- Accepts POST: `{ message, kid_id, learner_profile, session_summaries, exams, conversation_history, is_first_meeting }`
- Two-block system prompt with `cache_control: { type: "ephemeral" }` on both blocks for maximum cache hit rate
  - Block 1: Core Quinn personality (identical for all kids — very high cache reuse)
  - Block 2: Kid-specific context (stable within a conversation — caches for the session)
- System prompt includes: Quinn identity rules, voice guidelines, exam proximity behavior (2+ wk / 1 wk / 2-3 day / day-before), academic context, recent session summaries with callback prompts, safety rules
- `is_first_meeting` flag switches to a first-meeting-specific system prompt section — no profile data, different goals
- Model: `claude-sonnet-4-6`, temperature 0.7
- Error handling: catches all throws, returns a friendly fallback string with `status: 200` so client always gets a parseable response
- CORS headers present for browser invocation via supabase-js

**2. `sendMessage()` — real async implementation (`index.html`)**
- Replaced stub with `async function sendMessage(view)`
- `isSending` mutex prevents double-send while async call is in flight
- Calls `supabase.functions.invoke('chat', { body })` with full context payload
- Manages per-view history arrays (`conversationHistory`, `mgConversationHistory`), max 20 messages, trims oldest pair when over limit
- Quinn animation state set from response content: `!` + celebration words → `celebrating`; ends with `?` → `curious`; default → `listening`
- Error path: removes thinking indicator, shows gentle error message in chat

**3. Meet & Greet wiring (`index.html`)**
- Opening message corrected to exact PRD wording: "Hey — I'm Quinn. I've been looking forward to meeting you."
- Both send buttons now call same `sendMessage()` function with `is_first_meeting: true` flag for `mg` view
- `mgExchangeCount` tracks user turns; after 8+ turns, `saveMeetGreetProfile()` fires once (guarded by `mgProfileSaved` flag)
- `saveMeetGreetProfile()`: writes minimal initial profile to `learner_profiles` via `upsert`, updates in-memory `learnerProfile`, resets MG state, routes to chat view with greeting

**4. State reset on sign-out**
- `signOut()` now resets: `conversationHistory`, `mgConversationHistory`, `mgExchangeCount`, `mgProfileSaved`, `isSending`

#### Files changed
- `supabase/functions/chat/index.ts` — **new**
- `index.html` — sendMessage(), state vars, signOut(), saveMeetGreetProfile(), MG opening message
- `HANDOFF.md` — this update

#### Pending before this goes live
- Run `supabase functions deploy chat` from project root
- Set secret: `supabase secrets set ANTHROPIC_API_KEY=<key>`
- Migration still needs to be run if not already done (Session 1 item)

---

---

### Session 3 — March 20, 2026

#### Pre-session state (review findings)

- `session_summaries` and `learner_profiles` write path was entirely missing
- `sendMessage` had no inactivity timer, no incremental summary triggers
- No `summarize` or `update-profile` Edge Functions existed

#### Work completed

**1. Edge Function — `summarize` (`supabase/functions/summarize/index.ts`)**
- Accepts POST: `{ kid_id, conversation_segment, existing_summary, learner_profile }`
- `conversation_segment`: array of `{ role, content }` messages since last summary write
- `existing_summary`: current partial summary object (null on first write)
- Calls `claude-haiku-4-5-20251001` at `temperature=0.2` — structured output
- Produces / updates session summary JSON: `mood_open` (first write only), `mood_close` (always), `subjects_touched` (accumulates), `academic_notes`, `personal_notes`, `communication_notes`, `readiness_estimate` (per-subject 1–5)
- Returns: `{ summary }` — raw JSON object, no commentary

**2. Edge Function — `update-profile` (`supabase/functions/update-profile/index.ts`)**
- Accepts POST: `{ kid_id, current_profile, session_summary }`
- Calls `claude-haiku-4-5-20251001` at `temperature=0.2`
- Applies three-tier update rules in the prompt:
  - `stable`: only update on fact changes (age, grade, name)
  - `current_state`: always update (mood, recent subjects, stressors, last_active)
  - `observed_patterns`: only update if confirmed 2+ times; contradictions noted but not overwritten
  - `academic`: update gaps and mastered_recently from session evidence
  - `interests`: accumulate only
- Returns: `{ profile }` — updated profile JSON only

**3. Session summary logic — `index.html`**

New state variables:
- `currentSessionSummary` — running summary object (null at session start)
- `sessionStartedAt` — ISO timestamp when chat view entered
- `lastSummaryAt` — `conversationHistory.length` at last summary write
- `inactivityTimer` — `setTimeout` handle
- `sessionEnded` — guard preventing double finalization
- `SESSION_INACTIVITY_MS = 5 * 60 * 1000` (5 minutes)

New functions:
- `resetInactivityTimer()` — clears and restarts 5-minute inactivity countdown
- `writeSummary(isFinal)` — calls `summarize` Edge Function for new segment; if `isFinal=true`, inserts to `session_summaries` and calls `updateProfile()`; guards: non-final skips if <6 new messages; `sessionEnded` prevents double finalization
- `updateProfile()` — calls `update-profile` Edge Function, upserts to `learner_profiles`, updates in-memory `learnerProfile`

Wiring:
- `resetInactivityTimer()` called after every Quinn response in chat view
- `writeSummary(false)` called fire-and-forget every 10 messages (`conversationHistory.length % 10 === 0`) in chat view
- `inactivityTimer` fires `writeSummary(true)` after 5 minutes of silence
- `signOut()` clears timer + resets all new state vars
- Session state (`sessionStartedAt`, `currentSessionSummary`, `lastSummaryAt`, `sessionEnded`) initialized fresh when routing to chat view (both `routeUser` and `saveMeetGreetProfile`)
- History trim now also adjusts `lastSummaryAt` to stay in sync

#### Files changed
- `supabase/functions/summarize/index.ts` — **new**
- `supabase/functions/update-profile/index.ts` — **new**
- `index.html` — state vars, `resetInactivityTimer`, `writeSummary`, `updateProfile`, `sendMessage` triggers, `signOut` reset, session init in `routeUser` + `saveMeetGreetProfile`
- `HANDOFF.md` — this update

---

---

### Session 4 — March 20, 2026

#### Architecture change: Gemini dropped — Claude-only

- Removed Gemini from all documentation, stack tables, and key-decision records
- Document ingestion now uses Claude Sonnet 4.6 with the PDF document source API (base64)
- Reason: 200K context window is sufficient for school materials; eliminates a second API key, SDK, and vendor dependency
- GEMINI_API_KEY is no longer needed anywhere in this project

#### Work completed

**1. Edge Function — `ingest-material` (`supabase/functions/ingest-material/index.ts`)** — new
- Accepts POST: `{ kid_id, subject, pdf_base64, filename, learner_profile }`
- Calls Claude Sonnet 4.6 with the PDF as a base64 document source
- Prompt tailored to kid's name, age, and grade (from learner_profile)
- Returns: `{ summary: string }` — structured overview, key concepts, important details, likely exam topics
- Reads ANTHROPIC_API_KEY from Deno env

**2. Parent dashboard — fully dynamic (`index.html`)**
- `loadParentDashboard()` called on parent login — fetches all kids (`parent_id = user.id`) and parallel-fetches learner_profiles, session_summaries (last 3), exams (upcoming, non-archived), study_materials (non-archived), parent_notes (last 3) for each
- `renderParentDashboard()` builds kid sections + aggregate upcoming-exams view from in-memory `parentData`
- Kid cards: name, age/grade, readiness bars (from `readiness_estimate` on latest summary, or derived from academic profile), upcoming exam pills (next 2), last active date, "Details" expand toggle
- Detail panels: exam management, study material upload, parent notes — all per kid, expandable

**3. Exam management**
- Per-kid exam list in detail panel with remove (soft-delete via `archived_at`)
- "+ Add exam" inline form: subject, exam type (quiz/test/midterm/final), date, optional notes
- On save: inserts to `exams` table, refreshes per-kid list + aggregate section
- On remove: sets `archived_at`, removes from in-memory state, refreshes both lists

**4. Study material upload**
- PDF-only file input + subject input
- On upload: PDF → Supabase Storage (`study-materials` bucket, path `{kid_id}/{subject}/{filename}`) → base64 encode → `ingest-material` Edge Function → insert to `study_materials` with `material_summary` column
- Uploaded materials list with archive (soft-delete via `archived_at`)

**5. Parent notes**
- Textarea + "Save note" per kid
- Inserts to `parent_notes` table; shows last 3 notes with dates
- Notes injected into Quinn's chat system prompt as parent context (see chat Edge Function update)

**6. Edge Function — `chat` updated**
- New payload fields: `parent_notes` (array of `{ note, created_at }`) and `material_summaries` (array of `{ subject, summary, filename }`)
- `buildKidContext()` now includes two new sections in Block 2 (kid-specific context, cached):
  - `## Parent Context` — notes from Jason and Keri, framed as background awareness
  - `## Available Study Materials` — per-subject summaries with structured content

**7. `index.html` routing wiring**
- `routeUser()` for parent: calls `loadParentDashboard()` after `showView('parent')`
- `routeUser()` for returning kid: now parallel-fetches `parent_notes` and `study_materials` alongside existing fetches; stores in `parentNotes` / `materialSummaries` state
- `sendMessage()`: includes `parent_notes` and `material_summaries` in every chat payload
- `signOut()`: resets all new state variables

#### Schema changes required (patch migration — see Needs Jason)
- `study_materials.gemini_summary` → renamed to `material_summary`
- `study_materials` → add `archived_at TIMESTAMPTZ`
- `exams` → add `archived_at TIMESTAMPTZ`

#### Files changed
- `supabase/functions/ingest-material/index.ts` — **new**
- `supabase/functions/chat/index.ts` — parent_notes + material_summaries payload + buildKidContext sections
- `index.html` — CSS (dynamic parent dashboard), HTML (dynamic container), JS (all parent dashboard functions + routing wiring)
- `HANDOFF.md` — this update
- `CLAUDE.md` — Gemini removed from stack table and key rules

---

## Needs Jason (everything required before end-to-end testing)

1. **Run SQL migration** — open Supabase dashboard → SQL editor → paste and run `supabase/migrations/001_initial_schema.sql`

   > **Schema note (Session 4):** The migration was written with `gemini_summary` on `study_materials`. Rename it to `material_summary`. Also add `archived_at TIMESTAMPTZ` columns to both `exams` and `study_materials` for soft-delete support. Run this patch after the main migration:
   > ```sql
   > ALTER TABLE study_materials RENAME COLUMN gemini_summary TO material_summary;
   > ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
   > ALTER TABLE exams ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
   > ```

2. **Deploy Edge Functions** — from the `Quinn/` project root:
   ```
   supabase functions deploy chat
   supabase functions deploy summarize
   supabase functions deploy update-profile
   supabase functions deploy ingest-material
   ```
3. **Set API key secret** — `supabase secrets set ANTHROPIC_API_KEY=<your_key>`
   > No GEMINI_API_KEY needed — Gemini has been dropped. Claude handles document ingestion.

4. **Enable Supabase Storage** — Dashboard → Storage → Create a new bucket named `study-materials`. Set it to **private** (RLS). Add a policy allowing authenticated users to insert/read their own kid's files.

5. **Create parent account** — Supabase Auth → Add user (email + password) for Jason (and Keri if desired)
6. **Create kid accounts** — Supabase Auth → Add user for Mason, Joie, and Bella (one each)
7. **Seed `profiles` table** — for each auth user, insert a row linking the `id` (UUID from Auth) to the correct `kid_id` FK and set `is_parent` flag appropriately. Example:
   ```sql
   -- Parent
   INSERT INTO profiles (id, is_parent) VALUES ('<jason-auth-uuid>', true);
   -- Kid
   INSERT INTO profiles (id, is_parent, kid_id) VALUES ('<mason-auth-uuid>', false, '<mason-kids-uuid>');
   ```
   The `kids` table rows also need to exist first (name, age, grade, parent_id).
8. **Push to GitHub Pages** — `git push origin main` (Pages auto-deploys on push)

---

## Special Considerations

- **Bella is dyslexic** — her child profile must use a dyslexia-friendly font (e.g. OpenDyslexic or similar). This is a per-child profile setting, not a global app setting.
- **Sibling isolation is strict** — no cross-sibling data access under any circumstances. RLS enforces this at the database level.
- **No full transcripts for parents** — parents see session summaries only. This is intentional to preserve kid trust.
- **All API keys server-side only** — ANTHROPIC_API_KEY lives exclusively in Supabase Edge Function environment variables. If any API call is ever added to client JS, that is a bug. No GEMINI_API_KEY is used.
