# Quinn v2 Memory Architecture Spec

**Version:** 2.0-draft
**Date:** 2026-04-04
**Status:** Ready for implementation
**Author:** Engineering (Jason Rampersad)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema](#4-database-schema)
5. [Session Lifecycle](#5-session-lifecycle)
6. [Memory Retrieval Strategy](#6-memory-retrieval-strategy)
7. [System Prompt Design](#7-system-prompt-design)
8. [Privacy & Data Retention](#8-privacy--data-retention)
9. [Token Efficiency](#9-token-efficiency)
10. [Implementation Phases](#10-implementation-phases)
11. [Open Questions](#11-open-questions)
12. [Relation to Family OS](#12-relation-to-family-os)

---

## 1. Overview

Quinn is an AI learning companion for kids. It is deployed as a single HTML file on GitHub Pages, backed by Supabase (auth, data, Edge Functions) and the Claude API.

In v1, Quinn stores raw chat logs and loads the last N messages into every prompt. This approach has two compounding problems: it hits token limits quickly, and it loses older context that could be more relevant than recent messages. A child who mentioned they are dyslexic three weeks ago gets no acknowledgment of that fact after the chat log rolls off.

v2 replaces raw chat log injection with a **two-layer vector memory system** backed by Supabase pgvector. Instead of replaying history, Quinn carries forward a curated, structured understanding of each child — extracted from conversations after they end, retrieved semantically at the start of each new session.

The result: Quinn appears to genuinely know each child across sessions, using a fraction of the tokens, with better privacy properties than storing raw conversations.

---

## 2. Goals & Non-Goals

### Goals

- Replace raw chat log injection with structured, vector-retrieved memory context.
- Distinguish between two fundamentally different memory types: episodic (what happened) and semantic (persistent facts about the child).
- Extract memories automatically at session end using a Claude summarization call — no manual curation required.
- Keep raw chat logs for no more than 7 days, then delete them.
- Make the memory store readable and editable by parents.
- Improve token efficiency: ~200 tokens for injected memory vs potentially thousands for raw chat history.
- Design for COPPA-friendlier data handling by minimizing long-term storage of raw conversation data.

### Non-Goals

- Real-time memory updates during an active session (memory is updated at session end only, not message-by-message).
- Teaching Quinn to perform her own memory retrieval at runtime — Quinn is stateless; retrieval happens in the Edge Function before Claude is called.
- Full COPPA compliance certification in this phase (this spec improves the posture; legal review is separate).
- A general-purpose memory system for arbitrary AI agents — this is scoped to Quinn's specific needs and child profile model.
- Replacing the child profile table (`children`) — that table remains the source of truth for structured attributes like name, age, and accessibility flags.

---

## 3. Architecture Overview

### Key Principle

Quinn does not "check" memory herself. She is stateless — she only knows what is in the messages she receives. The Edge Function performs all memory retrieval before invoking Claude. Quinn appears to remember because the relevant context was already injected into her system prompt before she spoke. This distinction is critical for debugging and for understanding why memory behavior changes.

### Components

```
Browser (index.html)
    │
    │  POST /functions/v1/quinn-chat
    │  { child_id, message, session_id }
    │
    ▼
Supabase Edge Function: quinn-chat
    │
    ├─ 1. Embed child's message
    │       │
    │       ▼
    │  Embedding API (nomic-embed-text or OpenAI)
    │       │
    │       └─ returns vector[768]
    │
    ├─ 2. Query episodic memory
    │       └─ quinn_episodic_memory
    │          WHERE child_id = $1
    │          AND session_date >= NOW() - 30 days
    │          ORDER BY embedding <=> $query_vector
    │          LIMIT 5
    │
    ├─ 3. Query semantic memory
    │       └─ quinn_semantic_memory
    │          WHERE child_id = $1
    │          ORDER BY confidence DESC, confirmed_at DESC
    │          LIMIT 10
    │
    ├─ 4. Build system prompt
    │       └─ base Quinn personality
    │          + "What I remember about recent sessions with [name]:" (episodic)
    │          + "What I know about [name]:" (semantic)
    │
    ├─ 5. Call Claude API
    │       └─ system prompt + conversation messages
    │
    └─ 6. Return Claude's response to browser


Session End (triggered by browser or cron):
    │
    POST /functions/v1/quinn-memory-extract
    { child_id, session_id }
    │
    ▼
Supabase Edge Function: quinn-memory-extract
    │
    ├─ 1. Load raw chat log for session_id
    │
    ├─ 2. Call Claude with extraction prompt
    │       └─ returns JSON:
    │          {
    │            episodic: ["Bella worked on long division...", ...],
    │            semantic_updates: [
    │              { content: "Bella is dyslexic", reinforce: true },
    │              ...
    │            ]
    │          }
    │
    ├─ 3. Embed each extracted memory string
    │
    ├─ 4. Store episodic memories as new rows
    │
    ├─ 5. Upsert semantic memories
    │       ├─ Query existing memories for this child by semantic similarity
    │       ├─ If similar fact found (cosine distance < 0.15):
    │       │    UPDATE confidence += 1, confirmed_at = NOW()
    │       └─ If no similar fact found:
    │            INSERT new row (confidence = 1)
    │
    └─ 6. Schedule raw chat log deletion (7-day retention window)
```

---

## 4. Database Schema

### Prerequisites

```sql
-- Enable pgvector extension (run once per project)
CREATE EXTENSION IF NOT EXISTS vector;
```

### Table: quinn_episodic_memory

Stores what happened in past sessions. These are narrative summaries extracted from conversation — not raw messages.

```sql
CREATE TABLE quinn_episodic_memory (
    id          BIGSERIAL PRIMARY KEY,
    child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    embedding   VECTOR(768) NOT NULL,
    topic       TEXT,                            -- e.g. 'math', 'reading', 'science', 'social'
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX idx_episodic_embedding
    ON quinn_episodic_memory
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for child + date range queries
CREATE INDEX idx_episodic_child_date
    ON quinn_episodic_memory (child_id, session_date DESC);
```

**Field notes:**
- `content`: A plain-English sentence like "Bella worked on long division today and got frustrated when problems had remainders." Written to be readable by both the AI and a parent.
- `embedding`: 768-dimensional vector from nomic-embed-text (or equivalent). Must match the embedding model used at retrieval time.
- `topic`: Optional tag used for future filtering. Populate during extraction when the topic is clear; leave NULL otherwise.
- `session_date`: The calendar date the session occurred, not the timestamp. Used for recency filtering (30–60 day window).

### Table: quinn_semantic_memory

Stores persistent facts about the child. These do not expire — they gain confidence over time when reinforced.

```sql
CREATE TABLE quinn_semantic_memory (
    id           BIGSERIAL PRIMARY KEY,
    child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    embedding    VECTOR(768) NOT NULL,
    confidence   SMALLINT NOT NULL DEFAULT 1,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for vector similarity search (used during upsert deduplication)
CREATE INDEX idx_semantic_embedding
    ON quinn_semantic_memory
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for ranked retrieval (highest confidence + most recently confirmed first)
CREATE INDEX idx_semantic_child_confidence
    ON quinn_semantic_memory (child_id, confidence DESC, confirmed_at DESC);
```

**Field notes:**
- `content`: A plain-English fact like "Bella is dyslexic — use shorter paragraphs and bullet points" or "Liam is working on multiplication tables."
- `confidence`: Starts at 1. Incremented by 1 each time the same fact is observed again in a new session. A confidence of 5 means the same pattern has been seen across 5 separate sessions.
- `confirmed_at`: Updated to NOW() each time the fact is reinforced. Used to surface recently-confirmed facts above stale ones of equal confidence.
- `embedding`: Same 768-dimensional space as episodic memory. Used during extraction to detect near-duplicate facts before inserting a new row.

### Row-Level Security

Both tables need RLS policies to ensure a parent can only access their own children's memories.

```sql
ALTER TABLE quinn_episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE quinn_semantic_memory ENABLE ROW LEVEL SECURITY;

-- Parents can read memories for their children
CREATE POLICY "parent_read_episodic"
    ON quinn_episodic_memory FOR SELECT
    USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "parent_delete_episodic"
    ON quinn_episodic_memory FOR DELETE
    USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "parent_read_semantic"
    ON quinn_semantic_memory FOR SELECT
    USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "parent_delete_semantic"
    ON quinn_semantic_memory FOR DELETE
    USING (
        child_id IN (
            SELECT id FROM children WHERE parent_id = auth.uid()
        )
    );

-- Edge Functions use service role key — bypass RLS
-- (No additional policy needed; service role bypasses RLS by default)
```

### Retention: Raw Chat Logs

The existing chat log table (or messages table) should have a `delete_after` column added:

```sql
ALTER TABLE quinn_messages
    ADD COLUMN delete_after TIMESTAMPTZ
        GENERATED ALWAYS AS (created_at + INTERVAL '7 days') STORED;
```

A Supabase scheduled function or pg_cron job runs nightly to purge expired messages:

```sql
-- pg_cron job (run via Supabase dashboard or migration)
SELECT cron.schedule(
    'delete-expired-quinn-messages',
    '0 3 * * *',   -- 3 AM UTC daily
    $$DELETE FROM quinn_messages WHERE delete_after < NOW()$$
);
```

---

## 5. Session Lifecycle

### 5.1 Session Start

This logic lives in the `quinn-chat` Edge Function. It runs before every call to Claude.

**Step 1 — Embed the query.**

Embed the child's current message (or, on the very first message of a session, embed the session topic if known). This embedding is used to find semantically similar episodic memories.

```typescript
const queryEmbedding = await embedText(message); // returns number[768]
```

**Step 2 — Retrieve episodic memories.**

Query for recent memories that are also semantically relevant to the current message. Both conditions matter: a memory about multiplication from 45 days ago is less useful than one from last week, even if it's topically closer.

```typescript
const { data: episodicMemories } = await supabase.rpc('match_episodic_memories', {
  p_child_id: childId,
  p_query_embedding: queryEmbedding,
  p_match_threshold: 0.7,     // cosine similarity floor
  p_days_back: 30,             // only look at last 30 days
  p_match_count: 5,
});
```

The backing RPC function:

```sql
CREATE OR REPLACE FUNCTION match_episodic_memories(
    p_child_id       UUID,
    p_query_embedding VECTOR(768),
    p_match_threshold FLOAT,
    p_days_back       INT,
    p_match_count     INT
)
RETURNS TABLE (
    id           BIGINT,
    content      TEXT,
    topic        TEXT,
    session_date DATE,
    similarity   FLOAT
)
LANGUAGE sql STABLE AS $$
    SELECT
        id,
        content,
        topic,
        session_date,
        1 - (embedding <=> p_query_embedding) AS similarity
    FROM quinn_episodic_memory
    WHERE child_id = p_child_id
      AND session_date >= CURRENT_DATE - p_days_back
      AND 1 - (embedding <=> p_query_embedding) >= p_match_threshold
    ORDER BY similarity DESC
    LIMIT p_match_count;
$$;
```

**Step 3 — Retrieve semantic memories.**

Semantic memories are retrieved by confidence and recency — not by vector similarity. We want what Quinn knows most reliably about this child, regardless of today's topic.

```typescript
const { data: semanticMemories } = await supabase
  .from('quinn_semantic_memory')
  .select('content, confidence, confirmed_at')
  .eq('child_id', childId)
  .order('confidence', { ascending: false })
  .order('confirmed_at', { ascending: false })
  .limit(10);
```

**Step 4 — Build the system prompt.**

Inject both memory sets as labeled sections into Quinn's system prompt (see Section 7 for full prompt design).

**Step 5 — Call Claude.**

Pass the composed system prompt and the active conversation messages to Claude. The conversation window here is just the current session's messages — no cross-session history.

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: composedSystemPrompt,
  messages: sessionMessages,
});
```

**Step 6 — Store the raw message.**

Append the user message and Claude's response to the `quinn_messages` table with `session_id`. The `delete_after` column is computed automatically (created_at + 7 days).

---

### 5.2 Session End

Session end is triggered by one of two events:
- The browser fires a `beforeunload` or `visibilitychange` event (best-effort).
- A fallback: a Supabase scheduled job scans for sessions with no new messages in the last 2 hours and marks them ended.

This logic lives in a separate Edge Function: `quinn-memory-extract`.

**Step 1 — Load the raw session.**

```typescript
const { data: messages } = await supabase
  .from('quinn_messages')
  .select('role, content, created_at')
  .eq('session_id', sessionId)
  .order('created_at', { ascending: true });
```

**Step 2 — Build the extraction prompt and call Claude.**

```typescript
const extractionPrompt = `
You are a memory extractor for Quinn, an AI tutor for kids.

Below is a tutoring session transcript. Extract two types of memories:

1. EPISODIC: 1–5 sentences describing what specifically happened in this session.
   Focus on: topics covered, emotional moments, breakthroughs, difficulties.
   Write in past tense. Be specific — "Bella struggled with carrying in two-digit addition" not "math was hard."

2. SEMANTIC: Persistent facts about the child worth remembering forever.
   Include: learning style preferences, accessibility needs, interests, current curriculum progress.
   Only include facts that are clearly demonstrated, not guessed.
   If the same fact appeared before (check context), mark reinforce: true.

Return ONLY valid JSON. No commentary before or after.

Schema:
{
  "episodic": ["string", ...],
  "semantic_updates": [
    { "content": "string", "reinforce": boolean },
    ...
  ]
}

Transcript:
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
`;

const extraction = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: extractionPrompt }],
});

const extracted = JSON.parse(extraction.content[0].text);
// { episodic: [...], semantic_updates: [...] }
```

**Step 3 — Store episodic memories.**

Each episodic string gets embedded and inserted as a new row.

```typescript
for (const episodicContent of extracted.episodic) {
  const embedding = await embedText(episodicContent);
  await supabase.from('quinn_episodic_memory').insert({
    child_id: childId,
    content: episodicContent,
    embedding,
    session_date: new Date().toISOString().split('T')[0],
    topic: inferTopic(episodicContent), // optional light classifier
  });
}
```

**Step 4 — Upsert semantic memories.**

For each semantic update, check whether a similar fact already exists for this child. Use cosine similarity with a tight threshold (< 0.15 distance = > 0.85 similarity). If found, increment confidence and refresh `confirmed_at`. If not found, insert a new row.

```typescript
for (const update of extracted.semantic_updates) {
  const embedding = await embedText(update.content);

  // Check for near-duplicate
  const { data: existing } = await supabase.rpc('find_similar_semantic_memory', {
    p_child_id: childId,
    p_embedding: embedding,
    p_threshold: 0.85,  // cosine similarity
    p_limit: 1,
  });

  if (existing && existing.length > 0) {
    // Reinforce existing memory
    await supabase
      .from('quinn_semantic_memory')
      .update({
        confidence: existing[0].confidence + 1,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', existing[0].id);
  } else {
    // Insert new memory
    await supabase.from('quinn_semantic_memory').insert({
      child_id: childId,
      content: update.content,
      embedding,
      confidence: 1,
    });
  }
}
```

The backing RPC for similarity lookup:

```sql
CREATE OR REPLACE FUNCTION find_similar_semantic_memory(
    p_child_id  UUID,
    p_embedding VECTOR(768),
    p_threshold FLOAT,
    p_limit     INT
)
RETURNS TABLE (
    id         BIGINT,
    content    TEXT,
    confidence SMALLINT,
    similarity FLOAT
)
LANGUAGE sql STABLE AS $$
    SELECT
        id,
        content,
        confidence,
        1 - (embedding <=> p_embedding) AS similarity
    FROM quinn_semantic_memory
    WHERE child_id = p_child_id
      AND 1 - (embedding <=> p_embedding) >= p_threshold
    ORDER BY similarity DESC
    LIMIT p_limit;
$$;
```

**Step 5 — Raw messages are left for the retention job.**

Do not delete them here. The pg_cron job handles deletion on its 7-day schedule. This means messages from a just-ended session are still available for debugging within the audit window.

---

## 6. Memory Retrieval Strategy

### Two Approaches

**Passive retrieval (Phase 1):**
Run memory queries on every incoming message. Always inject the top N memories into the system prompt regardless of whether the current message seems memory-relevant.

- Pros: Simple. No risk of missing a relevant memory. Easy to reason about.
- Cons: Slightly wasteful on topics where no memory is needed (e.g., a child asking a purely factual question).
- Verdict: Correct starting point. Implement this first.

**Active retrieval (Phase 2):**
Classify the incoming message before running memory queries. Only retrieve memory when the message is memory-relevant.

Trigger conditions (check for any):
1. Keywords: "remember", "last time", "before", "we did", "you told me", "do you know", "what did we"
2. Continuation signals: "can we keep going", "where were we", "I've been working on"
3. A lightweight Claude classification call (adds ~50ms latency but higher precision):

```typescript
const isMemoryRelevant = await classifyMemoryRelevance(message);
// Prompt: "Does this message suggest the child expects Quinn to recall
//          something from a previous session? Answer YES or NO only."
//          Message: {message}
```

- Pros: Lower token usage at scale. Avoids irrelevant memory injection.
- Cons: Adds complexity and a second API call (or keyword maintenance burden).
- Verdict: Implement in Phase 2 after validating that passive retrieval works correctly.

### Similarity Thresholds

| Use case | Metric | Threshold |
|---|---|---|
| Episodic retrieval | Cosine similarity | >= 0.70 |
| Semantic deduplication (upsert) | Cosine similarity | >= 0.85 |

The episodic threshold is looser because we want topically related memories even if the phrasing differs. The semantic deduplication threshold is tighter because we only want to merge facts that are genuinely describing the same thing.

These values are starting points. Tune them after observing real extraction output.

---

## 7. System Prompt Design

### Requirements for Quinn's Prompt

The base system prompt must explicitly instruct Quinn to:
1. Use memories naturally, in first person — "I remember..." not "According to my records..." or "My data indicates..."
2. Reference past sessions when relevant, but not force it into every response.
3. Handle missing memory gracefully with a warm, encouraging fallback.
4. Not fabricate memories — if she does not know something, say so.

### Memory Injection Format

Memory is injected as two labeled sections between the base personality block and the conversation. Each section uses plain-English framing that Quinn can naturally echo.

```
[BASE QUINN PERSONALITY BLOCK]
...

---

What I remember about recent sessions with Bella:
- Bella worked on long division last Thursday and got frustrated when problems had remainders. We slowed down and worked through two examples step by step, which helped.
- Bella has been enjoying story-based math problems more than drill problems.

---

What I know about Bella:
- Bella is dyslexic — use shorter paragraphs, bullet points, and avoid walls of text.
- Bella prefers story-based explanations over abstract rules.
- Bella is currently working on long division in her math curriculum.
- Bella gets encouraged by noticing her own progress — say things like "You figured that out faster than last time."

---

[CONVERSATION BEGINS]
```

### Fallback When No Memory Exists

Include this instruction in the base prompt:

```
If you don't have any memory of previous sessions with this child yet, or if
they ask about something you haven't encountered before, respond warmly:
"I don't think we've talked about that before — tell me what you remember
and we can explore it together!"

Never pretend to remember something you don't. It's better to discover
something together than to fake familiarity.
```

### Composing the Prompt in Code

```typescript
function buildSystemPrompt(
  childName: string,
  basePersonality: string,
  episodicMemories: EpisodicMemory[],
  semanticMemories: SemanticMemory[]
): string {
  const episodicSection = episodicMemories.length > 0
    ? `What I remember about recent sessions with ${childName}:\n` +
      episodicMemories.map(m => `- ${m.content}`).join('\n')
    : `I haven't worked with ${childName} before — this is our first session!`;

  const semanticSection = semanticMemories.length > 0
    ? `What I know about ${childName}:\n` +
      semanticMemories.map(m => `- ${m.content}`).join('\n')
    : '';

  return [
    basePersonality,
    '---',
    episodicSection,
    semanticSection.length > 0 ? '---\n' + semanticSection : '',
  ].filter(Boolean).join('\n\n');
}
```

---

## 8. Privacy & Data Retention

### Data Lifecycle

| Data type | Retention | Notes |
|---|---|---|
| Raw chat messages (`quinn_messages`) | 7 days | Deleted by pg_cron job. Exists for debugging/support window only. |
| Episodic memories | 60-day rolling window | Session date >= NOW() - 60 days at query time. Old rows can be physically deleted by a separate cron. |
| Semantic memories | Permanent | These are facts about the child, not session transcripts. They persist until a parent deletes them. |
| Child profile (`children` table) | Until parent deletes account | Unchanged from v1. |

### Parent Access

Parents must be able to:
1. **View** all memories associated with their child — both episodic (recent sessions summary) and semantic (what Quinn knows).
2. **Delete individual memories** — any row can be deleted. This is supported by the RLS delete policies defined in Section 4.
3. **See when a memory was created and how confident Quinn is** — expose `created_at`, `session_date`, and `confidence` in the parent-facing UI.

Implementation note: this is a Phase 3 UI feature, but the data model supports it from day one. The RLS policies are required in Phase 1.

### COPPA Posture

This architecture improves COPPA posture relative to v1 in two ways:
1. Raw conversations (which may contain personally identifiable information beyond what's intended) are deleted after 7 days rather than stored indefinitely.
2. The retained data (extracted memories) is structured, minimal, and directly reviewable by parents.

This does not constitute COPPA compliance — that requires a full legal review, privacy policy updates, and parental consent flows. This spec improves the technical data minimization posture.

### Security

- Supabase service role key is only used inside Edge Functions, never in client-side code.
- Anon key is safe for client use; it is subject to RLS.
- Embedding API keys (OpenAI or equivalent) are stored as Supabase secrets and accessed only within Edge Functions.
- All memory read/write operations from client code go through Edge Functions — the client never queries `quinn_episodic_memory` or `quinn_semantic_memory` directly (except for the parent UI in Phase 3, which uses the authed Supabase client with RLS).

---

## 9. Token Efficiency

### v1 Behavior

The v1 approach loads the last N raw messages into every prompt. Each message pair (user + Quinn) averages ~150–300 tokens. Loading 20 messages = 3,000–6,000 tokens of context every call. As a session grows longer, the context window fills and earlier messages — which might contain the most important background — get pushed out first.

The result is a system that loses context by recency, not by relevance.

### v2 Behavior

| Memory type | Token estimate | Source |
|---|---|---|
| 5 episodic memories (1 sentence each) | ~100–150 tokens | Extracted from past sessions |
| 10 semantic memories (1 sentence each) | ~100–200 tokens | Persistent facts |
| Total memory context | ~200–350 tokens | Stable regardless of session count |

The memory context is stable. After 100 sessions, the injected context is the same size as after 1 session, because retrieval is bounded by `LIMIT` and ranked by relevance/confidence — not by total volume.

### Current Session Messages

The current session's raw messages are still included in the Claude call (as the `messages` array, not the system prompt). This window covers only the active session, not cross-session history. A typical session is 10–30 message pairs, which is well within Claude's context window even for long sessions.

### Summary

| | v1 | v2 |
|---|---|---|
| Cross-session context | Last N raw messages | Curated memory (bounded) |
| Context growth over time | Unbounded | Stable |
| Relevance of retrieved context | Recency-ordered | Relevance + confidence ordered |
| Token cost for cross-session context | 3,000–6,000+ tokens | ~200–350 tokens |

---

## 10. Implementation Phases

### Phase 1: Foundation (Passive Retrieval + Basic Schema)

**Goal:** Get memories stored, retrieved, and injected. No UI. No active retrieval. Prove the loop works end to end.

**Tasks:**
1. Add pgvector extension to Supabase project.
2. Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_vector_memory.sql`
   - `quinn_episodic_memory` table
   - `quinn_semantic_memory` table
   - IVFFlat indexes
   - RLS policies (read + delete for parents)
   - `match_episodic_memories` RPC
   - `find_similar_semantic_memory` RPC
3. Add `delete_after` column to `quinn_messages`. Add pg_cron job for 7-day deletion.
4. Choose embedding API for Edge Functions (recommendation: Supabase's built-in Inference API if available in the project tier; otherwise OpenAI `text-embedding-3-small` with `dimensions: 768`).
5. Update `quinn-chat` Edge Function:
   - Add `embedText()` helper
   - Add `retrieveEpisodicMemories()` and `retrieveSemanticMemories()` helpers
   - Update `buildSystemPrompt()` to inject both memory sections
6. Create new Edge Function: `quinn-memory-extract`
   - Load session messages
   - Call Claude with extraction prompt
   - Embed and store episodic rows
   - Upsert semantic rows (similarity check → increment confidence or insert)
7. Wire session-end trigger in the browser (`beforeunload` / `visibilitychange`) to POST to `quinn-memory-extract`.
8. Add fallback: a Supabase scheduled function that calls `quinn-memory-extract` for sessions idle > 2 hours.

**Definition of done:**
- A child completes a session. `quinn-memory-extract` runs. Rows appear in both memory tables.
- The next session loads those memories and they appear in Quinn's first response where appropriate.
- Parent can query `quinn_semantic_memory` filtered by `child_id` and see the extracted facts.

---

### Phase 2: Active Retrieval + Confidence System

**Goal:** Reduce unnecessary embedding calls. Validate the confidence system is producing meaningful signal.

**Tasks:**
1. Add keyword-based memory relevance classification to `quinn-chat`:
   - Check incoming message for trigger phrases: `["remember", "last time", "before", "we did", "you told me", "where were we", "keep going"]`
   - If none match, skip episodic retrieval (still inject semantic memories — they are always relevant).
2. Monitor confidence values across production data. After ~4 weeks of real sessions, verify that:
   - High-confidence semantic facts are accurate and not overly duplicated.
   - The deduplication threshold (0.85) is not merging distinct facts incorrectly.
3. Tune the episodic recency window if needed (may extend to 60 days based on observed usage patterns).
4. Consider replacing keyword classification with a lightweight Claude call if keyword matching misses important cases.
5. Add episodic memory cleanup cron job (delete rows where `session_date < NOW() - 60 days`).

---

### Phase 3: Parent-Facing Memory UI

**Goal:** Give parents visibility into what Quinn knows about their child. Let them delete individual memories.

**Tasks:**
1. Add a "Memory" tab or section to the parent dashboard in Quinn's UI.
2. Display semantic memories in a card layout:
   - Content of the memory
   - Confidence level (shown as a strength indicator, e.g. "Observed 4 times")
   - Last confirmed date
   - Delete button
3. Display recent episodic memories grouped by session date.
4. Connect delete actions to the Supabase RLS delete policy (authed client, `child_id` filter).
5. Add a notice on the parent dashboard explaining what these memories are and how they are used.
6. Write a brief privacy disclosure for the app's information page (not stored in code — copy for the HTML page).

---

## 11. Open Questions

**Q1: Which embedding API for production?**
The spec recommends 768-dimensional embeddings to match `nomic-embed-text`. Supabase has a built-in inference endpoint (`gte-small`) but it uses 384 dimensions. Using OpenAI `text-embedding-3-small` with `dimensions: 768` is the cleanest path if Supabase's endpoint dimension doesn't match. This must be decided before Phase 1 is deployed — changing embedding dimensions later requires re-embedding all existing rows.

**Q2: Session ID tracking.**
The memory extraction step requires a `session_id` to load the right messages. Confirm the current schema has a `session_id` column on `quinn_messages` and that the browser passes a consistent UUID per session. If not, add it in the Phase 1 migration.

**Q3: Extraction call cost and latency.**
Each session end triggers a Claude API call to extract memories. At low usage this is negligible. If Quinn scales to many concurrent users, this could add up. Monitor cost per session after Phase 1. If extraction calls become a meaningful cost driver, consider batching sessions for extraction.

**Q4: What happens if memory extraction fails?**
The raw messages are retained for 7 days. If `quinn-memory-extract` fails, memories for that session are simply not stored — not a data loss event for the session itself. Add error logging to the Edge Function. Consider a retry mechanism (e.g., the idle-session cron could retry failed extractions once before giving up).

**Q5: Episodic memory recency window.**
30 days is the starting default. Some children may use Quinn intermittently (summer programs, tutoring blocks). 60 days may be more appropriate for episodic retrieval. Tune after observing actual session frequency patterns in Phase 1.

**Q6: Multi-child sessions.**
Currently the memory system is scoped strictly to `child_id`. If a sibling uses a shared device, ensure the active child's profile (and therefore `child_id`) is correctly set at session start. No spec changes needed — this is an existing UX requirement, but worth confirming.

**Q7: Topic inference.**
The `topic` field on `quinn_episodic_memory` is optional but could be useful for filtering memories to the most relevant subject area (e.g., only show math memories for a math session). A lightweight classifier using keyword matching or a short Claude prompt could populate this. Defer to Phase 2.

---

## 12. Relation to Family OS

Quinn will eventually be integrated as a module within Family OS — a unified family app being built in React + Next.js. When that migration happens, the memory system in this spec is fully portable. The design was made with that future in mind.

### What transfers directly

| Component | Status |
|---|---|
| `quinn_episodic_memory` table | Portable — same schema, same RLS pattern |
| `quinn_semantic_memory` table | Portable — same schema, same RLS pattern |
| `quinn-memory-extract` Edge Function | Portable — no Quinn-specific coupling beyond the extraction prompt |
| `match_episodic_memories` and `find_similar_semantic_memory` RPCs | Portable — pure SQL, no app-layer assumptions |

### What changes in Family OS context

- **API proxy:** Currently Quinn calls Claude through a standalone Supabase Edge Function. In Family OS, the API proxy architecture may change (centralized Edge Function for all modules, or module-specific functions). The memory retrieval and injection logic remains the same — only the routing changes.
- **Auth:** Family OS uses role-based auth with parent/child/admin roles. The RLS policies in this spec assume the same pattern (`children.parent_id = auth.uid()`), which should align with Family OS's auth model.
- **Child profile:** Family OS has its own `children` table design. Confirm the `child_id` FK references the correct table when porting. The memory tables reference `children(id)` — that relationship must remain intact.

### Pattern applicability

The two-layer memory pattern (episodic + semantic, extract at session end, inject at session start) is a reusable architecture for any AI module in Family OS that maintains a persistent relationship with a family member. The same pattern could apply to a future "homework coach" or "bedtime story" module with minimal adaptation.
