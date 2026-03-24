# Session Start — Quinn

You are working on **Quinn**, an AI learning companion for kids (Mason 10, Joie 13, Bella 15) built as a single HTML file on GitHub Pages with a Supabase backend and Claude API.

## Load on session start

1. Read `HANDOFF.md` — current build status, last completed session, active TODOs, and known issues
2. Read `index.html` — the entire app (all CSS, HTML, and JS inline, ~230K bytes)
3. Read `CLAUDE.md` if you need architecture/stack context

## Skip unless explicitly needed

- `icons/` — PWA icon assets, not relevant to most tasks
- `sw.js` — service worker, only touch for PWA/caching work
- `manifest.json` — PWA manifest, only touch for PWA config work
- `QUINN_PRD.md` — full product spec, only read for product-level decisions
- `IMG_5033.PNG` — reference photo, not code

## Architecture reminders

- **All Claude API calls** go through Supabase Edge Functions (`supabase/functions/`) — never add API keys to `index.html`
- **Chat model**: Haiku 4.5 during dev; switch to Sonnet 4.6 for production
- **Prompt caching** must stay enabled — system prompt + learner profile are cached (90% token savings)
- **temperature=0.7** for Quinn conversation; **temperature=0.2** for structured outputs (summaries, profile JSON)
- **No gamification** — no XP, coins, badges. Different register than Daily Quest.
- **Zero sibling visibility** — child profiles fully isolated, no cross-profile data anywhere
- **Parents cannot see full transcripts** — summaries and flags only
- To test: open `index.html` in browser. Deploy: push to GitHub (Pages auto-deploys)
- Always update `HANDOFF.md` after completing any task or build step

## Supabase schema tables

`kids`, `learner_profiles`, `session_summaries`, `exams`, `study_materials`, `parent_notes`

## Start prompt

What are we working on today?
