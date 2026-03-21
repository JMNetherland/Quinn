# Quinn — Project Handoff Document

> **Update this document after every build step.**
> Last updated: 2026-03-20

---

## Project Overview

Quinn is a personal AI learning companion for three kids. It builds real relationships through persistent memory — not a tutor, but a named AI friend. Single HTML file deployed to GitHub Pages, with a Supabase backend, Claude API for conversation, and Gemini API for document ingestion.

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
| AI — Document processing | Gemini File API (via Edge Function) |
| API key handling | Claude + Gemini keys via Supabase Edge Functions only — never client-side |

---

## Key Decisions (locked)

| Decision | Choice |
|---|---|
| AI model (chat) | Claude Sonnet 4.6 |
| AI model (summaries/profile updates) | Claude Haiku 4.5 |
| Document processing | Gemini File API |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Front end | Single HTML file |
| Deployment | GitHub Pages |
| API keys | Claude/Gemini via Edge Functions only — never client-side |
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
| Session summary writing (incremental) | ❌ Not started |
| Learner profile update after session | ❌ Not started |
| Parent dashboard (dynamic data) | ❌ Still hardcoded HTML |
| Exam entry UI | ❌ Not started |
| Study material upload + Gemini ingestion | ❌ Not started |
| Parent notes | ❌ Not started |
| Supabase migration run in project | ⏳ Pending Jason |

---

## Next Steps (in order)

1. **Run migration** — Jason runs `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor
2. **Seed data** — Create parent + kid accounts in Supabase Auth; seed `profiles` table
3. **Deploy Edge Function** — `supabase functions deploy chat` from project root; set `ANTHROPIC_API_KEY` secret via `supabase secrets set ANTHROPIC_API_KEY=...`
4. **Session summary system** — Incremental writes + inactivity timeout (5 min)
5. **Learner profile update** — Post-session Haiku call to enrich profile JSON from conversation
6. **Parent dashboard** — Dynamic data from Supabase (kids, exams, summaries)
7. **Bella dyslexia font** — Apply OpenDyslexic when `learner_profile.stable.dyslexia_font === true`

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

## Special Considerations

- **Bella is dyslexic** — her child profile must use a dyslexia-friendly font (e.g. OpenDyslexic or similar). This is a per-child profile setting, not a global app setting.
- **Sibling isolation is strict** — no cross-sibling data access under any circumstances. RLS enforces this at the database level.
- **No full transcripts for parents** — parents see session summaries only. This is intentional to preserve kid trust.
- **All API keys server-side only** — Claude and Gemini keys live exclusively in Supabase Edge Function environment variables. If any API call is ever added to client JS, that is a bug.
