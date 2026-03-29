# CLAUDE.md

<!-- COMPACTION RULE: When compacting, always preserve the full list of modified files, any active TODOs, and any test commands. -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Navigation
- **Codebase map:** read `CODEBASE.md` before exploring this project's files
- **Vault:** read `C:/Dev/obsidian-vault/VAULT_INDEX.md` before creating or searching vault notes
- **Vault update:** after updating HANDOFF.md, also update `C:/Dev/obsidian-vault/Projects/Quinn.md` — version, blockers, and session number

## Project Overview

**Quinn** is an AI learning companion for kids — a named, consistent AI friend (not a tutor) that builds a genuine relationship with each child through persistent memory, age-calibrated tone, and interest-driven teaching. Built for Jason's family: Mason (10), Joie (13), Bella (15). Parents (Jason + Keri) manage all three profiles from a shared dashboard.

Status: **Live — v0.6.0, Session 17 complete.** Full PRD is in `QUINN_PRD.md`.

Key principle: Rapport and trust come first. Education follows naturally. Quinn earns the right to teach.

## Current Feature State

- Supabase auth, DB, and storage wired; all Edge Functions deployed and live
- Claude chat live (Sonnet 4.6) with prompt caching, drift scoring, and roleplay/creative writing guardrails
- Session summaries write incrementally + finalize on inactivity timeout
- Parent dashboard: exam CRUD, material upload/toggle/delete, session summary cards with safety flags
- PWA enabled (manifest + service worker)
- Eruda debug console accessible at `?debug=true`
- Roleplay guardrails + drift detection active (drift score 0–10; correction injected at 5+)

## Stack

| Piece | Tool |
|---|---|
| AI conversation | Claude API (Sonnet 4.6 for Quinn chat; Haiku 4.5 for dev/subagent tasks) |
| Document ingestion | Claude Sonnet 4.6 (200K context — no Gemini; one API, one key, one SDK) |
| Database + auth + storage | Supabase (Postgres, Auth, Storage) |
| Front end | Single HTML file — GitHub Pages |
| Quinn visual | Canvas or WebGL animation (TBD) |
| Audio (v2 only) | ElevenLabs TTS |

## Architecture

### Memory System (Most Critical)
Quinn has no built-in memory. Context is constructed at conversation start from three Supabase sources loaded every session:
1. **Learner profile** — living JSONB doc per child, updated after every conversation
2. **Last 5 session summaries** — recent continuity context
3. **Upcoming exams** — calendar awareness

At conversation end Quinn writes a session summary and updates the learner profile. Because kids close the app without warning, summaries write **incrementally** during conversation and finalize via **inactivity timeout** — not a formal session-end trigger.

### Supabase Schema (Phase 1)
```
kids               — id, parent_id, name, age, grade, created_at, last_active_at
learner_profiles   — id, kid_id, profile_json (JSONB), updated_at
session_summaries  — id, kid_id, started_at, ended_at, duration_minutes,
                     mood_open, mood_close, subjects_touched, academic_notes,
                     personal_notes, readiness_estimate, communication_notes
exams              — id, kid_id, subject, exam_type, exam_date, notes, created_at
study_materials    — id, kid_id, subject, source_type (pdf/youtube/gdoc/text),
                     file_url, file_name, material_summary, uploaded_at, archived_at
parent_notes       — id, kid_id, note, created_at
```

`source_type` field on `study_materials` is intentional for v2 YouTube co-watching — do not remove it.

### Claude API Patterns
- **Prompt caching** must be enabled — system prompt + learner profile load every conversation (90% savings on cached tokens)
- **Model routing**: Sonnet 4.6 for Quinn chat and ingest-material; Haiku 4.5 for dev/subagent tasks (summarize, update-profile)
- **temperature=0.7** for Quinn conversation (warmth + consistency); **temperature=0.2** for structured outputs (summaries, profile JSON updates)
- All Claude API calls must be routed through **Supabase Edge Functions** — never expose API keys in client-side JS

### Single-File Front End
Same pattern as Daily Quest — one `index.html` with all CSS, HTML, and JS inline. No build step. Open in browser to develop, push to GitHub to deploy.

## Screen Structure
Child login → Quinn chat → Meet and greet (first-run, unskippable) → Parent dashboard. See `obsidian-vault/Projects/Quinn/Screen Structure.md`.

## Quinn Tone Per Child
- **Mason (10)**: High energy, short wins, humor, gaming analogies. Quinn feels like a cool older sibling.
- **Joie (13)**: Peer-level, genuine, connects to creativity/Pokémon/animals. Not a teacher trying to be cool.
- **Bella (15)**: Intellectual, peer-level, less cheerleading, more real conversation.

Tone is driven by the learner profile and age — not hardcoded persona switching.

## Key Rules

- **Quinn never calls itself an AI assistant, tutor, or app** in conversation. It is simply Quinn.
- **No gamification** — no XP, coins, badges, or points. Different emotional register than Daily Quest.
- **Parents cannot see full transcripts** — dashboard shows summaries and academic data only. This trust boundary must be maintained in all UI decisions.
- **Zero sibling visibility** — child profiles are fully isolated. No cross-profile data exposure anywhere in the UI or API calls.
- **All API keys via Supabase Edge Functions** — ANTHROPIC_API_KEY only. No Gemini key. Never in client JS.
- **No external links** from Quinn conversation — no sending kids to external websites.
- **Emotional disclosures** — Quinn listens and validates but always redirects serious issues to trusted adults. Soft parent dashboard alert (not content — just a flag to check in).

## Development Workflow
1. Open `index.html` in browser — no build step
2. Edit → save → refresh to test
3. Supabase: use the Supabase MCP server for direct schema inspection and query testing during development
4. Deploy: push to GitHub (Pages auto-deploys)

## v2 Notes & Skills Backlog
See `obsidian-vault/Projects/Quinn/v2 Architecture Notes.md` and `obsidian-vault/Projects/Quinn/Skills to Build.md`.

---

## Known Code Quality Gaps (Fix in v1, Before v2)

These three gaps were identified by comparing Quinn's patterns against Ember (the sibling project, built after Quinn). They are not blocking but represent real risk — especially for a kids app where silent failures corrupt learner profiles or lose session summaries.

### Gap 1 — Async Error Handling (HIGH)
Quinn's Claude API calls, session summary writes, and learner profile updates are likely bare async without try/catch. A network failure or Edge Function error silently fails — the summary doesn't write, the learner profile doesn't update, and the kid's conversation history is partially lost.

**Fix:** Wrap every async Supabase and Edge Function call in try/catch. Show a visible error state rather than hanging or silently dropping data. The incremental summary write is the most critical path — failure there means a conversation is lost entirely.

### Gap 2 — Implicit State Management (MEDIUM)
Quinn's conversation flow has clear states (loading → unauthenticated → meet-and-greet → active-conversation) but these are almost certainly managed as ad-hoc flags scattered through the code rather than an explicit state machine. This makes transitions hard to reason about and edge cases easy to miss.

**Fix:** Consolidate into an explicit `appState` variable with typed values — same pattern as `KidDashboard.tsx` in Ember. This is a vanilla JS refactor; no new library needed.

### Gap 3 — Learner Profile Update Logic (MEDIUM)
The three-tier learner profile update (stable / current-state / observed-patterns) is applied entirely through a Claude prompt, with no way to verify the merge is correct. If the prompt drifts or Claude makes a wrong judgment, profile corruption is silent and accumulates across sessions.

**Fix:** Extract the merge rules as a documented pure function that validates the structure before writing. In v1 this can be a JS validation function. In v2 (TypeScript) it becomes fully unit-testable. At minimum, add a schema check before any `UPDATE learner_profiles` write.
