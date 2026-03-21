# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quinn** is an AI learning companion for kids — a named, consistent AI friend (not a tutor) that builds a genuine relationship with each child through persistent memory, age-calibrated tone, and interest-driven teaching. Built for Jason's family: Mason (10), Joie (13), Bella (15). Parents (Jason + Keri) manage all three profiles from a shared dashboard.

Status: **Pre-build.** Full PRD is in `QUINN_PRD.md`.

Key principle: Rapport and trust come first. Education follows naturally. Quinn earns the right to teach.

## Stack

| Piece | Tool |
|---|---|
| AI conversation | Claude API (Sonnet 4.6 for live chat, Haiku 4.5 for summaries/profile updates) |
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
- **Model routing**: Sonnet 4.6 for live Quinn conversation and document ingestion; Haiku 4.5 for session summary writes and learner profile updates
- **temperature=0.7** for Quinn conversation (warmth + consistency); **temperature=0.2** for structured outputs (summaries, profile JSON updates)
- All Claude API calls must be routed through **Supabase Edge Functions** — never expose API keys in client-side JS

### Single-File Front End
Same pattern as Daily Quest — one `index.html` with all CSS, HTML, and JS inline. No build step. Open in browser to develop, push to GitHub to deploy.

## Screen Structure
- **Child login** — profile selector (kids only see own profile, no siblings)
- **Quinn chat** — full-screen chat with Quinn's animated visual presence
- **Meet and greet** — first-run flow for new child profiles (cannot be skipped)
- **Parent dashboard** — accessed separately; overview of all three kids + material/exam management
- **Parent onboarding** — separate from child meet and greet

Admin access: URL parameter or separate login path (TBD — see Open Questions in PRD).

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

## Skills & Tools to Have Active
- `frontend-design` skill — before any UI work
- `feature-dev` skill — for structured multi-phase implementation
- Context7 MCP — for up-to-date Supabase/Claude API docs
- Supabase MCP — for direct DB access during development

## Custom Quinn Skills to Build (in order)
1. `quinn-memory-schema` — exact learner profile JSON structure and three-tier update rules
2. `quinn-prompt-engineer` — how to write/refine Quinn's system prompts, voice per age group
3. `quinn-safety-review` — pre-ship safety checklist for kids app
4. `quinn-ui-patterns` — Quinn's UI conventions, visual presence states, chat patterns

## v2 Architecture Notes (do not block these in v1)
- Audio output: structure Claude response pipeline so text can be passed to ElevenLabs TTS without restructuring
- YouTube co-watching: `source_type` on `study_materials` already accounts for this
- pgvector: plain Postgres for v1, vector embeddings upgrade in v2 for semantic session retrieval
