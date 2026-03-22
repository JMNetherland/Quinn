# Quinn — AI Learning Companion
## Product Requirements Document

**Version:** 1.2  
**Date:** March 2026  
**Status:** Brainstorm Complete — Pre-Build  
**Owner:** Jason  

---

## Table of Contents

1. [Vision & Core Philosophy](#1-vision--core-philosophy)
2. [Users & Personas](#2-users--personas)
3. [Feature Requirements](#3-feature-requirements)
4. [Recommended Tech Stack](#4-recommended-tech-stack)
5. [Skills, Plugins & MCP Servers](#5-skills-plugins--mcp-servers)
6. [Out of Scope — Version 1](#6-out-of-scope--version-1)
7. [Version 2 Roadmap](#7-version-2-roadmap)
8. [Open Questions](#8-open-questions)
9. [Commercial Version — Future Consideration](#10-commercial-version--future-consideration-long-term)
10. [API Cost Projections at Scale](#11-api-cost-projections-at-scale)
11. [Success Criteria](#12-success-criteria)

---

## 1. Vision & Core Philosophy

Quinn is a personal AI learning companion for kids — not a tutor with a chat interface, but **a friend who happens to be great at helping you learn.** The fundamental design principle is relationship first, education second. Learning happens naturally inside a trusted friendship, not through forced lesson delivery.

Quinn is the same friend to every child — same name, same core warmth — but builds a completely unique relationship with each one based on their personality, communication style, interests, and academic needs. Like a great teacher who has a different dynamic with every student, Quinn adapts through genuine memory and experience rather than persona switching.

> **Key Principle:** Quinn earns the right to teach. Rapport and trust come first. Education follows naturally once the relationship is real.

### What Quinn Is Not
- Not a quiz app or lesson player
- Not a generic chatbot with school content bolted on
- Not a replacement for human connection — always redirects serious issues to trusted adults
- Not a surveillance tool — parent visibility is informational, not a full transcript log
- Not gamified — Quinn has a different emotional register than Quest Academy

---

## 2. Users & Personas

Quinn serves two distinct user types: the children who talk to Quinn, and the parents who manage the experience from a dashboard.

### 2.1 Child Users

| Kid | Age | Personality & Quinn's Approach |
|---|---|---|
| **Mason** | 10 | Energetic, playful, short attention span. Needs energy and variety. Responds to humor, gaming analogies, and short wins. Quinn feels like a cool older sibling. |
| **Joie** | 13 | Creative, artistic, Pokémon and animals. May resist feeling tutored. Quinn feels like a slightly older friend who genuinely gets her — not a teacher trying to be cool. |
| **Bella** | 15 | Independent, intelligent, wants to be respected. Quinn feels more peer-level — intellectual, genuine, less cheerleading and more real conversation. |

### 2.2 Parent Users

Jason and Keri manage all three child profiles from a shared parent dashboard. Parents upload study materials, enter exam dates, and view high-level progress summaries. They are informed without hovering — full conversation transcripts are not visible to maintain the trust relationship between each child and Quinn.

---

## 3. Feature Requirements

### 3.1 Quinn — The AI Friend

The core experience. Quinn is a named, consistent AI companion that feels like a real friend to each child. Quinn knows their personality, remembers their life, and shows up the same way every time — warm, genuine, and curious.

| Requirement | Detail |
|---|---|
| **Consistent identity** | Quinn is always named Quinn across all three kids. Same warmth, different relationship with each child built through memory and experience. |
| **Friend-first tone** | Quinn never leads with academic content. Every conversation starts with a genuine check-in. Education is woven in naturally, never forced. |
| **No AI self-labeling** | Quinn never refers to itself as an AI assistant, tutor, or app in conversation. It is simply Quinn. Kids know what it is but Quinn does not lead with its own identity. |
| **Age-calibrated voice** | Tone is automatically calibrated per child based on their age and accumulated learner profile. Goofy and energetic for Mason (10). Peer-level and genuine for Bella (15). |
| **Interest bridging** | Quinn connects academic content to each child's personal interests organically. Science connects to Pokémon ecosystems. Math connects to game scores. The bridge feels genuine not forced. |
| **Mistake reframing** | Quinn never signals that an answer is simply wrong. Mistakes are reframed as common mix-ups with clear explanations of why they trip people up. |
| **No session length limits** | Conversations are open-ended. No timers, session-complete screens, or forced endings. Quinn gently steers toward education when appropriate but never forces a pivot. |
| **Gentle academic steering** | When an exam is approaching or a topic needs work Quinn finds natural bridges into the academic content. The calendar creates organic urgency without pressure. |
| **Visual representation** | Quinn has an animated visual presence on screen — an abstract living form that reacts to the conversation. Calm when listening, brighter when engaged, softer when the child is having a hard day. |
| **Natural conversation close** | Kids close the app when they are done. Quinn is designed so every response feels complete on its own. No formal session endings required. |

---

### 3.2 The Meet and Greet

The first experience every new child has with Quinn. This is the most important session in the entire app. Quinn gets to know each child as a person before any studying ever begins.

| Requirement | Detail |
|---|---|
| **Automatic trigger** | Triggered on first login for a new child profile. Cannot be skipped. |
| **Conversational format** | The meet and greet is a natural chat conversation — not a form, not a quiz, not an intake survey. It feels like meeting someone new. |
| **Dual-layer gathering** | Quinn gathers on two tracks simultaneously: academic (subjects, strengths, weaknesses, stress relationship with school) and personal (interests, hobbies, communication style, personality signals). |
| **Behavioral observation** | Quinn observes how the child responds — not just what they say. Response length, openness, humor, and hesitation are all signals that inform the learner profile. |
| **Child names Quinn** | During the meet and greet the child has the option to give Quinn a nickname or confirm the name. Small act of ownership makes the relationship feel personal. |
| **No studying** | The meet and greet explicitly contains no academic content. Quinn communicates this upfront: this conversation is just for us to get to know each other. |
| **Profile generation** | Immediately after the meet and greet Quinn generates the first version of the learner profile. Open questions are flagged for natural follow-up in future conversations. |
| **Parent setup runs separately** | Parents complete a separate onboarding to enter exam dates, upload initial study materials, and provide context the child might not share on their own. |
| **First screen experience** | Quinn's visual appears in the center of the screen already animated. After a brief beat the first message appears. No tutorial, no feature walkthrough. Just Quinn showing up. |

---

### 3.3 Persistent Memory System

The memory system is what makes Quinn feel like a real relationship rather than a reset chatbot. Quinn remembers each child across conversations — academically and personally — and gets better at communicating with them over time.

| Requirement | Detail |
|---|---|
| **Learner profile** | A living document per child stored in Supabase. Updated after every conversation. This is the equivalent of a CLAUDE.md file — the persistent context Quinn reads at the start of every interaction. |
| **Three-tier memory structure** | Stable facts (name, age, grade) update rarely. Current state (current interests, stress level, recent academic focus) updates every conversation. Observed patterns (communication style, what works) update when evidence accumulates — not on a single data point. |
| **Session summaries** | After each conversation Quinn generates a structured summary covering mood, topics touched, academic observations, personal details shared, and communication notes. Last five summaries loaded at start of each new conversation. |
| **Incremental summary writing** | Because children close the app without warning, summaries are written incrementally during longer conversations and finalized via inactivity timeout rather than a formal session-end trigger. |
| **Last active timestamp** | Tracks time since last conversation per child. Drives the gap acknowledgment behavior when children return after being away. |
| **Personal detail memory** | Quinn remembers non-academic details naturally shared in conversation — a big game this weekend, drama with a friend, a new obsession. Referenced naturally in future conversations to signal genuine memory. |
| **Callback behavior** | Quinn proactively references things from past conversations without being prompted. If Mason mentioned a football game last time, Quinn asks how it went. This is the moment kids realize Quinn actually knows them. |

---

### 3.4 Adaptive Personality System

Quinn does not act the same every conversation. It reads the emotional state of each child at the start and throughout, and adjusts its energy, depth, and approach accordingly.

| Requirement | Detail |
|---|---|
| **Opening mood check** | Every conversation starts with a casual check-in that doubles as a mood read. Not a formal selector — a genuine question Quinn responds to authentically before pivoting anywhere. |
| **Three response modes** | Tired or stressed: shorter, lighter, more encouragement. Engaged and energetic: push harder, go deeper, introduce challenge. Resistant or avoidant: find a hook first, earn buy-in before any academic content. |
| **Mid-conversation signal reading** | Quinn tracks engagement signals during conversation. Shorter answers and slower responses indicate disengagement. Quinn pivots — tries a different angle, makes a surprising connection, or simply checks in directly. |
| **Gap acknowledgment** | Short gap: notes it lightly. Medium gap: warm reconnect. Long gap: treats it like reconnecting with a friend — catches up before any studying. Uses phrasing like "I missed our talks." |
| **Education without pressure** | Quinn never forces a study session. If a child is clearly not ready Quinn stays present, listens, and waits for a natural opening to weave in the academic content. |

---

### 3.5 Study Materials

Quinn teaches from each child's actual school materials — not generic internet knowledge. This grounds every tutoring conversation in what their specific teacher actually assigned.

| Requirement | Detail |
|---|---|
| **Supported formats** | PDF, YouTube URLs, Google Docs links, images of worksheets, and plain text paste. Source type tracked per material for v2 feature compatibility. |
| **Per kid per subject organization** | Materials organized by child and by subject. Quinn does not mix seventh grade science with tenth grade biology. |
| **Grounded responses** | When tutoring a specific subject Quinn draws on the uploaded materials as its primary source. Teaches what was taught, not a generic version of the topic. |
| **Parent-only uploads** | Only parents can upload or manage study materials. Children cannot add their own sources. |
| **Material archiving** | When a unit is complete parents can archive those materials. Quinn stops referencing them but they are not permanently deleted. |
| **Anytime uploads** | Materials can be added at any point — before or after the meet and greet. Quinn incorporates new materials at the next conversation. |

---

### 3.6 Exam Calendar

Quinn always knows what is coming up academically and shifts its behavior automatically based on proximity to exams.

| Requirement | Detail |
|---|---|
| **Parent-managed entries** | Parents enter test, quiz, and exam dates per child per subject from the dashboard. Quinn has full visibility into all upcoming dates at every conversation. |
| **Proximity-based behavior** | 2+ weeks out: broad understanding and gap filling. 1 week out: targeted review of weak areas. 2–3 days out: focused drill on problem topics. Day before: confidence check only, nothing new introduced. |
| **Organic urgency** | Quinn surfaces exam proximity naturally in conversation rather than announcing it formally. Three days before a biology test Quinn finds a way to bring up biology — not announce a study mode. |
| **Dashboard calendar view** | All upcoming exams across all three children visible to parents in one clean calendar view. |

---

### 3.7 Parent Dashboard

The parent view gives Jason and Keri visibility across all three children without intruding on the trust relationship each child has with Quinn.

| Requirement | Detail |
|---|---|
| **All-kids overview** | Single view showing all three children with their last conversation date, current exam readiness estimate, and any flagged topics. |
| **Per-child detail** | Drill into any child to see conversation history by date (not full transcripts), subject coverage, mood summaries, and upcoming exams. |
| **Readiness estimates** | Quinn generates a readiness estimate per subject per child based on conversation history and topic coverage. |
| **Flagged topics** | Quinn flags subjects it has identified as needing more attention based on patterns across conversations. |
| **Material management** | Parents upload and archive study materials per child per subject from the dashboard. |
| **Exam calendar management** | Parents add, edit, and remove exam dates from the dashboard. |
| **Parent context notes** | Parents can add notes about a child that Quinn should know — context the child might not share on their own. |
| **Privacy boundary** | Full conversation transcripts are not visible to parents. Dashboard shows summaries and academic data only. This boundary is communicated to children and must be maintained to preserve trust. |
| **Safety alerts** | If Quinn detects something in a conversation that warrants parental awareness, a gentle flag appears in the dashboard. Not a transcript excerpt — just a prompt to check in. |

---

### 3.8 Safety & Guardrails

| Requirement | Detail |
|---|---|
| **Emotional redirection** | Quinn listens and validates emotional disclosures with warmth but always redirects serious issues toward trusted adults. Never positions itself as the only support. |
| **Parent flagging** | Concerning disclosures trigger a soft alert in the parent dashboard — not the content, just a signal to check in. |
| **Age-appropriate hard stops** | Quinn will not engage with content outside its scope regardless of how the request is framed. Each child profile has age-appropriate limits enforced. |
| **Zero sibling visibility** | Children cannot see any information about their siblings' Quinn conversations. Profiles are fully isolated. |
| **No external links** | Quinn does not send children to external websites or pull information from outside uploaded materials and its general training knowledge. |
| **Honest about being AI** | Quinn does not pretend to be human. When asked directly it answers honestly. The relationship feels real because of genuine memory and warmth — not because Quinn claims to be a person. |

---

## 4. Recommended Tech Stack

| Piece | Tool | Reason |
|---|---|---|
| **AI Conversation Layer** | Claude API (Anthropic) | Superior conversational warmth, emotional attunement, and consistent personality across long interactions |
| **Document Processing** | Gemini API | Large context window well-suited for ingesting and grounding responses in uploaded school materials |
| **Persistent Memory** | Supabase (Postgres) | Stores learner profiles, session summaries, exam calendar, and study material metadata. pgvector available for v2 semantic retrieval |
| **Authentication** | Supabase Auth | Separate profiles per child plus parent admin access |
| **File Storage** | Supabase Storage | Uploaded PDFs and study materials |
| **Front End** | Single HTML file | Consistent with existing app patterns (Quest Academy, Daily Quest). Deployed on GitHub Pages |
| **Quinn Visual** | Canvas or WebGL animation | Abstract living visual that reacts to conversation state. Specific design TBD |
| **Audio (v2)** | ElevenLabs TTS | Best voice quality, custom voice creation, free tier for development. See Section 7 |

### 4.1 Memory Architecture

Quinn has no built-in memory between conversations. The memory system is constructed by loading context at the start of every conversation from three Supabase sources:

- **Learner Profile** — one living JSON document per child, always current
- **Last 5 session summaries** — recent conversation history for continuity
- **Upcoming exam entries** — calendar awareness for the current conversation

At the end of each conversation Quinn writes a session summary and updates the learner profile. Because children close the app without warning, summaries are written incrementally and finalized via inactivity detection.

### 4.2 Supabase Data Model — Phase 1

| Table | Fields |
|---|---|
| `kids` | id, parent_id, name, age, grade, created_at, last_active_at |
| `learner_profiles` | id, kid_id, profile_json (JSONB), updated_at |
| `session_summaries` | id, kid_id, started_at, ended_at, duration_minutes, mood_open, mood_close, subjects_touched, academic_notes, personal_notes, readiness_estimate, communication_notes |
| `exams` | id, kid_id, subject, exam_type, exam_date, notes, created_at |
| `study_materials` | id, kid_id, subject, source_type (`pdf`/`youtube`/`gdoc`/`text`), file_url, file_name, gemini_summary, uploaded_at, archived_at |
| `parent_notes` | id, kid_id, note, created_at |

---

## 5. Skills, Plugins & MCP Servers

Quinn is a complex multi-layered project. Install and configure all of these before any build session begins.

### 5.1 Existing Skills & Tools to Install

| Tool | Purpose |
|---|---|
| **frontend-design skill** | Guides Claude through purpose, tone, constraints, and differentiation before writing any UI code. Prevents generic AI-looking interfaces. Essential for Quinn's animated presence, chat interface, and parent dashboard. |
| **feature-dev skill** | Structured seven-phase workflow: requirements, codebase exploration, architecture, implementation, testing, review, documentation. Prevents jumping into code before the approach is fully thought through. |
| **Context7 MCP** | Delivers up-to-date version-specific library documentation into Claude Code sessions. Prevents hallucinated API parameters for Supabase, Claude API, and Gemini file API. |
| **Supabase MCP** | Gives Claude Code direct read/write access to the live Supabase project during development. Inspect schema, test queries, debug data issues without copy-pasting. |
| **Google Workspace CLI (gws)** | Unified MCP server for all Google Workspace APIs. Not required for v1 — install now for v2 Google Classroom integration readiness. `npm install -g @googleworkspace/cli` |
| **skill-creator** | Already in your skills folder. Use to build and iterate on all five custom Quinn skills below. |

### 5.2 Custom Skills to Build for Quinn

Build in this order before starting any development work.

| Priority | Skill | Purpose |
|---|---|---|
| **1** | `quinn-project` | Master context skill. Every Claude Code session loads this first. Full architecture, philosophy, decisions, schema, patterns. ✅ Built |
| **2** | `quinn-memory-schema` | Exact learner profile JSON structure, three-tier update rules, session summary format. Build before any Supabase code. |
| **3** | `quinn-prompt-engineer` | How to write and refine Quinn's system prompts. Voice per age group, tone evaluation, drift detection. Build before first system prompt. |
| **4** | `quinn-safety-review` | Pre-ship safety checklist for kids app context. Run before any conversation flow goes live. |
| **5** | `quinn-ui-patterns` | Quinn's UI conventions, visual presence states, chat patterns, dashboard layout. Build once first UI components are established. |

### 5.3 Recommended Build Order

1. Install `frontend-design` and `feature-dev` skills
2. Install Context7 MCP and Supabase MCP servers
3. Build `quinn-project` skill ✅
4. Build `quinn-memory-schema` before any Supabase schema or learner profile code
5. Build `quinn-prompt-engineer` before writing Quinn's first system prompt
6. Build `quinn-safety-review` before any conversation flow goes live
7. Build `quinn-ui-patterns` once first UI components are established
8. Install `gws` Google Workspace CLI for v2 readiness

---

## 6. Out of Scope — Version 1

Deliberately excluded from the initial build. May be revisited in v2.

- **Voice/audio output** — text only for v1, planned for v2 via ElevenLabs
- **Gamification / XP / points / badges** — different emotional register than Quest Academy
- **Direct Google Classroom API integration** — manual upload only for v1
- **Multiple AI companions per child** — one Quinn per child to start
- **Peer or social features** — Quinn is private and personal
- **Mobile app** — web-based only for v1
- **pgvector semantic search** — plain Supabase for Phase 1

---

## 7. Version 2 Roadmap

These features are intentionally deferred from v1. Documented here so v1 architectural decisions do not accidentally block them. Build v1 with these in mind.

### 7.1 Quinn Audio Lessons ⭐ Priority v2 Feature

Quinn generates personalized audio explanations of study material on demand — think NotebookLM's podcast feature but calibrated to the specific child, grounded in their actual class materials, and aware of what's coming up on their exam calendar.

**Why this is better than NotebookLM:** NotebookLM produces a static podcast between two generic AI hosts with no knowledge of who is listening. Quinn's audio is generated in Quinn's own voice, pitched to that child's level, connected to their interests, and focused on what they specifically need before their next exam. A friend explaining something out loud — not a podcast.

| Feature | Detail |
|---|---|
| **On-demand generation** | Kid says "Quinn, just talk me through photosynthesis before my test." Quinn generates an audio walkthrough on the fly, grounded in uploaded class materials, pitched at their level. |
| **Personalized per kid** | Mason gets high-energy with gaming analogies. Joie gets storytelling connected to animals. Bella gets a sophisticated breakdown. Same material, three completely different audio experiences. |
| **Exam-aware content** | Quinn knows the exam is in 3 days and adjusts what it covers. Knows Joie struggles with convection currents and spends extra time there. |
| **Interactive mode** | Optional: Quinn talks through the material and pauses to ask questions. Kid responds. Quinn reacts to their actual answer in real time. NotebookLM cannot do this at all. |
| **Quinn's voice** | Audio sounds like Quinn — the same personality the kid already trusts — not a generic TTS voice. Consistent character across text and audio sessions. |

### 7.2 Text-to-Speech API Options

| API | Role | Notes |
|---|---|---|
| **ElevenLabs** | Primary | Best voice quality and naturalness. Supports custom voice creation — Quinn could have a consistent recognizable voice. Free tier for development. Recommended for production. |
| **OpenAI TTS** | Fallback | Solid quality, simple API, low cost. Good option if ElevenLabs pricing becomes a concern at scale. |
| **Google Cloud TTS** | Fallback | Already in the Google ecosystem alongside Gemini. Competent quality, less personality than ElevenLabs. |

> **Architecture note for v1:** Generate Quinn's responses as text only, but structure the content pipeline so that text output can be passed directly to a TTS API in v2 without restructuring. The audio layer should be additive — not a rebuild.

### 7.3 Quinn Co-Watches — Interactive Video Learning ⭐ Priority v2 Feature

Quinn watches YouTube videos with the kid — pausing at key moments to ask questions, check understanding, and make connections to their interests before resuming. A friend who watches with you and says "wait, did that make sense?" is fundamentally different from watching alone.

**Why this matters:** Most educational video watching is passive. Kids zone out. Quinn makes it active and conversational without making it feel like work.

| Feature | Detail |
|---|---|
| **Video embedding** | YouTube video plays inside the Quinn interface via the YouTube iframe Player API. Full programmatic play, pause, seek, and timestamp tracking from JavaScript. |
| **Transcript processing** | YouTube auto-generates timestamped transcripts for almost every video. Quinn pulls the transcript before the session and maps content to timestamps — knowing exactly what was said at every moment. |
| **Pre-session analysis** | Before playback begins Quinn analyzes the transcript against the kid's learner profile and identifies pause points — concepts tied to upcoming exams, topics flagged as shaky, moments complex enough to warrant a check-in, and things that connect to that kid's interests. |
| **Personalized pause points** | Mason and Bella watching the same video get different pause points and different questions. The experience is calibrated to each kid's level, gaps, and interests. |
| **In-video check-ins** | At a pause point Quinn appears in chat with a question calibrated to that kid. Quinn reacts to their actual answer before resuming playback. |
| **Interest bridging** | Quinn makes connections between video content and each kid's interests at pause points. Joie gets a Pokemon analogy. Mason gets a Minecraft connection. |
| **Kid controls the experience** | Quinn asks permission before pausing: "I'll pause it a couple of times to check in — is that cool?" Offers a post-video conversation as an alternative for days the kid just wants to watch. |
| **Post-video debrief** | After the video Quinn summarizes what was covered, notes anything that seemed unclear, and connects it to upcoming exam material. |

**Tech stack for this feature:**

| Piece | Tool |
|---|---|
| Video embedding and control | YouTube iframe Player API (free) |
| Transcript and timestamps | YouTube Data API or `youtube-transcript` npm library |
| Pause point generation | Claude API — pre-processes transcript before session |
| Visual content understanding (v3) | Gemini video API — understands diagrams and animations on screen, not just audio |
| In-session conversation | Claude API — same as regular Quinn chat |

> **Architecture note for v1:** Add `source_type` field to `study_materials` table now (`pdf`, `youtube`, `gdoc`, `text`). This future-proofs the data model so the co-watching feature can be added in v2 without a schema change.

### 7.4 Other v2 Features

| Feature | Detail |
|---|---|
| **Google Classroom API** | Direct sync of assignments and materials via the gws CLI. Subject to school IT policy — manual upload remains the fallback. |
| **pgvector semantic search** | Upgrade session summaries with vector embeddings. Enables Quinn to semantically retrieve "times Joie struggled with ecosystems" rather than just the last N sessions. |
| **Mobile app / PWA** | Native iOS or PWA so kids can access Quinn from their phones. Audio lessons make this significantly more compelling — listen on the way to school. |
| **Quinn voice customization** | Let each kid pick or influence Quinn's voice during the meet and greet. Increases ownership and makes the relationship feel more personal. |

---

## 8. Open Questions

Resolve these before building the affected features.

| Question | Blocks |
|---|---|
| Quinn's visual design — specific look and feel | Any UI work on the main chat screen |
| Inactivity timeout duration | Session summary timing logic |
| Parent safety alert threshold and wording | Parent dashboard and safety system |
| First screen for returning users | App shell / routing |

---

## 10. Commercial Version — Future Consideration (Long Term)

> ⚠️ This section is for long-term thinking only. Build Quinn for your family first. Everything here is aspirational and should not influence v1 or v2 architectural decisions except where explicitly noted.

### 10.1 Distribution Options

| Path | Difficulty | Notes |
|---|---|---|
| **PWA (Progressive Web App)** | Easy | Add ~20 lines to existing HTML. Installs on iPhone, Android, and desktop like a native app. No App Store, no review, no 30% Apple cut. Right move for family use and early testing. |
| **Capacitor** | Medium | Wraps existing HTML app in a native shell for App Store and Google Play. Single codebase, legitimate native listing, access to native APIs (microphone for v2 voice). Best path if selling on app stores. |
| **React Native / Swift** | Hard | Full rewrite. Only justified if deep native features are required. Not recommended for Quinn. |

**MacBook Neo note:** <br>The MacBook Neo runs the A18 Pro — the same chip as the iPhone. Apps built for iPhone run natively on MacBook Neo via Apple's universal purchase model. An iPhone App Store listing automatically covers MacBook Neo users.

### 10.2 Memory & Storage Without a Shared Database

Selling Quinn on the App Store means you cannot require every user to write back to a Supabase instance you run and pay for. Options:

| Model | How It Works | Best For |
|---|---|---|
| **iCloud / CloudKit** | Learner profiles and session summaries stored in each user's own iCloud via Apple's CloudKit API. Free for users, zero infrastructure cost for you, syncs across family devices automatically, you never see their data. | iOS/macOS consumer app. Cleanest solution. |
| **BYOD Database** | Each family creates their own free Supabase project and enters credentials in Quinn settings. Their data, their account, your code. | Technical early adopters. Too much friction for mainstream. |
| **Subscription backend** | Managed Supabase covered by subscription revenue. Standard SaaS model — API costs justify the fee. | Full commercial product with paying users. |
| **Local LLM (long term)** | Learner profile lives on device. AI runs on device via Apple Intelligence or local models (Llama, Phi, Gemma). Nothing leaves the family's hardware. Gap vs. Claude quality is closing. | Maximum privacy, zero API cost per user. Not viable yet but watch this space. |

**Recommended path for commercial Quinn:** iCloud for storage + Capacitor for distribution + subscription for API cost coverage.

### 10.3 Pricing Model (Illustrative)

| Tier | Price | What's Included |
|---|---|---|
| **Free** | $0 | One child profile, limited conversations per month. Enough to experience Quinn — not enough to replace it. |
| **Family** | ~$7.99/month | Up to 4 child profiles, unlimited conversations, all v1 features. Audio lessons (v2) included. |
| **Family Annual** | ~$59.99/year | Same as Family, ~37% discount. Improves retention and cash flow predictability. |

Apple takes 30% of App Store subscriptions in year one, 15% after. Factor into pricing.

### 10.4 What Would Need to Change Architecturally

Very little — which is intentional. The v1 design already points toward this:

- Swap Supabase for CloudKit (or add CloudKit as an option alongside Supabase)
- Wrap HTML in Capacitor shell
- Add subscription gate in the app shell
- Add usage tracking per profile for free tier limits
- ElevenLabs audio is already planned for v2

Nothing in v1 needs to be rebuilt. It needs to be extended.

---

## 11. API Cost Projections at Scale

> These projections are based on current Claude API pricing as of March 2026. Prices will likely decrease over time — treat these as conservative worst-case estimates.

### 11.1 Current Claude API Pricing

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Best For |
|---|---|---|---|
| **Claude Sonnet 4.6** | $3.00 | $15.00 | Quinn live conversations — production target |
| **Claude Haiku 4.5** | $0.25 | $1.25 | **Currently used for live chat (dev cost savings)**; also summaries + profile updates |
| **Claude Opus 4.6** | $5.00 | $25.00 | Not needed for Quinn |

**Key cost optimizers:**
- **Prompt caching** — 90% savings on repeated content. Quinn's system prompt and learner profile load every conversation, making this extremely valuable. Cache reads cost 0.1x base input price.
- **Batch processing** — 50% discount for non-urgent workloads. Ideal for document ingestion and session summary writes.

### 11.2 Token Estimates Per Conversation

| Component | Tokens (est.) | Notes |
|---|---|---|
| System prompt | ~2,000 input | Quinn's personality, safety rules, exam context |
| Learner profile | ~1,000 input | Loaded fresh each conversation — prime caching candidate |
| Last 5 session summaries | ~2,500 input | Recent history context |
| Study material summary | ~1,500 input | Relevant subject material |
| Conversation (kid + Quinn) | ~3,000 input / ~2,000 output | Average 20-minute session |
| **Total per conversation** | **~10,000 input / ~2,000 output** | Before caching optimizations |

With prompt caching on static parts (system prompt + learner profile), subsequent conversations in the same day see ~60% cost reduction on cached tokens.

### 11.3 Cost Per Family Per Month

Assuming 3 kids, each having 4 conversations per week (~48 conversations/month total):

| Scenario | Conversations/month | Cost (no caching) | Cost (with caching) |
|---|---|---|---|
| **Your family (3 kids, 4x/week each)** | 48 | ~$2.30 | ~$0.90 |
| **Light use** (1 conv/kid/week) | 12 | ~$0.60 | ~$0.25 |
| **Heavy use** (daily, 3 kids) | 90 | ~$4.30 | ~$1.70 |

**Bottom line for personal use:** Projections above assumed caching working optimally and short sessions. Real-world observation: Sonnet 4.6 ran ~$3+/day with only one kid actively using the app during development. **Chat is temporarily switched to Haiku 4.5 to control dev costs** (~10x cheaper). Switch back to Sonnet 4.6 when all three kids are live and quality matters more than cost.

### 11.4 Cost at Commercial Scale

Using Sonnet 4.6 with prompt caching enabled, costs scale linearly and predictably:

| Families | Conversations/month | Monthly API Cost | Cost Per Family |
|---|---|---|---|
| 10 | 480 | ~$9 | $0.90 |
| 100 | 4,800 | ~$90 | $0.90 |
| 500 | 24,000 | ~$450 | $0.90 |
| 1,000 | 48,000 | ~$900 | $0.90 |
| 5,000 | 240,000 | ~$4,500 | $0.90 |
| 10,000 | 480,000 | ~$9,000 | $0.90 |

At ~$0.90/family/month in API costs, a $7.99/month subscription yields **~$7.09 gross margin per family** before Apple's 30% App Store cut, ElevenLabs costs (v2), and Supabase hosting. The economics are strong and improve as pricing continues to decline.

### 11.5 ElevenLabs TTS Cost (v2 Audio Lessons)

| Plan | Characters/month | Cost | Approx. audio |
|---|---|---|---|
| Free | 10,000 | $0 | ~10 min |
| Starter | 30,000 | $5/mo | ~30 min |
| Creator | 100,000 | $11/mo | ~100 min |
| Pro | 500,000 | $99/mo | ~500 min |

API rate: ~$0.30 per 1,000 characters. A 5-minute audio lesson ≈ 3,500 characters ≈ $1.05/lesson.

**Mitigation:** Cache generated audio files. If multiple kids or families listen to a "photosynthesis" lesson, generate it once and serve the file. Cost drops to near zero for popular topics.

### 11.6 Smart Model Routing Strategy

Don't use Sonnet for everything. Route tasks to the right model:

| Task | Model | Reason |
|---|---|---|
| Live Quinn conversation | Haiku 4.5 (dev) / Sonnet 4.6 (prod) | Haiku saves ~$3/day during dev; switch to Sonnet when all kids live |
| Session summary write | Haiku 4.5 | Structured task, quality not critical |
| Learner profile update | Haiku 4.5 | JSON update, deterministic |
| Document ingestion | Gemini file API | Better suited, separate cost |
| Pause point generation (v2) | Haiku 4.5 | Transcript analysis, not conversation |

Using Haiku for backend tasks and Sonnet only for live conversation reduces total API spend by approximately **30–40%**.

---

## 12. Success Criteria

- Each child opens Quinn voluntarily — not because they were told to
- Each child refers to Quinn by name in conversation with family
- Each child feels like Quinn knows them after a month of conversations
- Parents see measurable improvement in exam readiness based on dashboard signals
- No child feels like they are being tutored — they feel like they are talking to a friend
- Quinn handles emotional disclosures appropriately every time without exception

---

*Quinn — Built for Jason's family, March 2026*
