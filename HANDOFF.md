# Quinn — Project Handoff Document

> **Update this document after every build step.**
> Last updated: 2026-03-24 (Session 17)

---

## ⚠️ CURRENT BLOCKERS

These two issues are blocking real use of the app. Fix before anything else.

### 🔴 1. Chat is broken in production (401 Unauthorized on every message)

**Root cause (diagnosed):** The Edge Function is deployed with JWT verification **enabled** (Supabase default). A 401 is returned before the function code even runs.

**Client-side fix — applied in Session 14:** All four `supabase.functions.invoke()` calls now have an explicit `if (!session) return;` guard before the invoke, and pass `Authorization: Bearer <access_token>` directly (no anon-key fallback). The client is sending the JWT correctly.

**Remaining fix — deploy once with these commands (see Needs Jason):**
```
supabase functions deploy chat summarize update-profile ingest-material --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=<your-key>
```

Then check Edge Function logs if it still fails: Supabase Dashboard → Edge Functions → chat → Logs (shows the exact error, usually a missing `ANTHROPIC_API_KEY` secret).

### 🟠 2. OpenDyslexic still not rendering on iOS (two fix attempts, still broken)

Two rounds of fixes attempted (base64 embed, dynamic style injection, timing fix, SW cache bump) — still not working on device.

**iOS debugging without a Mac — use Eruda:**
To debug on iOS without a Mac, Eruda mobile devtools is wired into the app behind `?debug=true` (CDN pinned to `eruda@3/eruda.min.js` as of Session 14) — open Quinn in Safari on iPhone at `https://jmnetherland.github.io/Quinn/?debug=true`, log in as Bella, tap the floating Eruda button, go to Elements → find a chat message → check Computed styles → confirm what `font-family` is actually applied. This will tell us in 30 seconds what two blind fixes couldn't.

**Next things to try at the desk:**
- Open Quinn in **Safari directly** (not as a PWA) — if font renders there but not in the PWA, it's a service worker cache issue.
- **Remote DevTools**: plug iPhone into Mac → Safari → Develop → [iPhone name] → inspect Quinn. Check console for font errors; check Computed styles on a chat message to see what `font-family` is actually applied.
- If computed styles show `OpenDyslexic` but it still looks wrong, iOS may be substituting a system font due to format mismatch → try adding a `woff` fallback alongside the `woff2` base64.
- **Nuclear option**: serve the font file separately as `icons/OpenDyslexic-Regular.woff2` (already generated in the icons pipeline) and reference it with a relative path in `@font-face` instead of base64. Some iOS versions handle file-relative references more reliably than data URIs.

---

## Version

**Current: `v0.4.0`**

| Bump | When |
|---|---|
| PATCH (0.1.**x**) | Bug fixes, small tweaks — no new features |
| MINOR (0.**x**.0) | New feature shipped and tested |
| MAJOR (**x**.0.0) | `1.0.0` = production-ready, all kids using it |

Update `APP_VERSION` in `index.html` and `CACHE_NAME` in `sw.js` together on every release. Tag the git commit: `git tag v0.4.0`.

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
| SQL migration | ✅ Run in production |
| Meet & Greet routing | ✅ First-run flow now reachable |
| Meet & Greet conversation | ✅ Wired — real API, exchange counter, profile save after 8 turns |
| Claude API chat integration | ✅ Complete |
| Edge Functions (chat, summarize, update-profile, ingest-material) | ✅ Deployed |
| ANTHROPIC_API_KEY secret | ✅ Set |
| Session summary writing (incremental) | ✅ Complete |
| Learner profile update after session | ✅ Complete |
| Parent dashboard (dynamic data) | ✅ Complete |
| Exam management (add/delete per kid) | ✅ Complete |
| Study material upload + Claude ingestion | ✅ Complete |
| Study material Active/Pause/Delete controls | ✅ Complete |
| Parent notes (per kid, injected into Quinn context) | ✅ Complete |
| Parent notes edit + delete | ✅ Complete |
| Multi-parent access (Keri) | ✅ Complete |
| Kid profile editing (name/age/grade) | ✅ Complete |
| Supabase Storage bucket (`study-materials`) | ✅ Created with RLS |
| Auth users created (Jason, Keri, Mason, Joie, Bella, JMNetherland) | ✅ Done |
| Database seeded (profiles + kids rows) | ✅ Done |
| Deployed to GitHub Pages | ✅ Live |
| Edge Function auth header (explicit Bearer token) | ✅ Fixed |
| RLS write policies (learner_profiles + session_summaries) | ✅ Fixed |
| Service worker cross-origin guard | ✅ Fixed |
| Meet & Greet → chat seamless transition | ✅ Fixed |
| learner_profiles upsert onConflict | ✅ Fixed |
| Version numbering (APP_VERSION + CACHE_NAME) | ✅ v0.1.0 |
| quinn-version-bump skill | ✅ Created |
| Bella dyslexia font | ✅ Complete |
| Roleplay guardrails (identity anchoring + drift detection) | ✅ Complete |
| Dev chat logging (flag-gated, fire-and-forget) | ✅ Complete |
| PWA support (manifest, icons, iOS meta tags, sw.js update) | ✅ Complete |

---

## Next Steps (in order)

1. **Test the live app** — full end-to-end test pass with real kid accounts
2. **Session summary verification** — confirm 5-minute idle triggers a summary write correctly in production

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

---

### Session 5 — March 20, 2026

#### Work completed

**1. SQL migration fixed and run**
- Fixed migration file before running: renamed `gemini_summary` → `material_summary`, added `archived_at` to `exams` table (was already on `study_materials`)
- Migration run successfully in Supabase SQL editor — all 7 tables + RLS policies created

**2. Supabase CLI installed and configured**
- Installed via Scoop (npm global install not supported by Supabase CLI)
- `supabase login` → `supabase init` → `supabase link --project-ref onevueekevfpniopuyhj`

**3. Edge Functions deployed**
- All 4 deployed via CLI: `chat`, `summarize`, `update-profile`, `ingest-material`
- `ANTHROPIC_API_KEY` secret set via `supabase secrets set`

**4. Supabase Storage bucket**
- Created `study-materials` bucket (private)
- RLS policy added via SQL editor (dashboard policy UI had syntax issues): all operations for authenticated users

**5. Auth users + database seed**
- 6 auth users created: Jason, Keri, Mason, Joie, Bella, JMNetherland (test kid)
- `kids` table seeded: Mason (4th grade), Joie (8th grade), Bella (9th grade), Test Kid
- `profiles` table seeded: Jason + Keri as parents; Mason/Joie/Bella/JMNetherland as kids
- Grade corrections applied via SQL UPDATE after initial seed

**6. Deployed to GitHub Pages**
- Full project committed and pushed — site is live

#### Known limitations (v1)
- Only Jason's parent account sees the dashboard — kids have `parent_id = Jason's UUID`. Keri can use Jason's login. Multi-parent support is a future schema change.
- No kid profile editing from the parent dashboard — name/age/grade changes require SQL editor.

#### Files changed
- `supabase/migrations/001_initial_schema.sql` — fixed column names + added archived_at to exams
- `supabase/config.toml` — new (from supabase init)
- `HANDOFF.md` — this update

---

## Needs Jason

- **Redeploy all Edge Functions with `--no-verify-jwt`** — The client-side auth fix is applied (Session 14). Functions still need to be redeployed so JWT verification is disabled server-side:
  ```
  supabase functions deploy chat summarize update-profile ingest-material --no-verify-jwt
  ```
  This is the remaining step to unblock all Edge Function calls in production.

- **Dev logging — run the SQL migration** — The `dev_logs` table does not exist in production yet. Everything else is configured (`DEV_LOGGING_ENABLED=false` secret is set, `SUPABASE_SERVICE_ROLE_KEY` is auto-injected by Supabase). To activate logging when you want to inspect real conversations:
  1. Run `supabase/migrations/002_dev_logs.sql` in Supabase SQL Editor
  2. `supabase secrets set DEV_LOGGING_ENABLED=true`
  3. To read logs: Supabase Table Editor → `dev_logs`, order by `created_at desc`
  4. Turn off when done: `supabase secrets set DEV_LOGGING_ENABLED=false`

- **Enable OpenDyslexic for Bella** — Set the flag in production via Supabase SQL Editor:
  ```sql
  UPDATE learner_profiles
  SET profile_json = jsonb_set(profile_json, '{stable,dyslexia_font}', 'true')
  WHERE kid_id = (SELECT id FROM kids WHERE name = 'Bella');
  ```

- **Clean up misnamed SSH key files** — Two junk files exist in the Quinn repo root from a botched SSH setup attempt. Delete them:
  ```bash
  cd C:\Dev\personal\web-apps\Quinn
  git rm "# 1. Generate a key (accept all defaults, no passphrase needed)"
  git rm "# 1. Generate a key (accept all defaults, no passphrase needed).pub"
  git commit -m "chore: remove misnamed files from SSH setup"
  git push
  ```

- **Verify session summaries write in production** — Sign in as a test kid, have a short conversation, then leave the tab idle for 5+ minutes. Check Supabase Table Editor → `session_summaries` to confirm a row was written. This has never been confirmed working in production.

---

---

### Session 6 — March 20, 2026

#### Work completed

**1. Edge Function auth header fix (`index.html`)**
- Root cause: `supabase-js` v2.99.3 does not auto-inject auth into `functions.invoke` calls
- Fix: explicitly pass `Authorization: Bearer <access_token>` in every `functions.invoke` call
- Applied to all 4 Edge Functions: `chat`, `summarize`, `update-profile`, `ingest-material`
- Fallback: if no session token, send anon key so Edge Function always receives a valid header

**2. RLS write policies added**
- `learner_profiles` had only a SELECT policy — INSERT and UPDATE were silently blocked
- `session_summaries` same issue
- Fixed by adding `FOR ALL` policies for both tables (authenticated kids on their own rows)
- Migration file updated: `supabase/migrations/001_initial_schema.sql`

**3. Service worker cross-origin guard (`sw.js`)**
- SW was intercepting Supabase POST calls (cross-origin) — caused silent failures on fetch
- Fix: `if (url.origin !== self.location.origin) return;` at top of fetch handler
- Only same-origin requests are now intercepted by the SW

**4. Meet & Greet → chat seamless transition (`index.html`)**
- Old behavior: `saveMeetGreetProfile` cleared conversation history and showed a new first-time greeting
- Fix: copy `mgConversationHistory → conversationHistory`, move DOM message nodes from MG container to chat container (no re-render), skip reset greeting
- Kid now flows directly into conversation without any indication of a "switch"

**5. learner_profiles upsert conflict fix (`index.html`)**
- Both `saveMeetGreetProfile` and `updateProfile` upserts were missing `{ onConflict: 'kid_id' }`
- Without it, repeated upserts threw 409 Conflict (unique constraint on kid_id)
- Fixed in both call sites

**6. Version numbering**
- Added `const APP_VERSION = '0.1.0'` to `index.html`
- Added version display to sign-in view (`<p class="app-version">v0.1.0</p>`, bottom-right, subtle)
- `CACHE_NAME` in `sw.js` set to `quinn-v0.1.0` — always keeps in sync with APP_VERSION
- Versioning rules documented in HANDOFF.md Version section

**7. `quinn-version-bump` skill**
- Created Claude Code skill at `c:\Dev\.claude\skills\quinn-version-bump\SKILL.md`
- Handles: read current version → determine bump type → update index.html + sw.js + HANDOFF.md atomically → commit → tag → remind user to push with --tags
- Enforces: PATCH = bug fix, MINOR = new feature tested, MAJOR = 1.0.0 all kids live

#### Files changed
- `index.html` — auth header on all 4 Edge Function calls, seamless MG transition, upsert onConflict, APP_VERSION constant + version display
- `sw.js` — cross-origin guard, CACHE_NAME bump to quinn-v0.1.0
- `supabase/migrations/001_initial_schema.sql` — RLS write policies for learner_profiles + session_summaries
- `c:\Dev\.claude\skills\quinn-version-bump\SKILL.md` — new skill
- `HANDOFF.md` — this update

#### Pending verification
- **session_summaries write** — needs 5-minute idle test to confirm the 201 Created comes back correctly after the auth header fix
- **Remove debug console.error** from `saveMeetGreetProfile` once confirmed working

---

### Session 7 — 2026-03-21

#### Work completed

**1. Bella dyslexia font (`index.html`)**
- OpenDyslexic loaded via inline `@font-face` (not CDN `<link>`) — eliminates flash of unstyled text
- `font-display: block` prevents FOUT; `await document.fonts.load('400 1em OpenDyslexic')` in `applyDyslexiaFont` ensures font is ready before the chat view appears
- Font controlled by `stable.dyslexia_font = true` in the kid's `learner_profiles.profile_json`
- To enable: `UPDATE learner_profiles SET profile_json = jsonb_set(profile_json, '{stable,dyslexia_font}', 'true') WHERE kid_id = (SELECT id FROM kids WHERE name = 'Bella');`
- `applyDyslexiaFont` must be `async` — this caused a sign-in breaking bug when the keyword was accidentally stripped during a later edit

**2. Upload error visibility fix (`index.html`)**
- `.upload-status` text color was `var(--text-3)` = near-invisible on dark background
- Fixed: normal state uses `var(--text-2)`, error state uses `#e05c5c`
- Catch block now shows the actual `err.message` instead of a generic string

**3. Parent notes edit + delete (`index.html`)**
- Added `deleteNote(noteId, kidId)`, `editNote(noteId)`, `saveNoteEdit(noteId, kidId)`, `cancelNoteEdit(noteId)`
- Note items now have `id="note-item-${n.id}"` for in-place DOM mutation
- Inline edit replaces the note text with a textarea + Save/Cancel buttons; save calls Supabase UPDATE and re-renders just that note item

**4. SSH key setup for GitHub**
- Set up ed25519 SSH key to eliminate password prompts on every `git push`
- Key added to GitHub account; `~/.ssh/config` configured with `IdentityFile ~/.ssh/id_ed25519`

**5. Multi-parent access — Keri (`index.html`, Supabase SQL)**
- Added `co_parent_id uuid REFERENCES auth.users(id)` column to `kids` table
- Updated all 5 RLS policies on `kids` and related tables to include `OR co_parent_id = auth.uid()`
- JS query changed from `.eq('parent_id', user.id)` to `.or('parent_id.eq.${user.id},co_parent_id.eq.${user.id}')`
- SQL run in Supabase editor to set `co_parent_id = Keri's UUID` on Mason/Joie/Bella rows

**6. Kid profile editing from parent dashboard (`index.html`)**
- Added `saveKidProfile(kidId)` — reads name/age/grade inputs from the detail panel and calls Supabase UPDATE
- Updates in-memory `parentData` and re-renders just the card header (no full re-render)

**7. Details panel bug fix (`index.html`)**
- Root cause: `hidden` HTML attribute on `.kid-detail` was overridden by CSS `display: flex` — panels appeared collapsed visually but had full `offsetHeight` (638–750px)
- Fix: removed `hidden` attribute approach entirely; panels now use `.open` CSS class toggle
- `toggleKidDetail(kidId)` updated to use `classList.toggle('open', ...)`

**8. Voice mode — TTS + STT (`index.html`)**
- `speakQuinn(text)` — strips markdown, picks best en-US voice, speaks via `speechSynthesis`; animation state → `engaged` while speaking, → `listening` on end
- `toggleMic(view)` — `SpeechRecognition` (Chrome/Android only); auto-fills input and sends on final result
- `toggleMute()` — global mute toggle, persists across messages; updates 🔊/🔇 button across both views
- `pickVoice()` — prefers Google en-US voice, falls back through Zira → any en-US → any en → voices[0]
- Mic (🎤) and mute (🔊) buttons added to both chat and MG view input rows
- `speakQuinn(greeting)` called on `showView('chat')` in `routeUser` and `saveMeetGreetProfile`
- `speakQuinn(response)` called after every Quinn message in `sendMessage`
- Keyboard input cancels any in-progress speech (except Shift key)
- Sign-out cleans up: `speechSynthesis.cancel()`, `recognition.abort()`
- Version bumped to v0.2.0 (MINOR — new feature)

#### Files changed
- `index.html` — all of the above
- `sw.js` — CACHE_NAME bumped to `quinn-v0.2.0`
- `HANDOFF.md` — version + current state table updates

#### Known issues going into Session 8
- iOS TTS silent — iOS blocks `speechSynthesis.speak()` from async code; initial one-time unlock approach did not work; iOS requires speak() in the same synchronous gesture context

---

### Session 8 — 2026-03-21

#### Work completed

**1. iOS TTS fix — partial (`index.html`)**
- Root cause: iOS blocks `speechSynthesis.speak()` unless called synchronously from within a user gesture handler. Quinn's responses always arrive from `await`-based async callbacks, which iOS treats as outside the gesture context.
- Fix 1: Changed initial unlock utterance from `''` (empty string) to `' '` (space) — iOS ignores zero-length utterances and doesn't register them as unlocks
- Fix 2: Added iOS TTS prime to `handleSignIn` before first `await` — on sign-in button tap (a gesture), fire `cancel()` + `speak(' ')` synchronously to warm up the audio session before auth completes
- Fix 3: Added iOS TTS prime to `sendMessage` before first `await` — same pattern, keeps iOS audio session active during each API call
- Fix 4: Added 50ms `setTimeout` between `cancel()` and `speak()` in `speakQuinn` — iOS silently drops `speak()` called immediately after `cancel()` due to internal audio session reset

**Result:** ✅ Works for Quinn responses to chat messages on iOS. ❌ Initial greeting (spoken right after sign-in) is still silent on iOS.

**Remaining issue — initial greeting:**
- Flow: sign-in button tap → `handleSignIn` (prime fires here) → `await signInWithPassword` → `await routeUser` (multiple awaits: profiles, kids, summaries, exams, materials) → `speakQuinn(greeting)`
- By the time the greeting fires, iOS may have re-locked the audio session after 3–5+ seconds of async work
- The 50ms `setTimeout` in `speakQuinn` means it does not fire synchronously even within the routeUser chain

#### Files changed
- `index.html` — iOS TTS fixes in `handleSignIn`, `sendMessage`, `speakQuinn`, and the initial unlock block
- `HANDOFF.md` — this update

#### Next task
- Fix initial greeting TTS on iOS — options: (a) reduce awaits before `speakQuinn(greeting)` so it fires faster, (b) add a "tap to hear greeting" button that fires speak from a direct gesture, (c) investigate if a pre-queued utterance in the handleSignIn gesture survives through all the subsequent awaits

---

---

### Session 9 — 2026-03-21

#### Context

One of the kids (observed with Joie, age 13 — [confirm with Jason if it was a different child]) was pulling Quinn into sustained roleplay sessions — Quinn was being asked to adopt named characters and stay in-persona across many messages, effectively losing its identity as Quinn. This session adds two layers of protection against that pattern.

#### Work completed

**1. Identity anchoring — `chat/index.ts` (Block 1, core personality)**
- Added `## Identity & Roleplay Boundaries` section to `buildCorePersonality()`
- Because this is Block 1 (identical for all kids), it gets maximum prompt cache reuse
- Quinn is now explicitly instructed to:
  - Redirect after 1–2 roleplay messages using warm, funny redirects (not preachy)
  - Escalate to a clearer "I work best just being me" message after 2 failed redirects
  - Help with creative writing as the *author* — never as the *character*
- Three example redirect lines provided in Quinn's voice (not robotic, not teacherly)

**2. Drift detection — `summarize/index.ts`**
- Added `drift_score` field (integer 0–10) to the `SessionSummary` interface and prompt
- Haiku scores each conversation segment: 0 = on-task, 10 = fully drifted (Quinn being asked to be another character)
- Calibrated carefully: normal creative talk, storytelling help, and casual off-topic chat do NOT trigger a high score — only sustained identity-displacing roleplay does
- `drift_score` is returned inside `{ summary }` from the Edge Function

**3. Drift pass-through — `chat/index.ts`**
- `drift_score` accepted as optional payload field (defaults to 0)
- Passed to `buildKidContext()` as `driftScore`
- If `driftScore >= 7`: appends a `## Session Note` to the end of Block 2 (kid-specific context) instructing Quinn to steer back with warmth and humor — not a lecture

**4. Drift tracking — `index.html`**
- `currentDriftScore` state variable initialized to 0 on every session start and sign-out
- After each `writeSummary()` call: if `data.summary.drift_score >= 5`, stores it in `currentDriftScore`; if `< 5`, resets to 0 (conversation is back on track)
- `sendMessage()` passes `drift_score: currentDriftScore` in every chat payload
- Reset also wired into `saveMeetGreetProfile` session init (MG → chat transition)

#### Files changed
- `supabase/functions/chat/index.ts` — identity anchoring in Block 1, drift_score payload + buildKidContext drift instruction
- `supabase/functions/summarize/index.ts` — drift_score field in SessionSummary interface + prompt instruction
- `index.html` — currentDriftScore state var, sendMessage payload, writeSummary drift tracking, session init resets, sign-out reset
- `HANDOFF.md` — this update

#### Deploy required
- `supabase functions deploy chat`
- `supabase functions deploy summarize`

---

---

### Session 10 — 2026-03-21

#### Work completed

**1. SQL migration — `dev_logs` table (`supabase/migrations/002_dev_logs.sql`)** — new
- Columns: `id`, `session_id` (uuid), `kid_id` (FK → kids, cascade delete), `role` (user/assistant check), `content`, `drift_score`, `created_at`
- RLS enabled with a `"No client access"` policy (`for all using (false)`) — table is write-only from the Edge Function, never readable from client JS
- Safe to deploy to production schema; zero data is written unless `DEV_LOGGING_ENABLED=true` in Edge Function env

**2. Edge Function — `chat` updated (`supabase/functions/chat/index.ts`)**
- Added `import { createClient } from "npm:@supabase/supabase-js@2"` for server-side admin writes
- Reads `DEV_LOGGING_ENABLED` from Deno env; all logging logic is gated behind this flag
- Accepts `session_id` (optional uuid) in the request body; passed through to dev_logs rows
- After getting Claude's response, if `devLogging=true`: creates Supabase admin client using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role bypasses RLS), then fire-and-forget inserts both the user message and Quinn's response to `dev_logs` — a `.catch()` logs any failure but never throws
- Admin client is instantiated lazily inside the logging block (only when flag is on)

**3. `index.html` — `devSessionId` wiring**
- Added `let devSessionId = null` to session state variables
- `devSessionId = crypto.randomUUID()` set in `routeUser` (returning kid → chat) and `saveMeetGreetProfile` (MG → chat transition) alongside other session inits
- `session_id: devSessionId` added to every `supabase.functions.invoke('chat', ...)` payload in `sendMessage`
- `devSessionId = null` reset in `signOut()`

#### Files changed
- `supabase/migrations/002_dev_logs.sql` — **new**
- `supabase/functions/chat/index.ts` — dev logging block, session_id payload field
- `index.html` — devSessionId state var, routeUser init, saveMeetGreetProfile init, sendMessage payload, signOut reset
- `HANDOFF.md` — this update

#### Deploy required
- Run `002_dev_logs.sql` in Supabase SQL editor
- `supabase secrets set DEV_LOGGING_ENABLED=true` (or false to disable)
- `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>`
- `supabase functions deploy chat`

---

---

### Session 11 — 2026-03-21

#### Work completed

**1. PWA icons — `Quinn/icons/` (new folder)**
- Python/Pillow script (`generate_icons.py`) generates all icons from source — re-run it to regenerate
- Square icons (dark indigo #1a1035 background, white "Q"): 72, 96, 128, 144, 152, 192, 384, 512px
- Apple touch icon: 180×180 (same design, `icons/apple-touch-icon.png`)
- iOS splash screens (dark bg #0d0d1a, centered "Q"): 1170×2532, 1284×2778, 750×1334

**2. `manifest.json` — new**
- `start_url` / `scope`: `/Quinn/` — correct for GitHub Pages subpath deployment
- `display: standalone` — hides browser chrome when installed
- `background_color: #0d0d1a`, `theme_color: #1a1035` — matches Quinn's dark UI
- 8 icon sizes declared; 192 and 512 marked `purpose: "any maskable"`

**3. `index.html` — PWA meta tags**
- Added after Google Fonts `<link>`, before `<style>`:
  - `<link rel="manifest">`, `theme-color`, `mobile-web-app-capable`
  - Full iOS PWA set: `apple-mobile-web-app-capable`, status bar style, title, `apple-touch-icon`
  - Three iOS splash screen `<link>` tags (iPhone SE/8, 12/13/14, Pro Max)
- `APP_VERSION` bumped to `0.3.0` (MINOR — new feature)

**4. `sw.js` — updated**
- `CACHE_NAME` bumped to `quinn-v0.3.0` — evicts all old caches on next load
- Install step now precaches all 13 icon/manifest assets before `skipWaiting()`
- Three fetch strategies:
  - **Navigate** (HTML shell): network-first, cache fallback — unchanged
  - **Icons + manifest**: cache-first + background network update (stale-while-revalidate)
  - **Other same-origin assets**: cache-first — unchanged
- Cross-origin guard unchanged (Supabase/CDN still pass through untouched)

#### Files changed
- `Quinn/icons/` — **new folder**, 12 PNG files
- `Quinn/generate_icons.py` — **new** (keep for regenerating icons later)
- `Quinn/manifest.json` — **new**
- `index.html` — PWA meta tags in `<head>`, APP_VERSION → 0.3.0
- `sw.js` — precache on install, three-strategy fetch, CACHE_NAME → quinn-v0.3.0
- `HANDOFF.md` — this update

#### Hotfix (same session) — OpenDyslexic font not rendering on iOS
- **Root cause**: `@font-face` was pointing to `fonts.cdnfonts.com/s/19808/OpenDyslexic-Regular.woff` — that CDN has unreliable CORS headers on iOS Safari, causing the font request to fail silently, falling back to system sans-serif
- **Fix**: Downloaded OpenDyslexic-Regular.woff2 (101 KB) and embedded it as a base64 data URI directly in the `@font-face` block — zero network dependency, no CORS involved
- **Also changed**: `font-display: block` → `font-display: swap` (prevents invisible text if font somehow fails); added `!important` to `font-family` in `.dyslexia-font` rule and expanded selectors to cover `p`, `span`, `div` (iOS specificity edge cases)
- `index.html` size: ~76 KB → ~214 KB (base64 adds ~134 KB — well within PWA budget)

#### Needs Jason
- **Replace placeholder icons** — drop real artwork PNGs into `Quinn/icons/` using the same filenames and sizes. No other code changes needed.
- **Deploy**: `git push origin main` — GitHub Pages will auto-deploy. The new SW cache name will force all existing visitors to pick up the new version on next load.
- **Test "Add to Home Screen" on iPhone**: Open Quinn in Safari → Share → Add to Home Screen. The app should install with the Quinn icon and open in standalone mode (no browser chrome).
- **Test on Android**: Open Quinn in Chrome → three-dot menu → "Add to Home screen" or the install prompt may appear automatically.

---

---

### Session 12 — 2026-03-21 (follow-up fix: Bella dyslexia font on iOS)

#### Problem
OpenDyslexic font still not rendering on iOS after Session 11's base64 embed fix.

#### Root cause analysis
Three compounding issues:
1. **Timing** — `applyDyslexiaFont()` was called *before* `showView('chat')` and before chat message elements existed in the visible DOM. iOS Safari's rendering engine sometimes ignores style changes applied before a view becomes visible.
2. **No dynamic style injection** — toggling `body.dyslexia-font` CSS class alone is not enough on iOS. The class toggle happens, but iOS doesn't always re-evaluate font rendering for elements created after the initial layout pass.
3. **`*` selector missing** — the CSS rule covered specific element types (`div`, `span`, `p`, etc.) but not everything. Some message containers may have been missed.

#### Work completed

**1. `<style id="dyslexia-style">` added to `<head>` (`index.html`)**
- Empty at load time; populated at runtime by `applyDyslexiaFont()` to force a CSS recalculation

**2. `applyDyslexiaFont()` rewritten (`index.html`)**
- Keeps the existing `body.dyslexia-font` class toggle (backward compatible)
- After `document.fonts.load()` resolves, injects CSS rules directly into `#dyslexia-style` using `* { font-family: 'OpenDyslexic' !important }` plus explicit chat/MG selectors
- When disabled: clears injected rules (empty string)

**3. Call-site timing fixed (`index.html`)**
- `await applyDyslexiaFont(lp?.profile_json)` moved from *before* `showView('chat')` to *after* it
- Font injection now fires when the chat view is visible and all DOM elements exist — iOS re-renders immediately

**4. `sw.js` CACHE_NAME bumped to `quinn-v0.3.1`**
- Forces iOS PWA to fetch fresh `index.html` instead of serving the old cached version

#### Files changed
- `index.html` — `<style id="dyslexia-style">` in `<head>`, `applyDyslexiaFont()` rewrite, call-site timing fix
- `sw.js` — CACHE_NAME → `quinn-v0.3.1`
- `HANDOFF.md` — this update

#### Deploy
- `git push origin main` — SW cache bump forces all visitors to receive the updated files

---

### Session 13 — 2026-03-22

#### Work completed

**1. Fixed chat Edge Function multiline string parse error (`supabase/functions/chat/index.ts`)**
- Previous session's Python-based edit wrote a literal multiline string (`ctx += "\n..."` with actual newlines) instead of `\n` escape sequences, which is illegal JavaScript
- Deno bundler threw `Expected ident` at line 433 (`## Pattern Note`) on deploy
- Fix: rewrote the `ctx +=` string as a single-line string with `\n` escapes using the Edit tool
- Also removed an orphaned `}` that the Python script had left behind (the closing brace of `if (summaries.length > 0)` was displaced, creating an `Expression expected` error at line 464)
- Deployed successfully: `supabase functions deploy chat`

**2. Academic bridging for Joie now live**
- Pattern detection + `## Pattern Note` injection into system prompt was written last session but never deployed (blocked by parse errors)
- Detects when last 2–3 sessions are entirely creative writing / roleplay subjects (using `CREATIVE_ONLY` Set)
- When triggered, appends a Pattern Note to Quinn's context instructing it to find a genuine warm bridge toward academics this session
- Core personality instruction also updated to always keep academics in mind and use creative interests as an entry point
- This is now live in production

#### Files changed
- `supabase/functions/chat/index.ts` — fixed multiline string (pattern detection `ctx +=`), removed orphaned `}`
- `HANDOFF.md` — this update

#### Pending verification
- Confirm Joie's next session naturally bridges toward academics when pattern is active (3 consecutive creative-only sessions = pattern fires)
- `session_summaries_rows.json` in repo root is a leftover debug file — delete before next session or add to `.gitignore`

---

### Session 14 — 2026-03-22

#### Work completed

**1. Fix 1 — Explicit session guard on all Edge Function invoke calls (`index.html`)**
- Root cause of 401: session JWT wasn't being checked before invoke; fallback was sending the anon key, which fails JWT-verified Edge Functions
- Added `if (!session) return;` guard after `supabase.auth.getSession()` in every invoke site:
  - `sendMessage()` → `chat`: guard + user-facing "Session expired" message shown in chat
  - `writeSummary()` → `summarize`: guard + silent return (background operation)
  - `updateProfile()` → `update-profile`: guard + silent return (background operation)
  - ingest-material upload handler → `ingest-material`: guard + throws (parent dashboard catch block handles display)
- Simplified auth header construction: removed anon-key fallback — if there's no session, we don't call at all; `authHeader` now always uses `session.access_token` directly
- Client-side is now fully correct. **Server-side deploy with `--no-verify-jwt` still required** (see Needs Jason)

**2. Fix 2 — Session summary debug logging (`index.html`)**
- Added `console.log('writeSummary triggered, isFinal:', isFinal)` at the top of `writeSummary()` so Eruda on iPhone can confirm whether the function is firing at all
- This disambiguates two failure modes: (a) writeSummary not being called vs (b) summarize Edge Function returning an error

**3. Fix 3 — Pin Eruda CDN to v3 (`index.html`)**
- Updated Eruda script src from `https://cdn.jsdelivr.net/npm/eruda` (latest, unpinned) to `https://cdn.jsdelivr.net/npm/eruda@3/eruda.min.js` (pinned, minified)
- Eruda already existed in the app at `?debug=true`; this just makes it stable and smaller

#### Files changed
- `index.html` — session guard on all 4 invoke sites, `writeSummary` console.log, Eruda CDN pin
- `HANDOFF.md` — this update

#### Deploy required
```
supabase functions deploy chat summarize update-profile ingest-material --no-verify-jwt
```
This unblocks all Edge Function calls. No new code changes in Edge Functions themselves — client-side only.

---

### Session 15 — 2026-03-22

#### Context

Joie (age 13) pulled Quinn into a sustained creative fiction session — a rich multi-paragraph horse story, narrated in third person, with Quinn acting as co-author and ending messages with "What happens next?" Quinn was technically following the identity rules (author, not character) but was completely off-mission: indefinitely extending a fiction with no educational connection.

#### Root cause

The existing drift scoring instructions didn't explicitly identify creative co-authorship as a high-drift pattern. The drift threshold in the chat Edge Function (7) was too high for this pattern to trigger a steering note, and there was no explicit rule in Quinn's personality about capping creative writing sessions.

#### Work completed

**1. Creative Writing Drift rule — `chat/index.ts` (Block 1, core personality)**
- Added `### Creative Writing Drift` subsection under `## Identity & Roleplay Boundaries`
- Explicit 2-3 exchange limit on sustained fiction with no connection to real life or schoolwork
- Hard rule: Quinn never ends a creative message with an open-ended invitation to continue ("What happens next?", "Your turn", "What do you do?")
- Quinn redirects naturally: acknowledges the creative work, then bridges to real life or academics

**2. Drift trigger threshold lowered — `chat/index.ts` (Block 2)**
- `driftScore >= 7` → `driftScore >= 5` in `buildKidContext()`
- The steering note now fires earlier, before creative sessions become deeply entrenched
- Note: `index.html` was already storing drift scores at `>= 5` threshold — no change needed there

**3. Drift scoring updated — `summarize/index.ts`**
- Added explicit scoring bands for creative writing drift:
  - Score 6-8: Sustained creative co-authorship with no academic connection
  - Score 8-10: Quinn asking "What happens next?" / 3+ messages of pure creative content / co-authoring extended fiction
- Haiku now has explicit criteria to score the Joie-style pattern highly instead of treating it as normal creative discussion

**4. Creative interest note — `chat/index.ts` (Block 2, `buildKidContext()`)**
- Added profile-aware creative interest detection (checks `interests` array and `communication_style` for creative/artistic keywords)
- When triggered: injects a `## Creative Interest Note` into the kid-specific context reminding Quinn to use creativity as a bridge, not an open-ended destination
- Not hardcoded to Joie — fires for any kid whose profile signals creative tendencies

#### Files changed
- `supabase/functions/chat/index.ts` — Creative Writing Drift rule in Block 1, threshold `>= 7` → `>= 5`, creative interest note in `buildKidContext()`
- `supabase/functions/summarize/index.ts` — updated drift scoring bands
- `HANDOFF.md` — this update

#### Deploy required
```
supabase functions deploy chat summarize --no-verify-jwt
```

---

### Session 16 — 2026-03-22

#### Work completed

**1. SQL migration — `003_material_inactive_flag.sql` (new)**
- Adds `inactive boolean not null default false` to `study_materials`
- Three-state model:
  - `inactive = false` (default) → active, included in Quinn's context
  - `inactive = true` → paused, excluded from context, shown greyed in dashboard
  - `archived_at IS NOT NULL` → permanently deleted (existing soft-delete)

**2. CSS — `index.html`**
- `.material-item.paused` → opacity 0.5
- `.material-controls` → flex container for the two action buttons
- `.pill-btn`, `.pill-active`, `.pill-paused` → green "Active" / grey "Paused" pill toggle buttons
- `.material-delete-btn` → red-on-hover trash icon button
- `.paused-section-label` → section divider for the Paused group

**3. Parent dashboard — material card controls (`index.html`)**
- Replaced single "Remove" button with two controls per material:
  - **Active/Paused pill toggle**: clicking flips `inactive` in DB and re-renders the list
  - **Delete permanently (🗑)**: confirm dialog → removes from Supabase Storage + `study_materials` table
- Active materials shown first; paused materials shown below a "Paused" label, greyed out
- Both `buildKidDetailHTML` and `refreshMaterialList` use the same render logic

**4. Functions added/replaced — `index.html`**
- `toggleMaterialInactive(materialId, kidId, setInactive)` — replaces `archiveMaterial`; updates `inactive` field only
- `deleteMaterial(materialId, kidId)` — confirm dialog → `storage.remove([path])` → `study_materials.delete()` → refresh
- `refreshMaterialList(kidId)` — rewritten to render active + paused sections
- Window exports updated: `archiveMaterial` removed; `toggleMaterialInactive` + `deleteMaterial` added

**5. Kid chat context — `index.html`**
- Added `.eq('inactive', false)` to the `study_materials` query on kid login — inactive materials are never loaded into `materialSummaries` and never reach Quinn's system prompt

#### Files changed
- `supabase/migrations/003_material_inactive_flag.sql` — **new**
- `index.html` — CSS additions, kid chat query filter, `buildKidDetailHTML` materials section, `toggleMaterialInactive`, `deleteMaterial`, `refreshMaterialList` rewrite, window exports

---

### Session 17 — 2026-03-23

#### Work completed

**Migration applied — `003_material_inactive_flag.sql`**
- Jason ran the migration in the Supabase SQL editor
- `inactive boolean not null default false` column is now live on `study_materials`
- All existing materials default to `inactive = false` (active) — no data impact

**Toggle/delete controls shipped — `index.html`**
- Session 16 code (pill toggle, delete button, paused section, `toggleMaterialInactive`, `deleteMaterial`, `refreshMaterialList`) committed and pushed to GitHub Pages
- Feature is live in production

#### Files changed
- `supabase/migrations/003_material_inactive_flag.sql` — committed to repo
- `index.html` — toggle/delete controls committed
- `HANDOFF.md` — this update

---

## Special Considerations

- **Bella is dyslexic** — her child profile must use a dyslexia-friendly font (e.g. OpenDyslexic or similar). This is a per-child profile setting, not a global app setting.
- **Sibling isolation is strict** — no cross-sibling data access under any circumstances. RLS enforces this at the database level.
- **No full transcripts for parents** — parents see session summaries only. This is intentional to preserve kid trust.
- **All API keys server-side only** — ANTHROPIC_API_KEY lives exclusively in Supabase Edge Function environment variables. If any API call is ever added to client JS, that is a bug. No GEMINI_API_KEY is used.

---

## Changelog

- v0.4.0 (2026-03-24): Bulk PDF upload with per-file progress queue; sanitize storage filenames for emoji and non-ASCII characters
