# Quinn Audit — Fix List
Generated from AI Slop Detector audit, 2026-03-25
**Audit score: 64/100 — 🟠 Needs Work**
Full report: run `ai-slop-detector` skill in Claude Code

---

## Context from Audit

- **Verdict:** Not AI slop — genuine craft, but needs a security pass. Architecture, RLS, prompt caching, and safety tiers are all solid. Issues are specific and fixable.
- **Biggest concern:** This is a kids' app. The XSS gap and kid_id trust gap both matter more here than they would in a typical solo project.
- **`escHtml()`** is already defined at [index.html:1589](index.html#L1589) and used in 20+ places in the parent dashboard. It just wasn't applied to chat message rendering.
- **`kid_id` trust gap:** All Edge Functions (`chat`, `summarize`, `update-profile`) accept `kid_id` from the request body without verifying it belongs to the authenticated user. Low real-world risk (family-only app, must be authenticated), but architecturally wrong.
- **Model in deployed code:** `chat/index.ts` deploys `claude-haiku-4-5-20251001` (cost-saving decision per memory notes). CLAUDE.md documents Sonnet 4.6 as the intended chat model — keep in sync when switching back.

---

## To-Do List (Highest → Lowest Impact)

- [ ] **P0 — Fix XSS in chat message renderer**
  - File: [index.html:1274](index.html#L1274) and [index.html:1284](index.html#L1284)
  - Both `addQuinnMsg` and `addKidMsg` inject raw text into `innerHTML` without escaping.
  - Fix: wrap `text` with `escHtml(text)` in both functions.
  - `escHtml` is already defined at line 1589 — zero new code needed.
  - ```js
    // Before
    d.innerHTML = `<div class="msg-text">${text}</div><div class="msg-time">${msgTime()}</div>`;
    // After
    d.innerHTML = `<div class="msg-text">${escHtml(text)}</div><div class="msg-time">${msgTime()}</div>`;
    ```

- [ ] **P1 — Validate `kid_id` server-side in Edge Functions**
  - Files: `supabase/functions/chat/index.ts`, `summarize/index.ts`, `update-profile/index.ts`
  - Pattern: extract the JWT from the `Authorization` header, call `supabase.auth.getUser(token)`, then look up `kid_id` from the `profiles` table using `user.id`. Reject the request if the `kid_id` in the body doesn't match.
  - Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars (already available in Edge Functions) to create an admin client for the lookup.

- [ ] **P2 — Fix brittle timing in dyslexia font smoke test**
  - File: [tests/smoke_tests.py:235](tests/smoke_tests.py#L235)
  - Replace `page.wait_for_timeout(3000)` with `page.wait_for_function("() => document.body.classList.contains('dyslexia-font')", timeout=TIMEOUT)`
  - Will stop flaking on Edge Function cold starts.

- [ ] **P3 — Add session summary pipeline smoke test**
  - No test currently covers the most critical background pipeline (incremental summary writes + inactivity finalization).
  - Suggested test: sign in as test kid, send 10+ messages, then verify a `session_summaries` row exists in Supabase for that `kid_id` with non-null `subjects_touched`.
  - Can use the Supabase client directly from the test (anon key is in `.env`).

- [ ] **P4 — Centralize model version constants in Edge Functions**
  - `claude-haiku-4-5-20251001` is hardcoded in `chat/index.ts`, `summarize/index.ts`, and `update-profile/index.ts`.
  - Add `const MODEL = "claude-haiku-4-5-20251001";` at the top of each file so a model upgrade is one touch per function, not a grep-and-replace.
  - When switching chat back to Sonnet 4.6, update `chat/index.ts` separately from the others.
