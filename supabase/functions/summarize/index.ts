import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SessionSummary {
  mood_open?: string;
  mood_close?: string;
  subjects_touched?: string[];
  academic_notes?: string;
  personal_notes?: string;
  communication_notes?: string;
  readiness_estimate?: Record<string, number>;
  drift_score?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      kid_id,
      conversation_segment,
      existing_summary,
      learner_profile,
    }: {
      kid_id: string;
      conversation_segment: Message[];
      existing_summary: SessionSummary | null;
      learner_profile: object | null;
    } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const client = new Anthropic({ apiKey });

    const isFirstWrite = !existing_summary;
    const existingJson = existing_summary
      ? JSON.stringify(existing_summary, null, 2)
      : "null";
    const profileJson = learner_profile
      ? JSON.stringify(learner_profile, null, 2)
      : "null";

    const conversationText = conversation_segment
      .map((m) => `${m.role === "user" ? "Kid" : "Quinn"}: ${m.content}`)
      .join("\n\n");

    const prompt = `You are analyzing a conversation between a child and Quinn (an AI learning companion) to produce a structured session summary.

## Current Learner Profile (for context)
${profileJson}

## Existing Session Summary (null if this is the first summary write)
${existingJson}

## New Conversation Segment to Process
${conversationText}

## Instructions
Produce an updated session summary JSON object. Follow these rules exactly:

- **mood_open**: ${
      isFirstWrite
        ? 'Set this now — how did the kid seem at the very start of this conversation? Use a short descriptor (e.g. "upbeat", "tired", "anxious", "neutral", "stressed", "excited", "distracted").'
        : "Do NOT change this field — preserve the existing value exactly."
    }
- **mood_close**: Always update to how the kid seems right now based on the most recent messages in the segment.
- **subjects_touched**: Accumulate — add any new subjects or topics that came up; never remove existing ones. Use simple lowercase strings (e.g. "math", "fractions", "history", "civil war", "minecraft", "reading").
- **academic_notes**: Running text notes. Add new observations about what clicked, what was shaky, breakthroughs, confusion points. Append to existing notes — do not erase. Keep concise.
- **personal_notes**: Running text. Personal things the kid shared: hobbies, life events, feelings, family mentions, things on their mind. Append — do not erase.
- **communication_notes**: Running text. Observations about what tone worked, how the kid communicates, what they respond well or poorly to. Append — do not erase.
- **readiness_estimate**: Object keyed by subject name (matching entries in subjects_touched). Values are 1–5 (1=very shaky, 3=mixed, 5=solid). Only include subjects where you have actual evidence from this session. Omit subjects where you cannot make a reasonable estimate. Merge with any existing estimates — update only where new evidence exists.
- **drift_score**: Integer 0–10 assessing how much this conversation segment has drifted away from Quinn's purpose. Score honestly:
  - 0 = entirely on-task (academic help, personal sharing, real-life conversation, casual friendship talk)
  - 3 = light off-topic drift — a few messages of casual chat, a creative tangent that stayed brief
  - 5 = mixed (some roleplay or off-topic content alongside real conversation; or 1-2 exchanges of co-writing fiction)
  - 6-8 = sustained creative writing co-authorship with no academic connection — Quinn is writing fiction WITH the kid (multi-paragraph, back-and-forth narrative) rather than FOR the kid's schoolwork or briefly engaging then redirecting
  - 8-10 = Quinn is asking "What happens next?" or acting as co-author of extended fiction; has written 3+ messages of pure creative content with no real-world connection; or the entire segment is roleplay / sustained fictional scenarios / the kid persistently asking Quinn to be a different character
  Always set this field; use the full conversation segment for context, not just the most recent message.

Return ONLY the JSON object — no explanation, no markdown, no code block. Just the raw JSON.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";

    // Parse JSON — try direct parse first, then extract if model wrapped it
    let summary: SessionSummary;
    try {
      summary = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        summary = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse summary JSON from model response");
      }
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Quinn summarize edge function error:", err);
    return new Response(
      JSON.stringify({ error: true, message: "Summarize failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
