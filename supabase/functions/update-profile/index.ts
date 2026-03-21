import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      kid_id,
      current_profile,
      session_summary,
    }: {
      kid_id: string;
      current_profile: object | null;
      session_summary: object;
    } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const client = new Anthropic({ apiKey });

    const prompt = `You are updating a child's learner profile for Quinn (an AI learning companion) based on evidence from a completed session.

## Current Learner Profile
${JSON.stringify(current_profile, null, 2)}

## Session Summary (evidence for this update)
${JSON.stringify(session_summary, null, 2)}

## Three-Tier Update Rules

### Tier 1: stable
Only update if a concrete FACT has changed — age, grade, a name preference the kid explicitly stated. Do not update stable fields based on mood, behavior, or single-session observations. These are long-lived facts.
- Fields: name, age, grade, dyslexia_font, and similar fixed biographical facts.

### Tier 2: current_state
Always update from session evidence:
- last_session_mood: set to session_summary.mood_close
- recent_subjects: update to reflect what was touched this session (from subjects_touched)
- current_stressors: update based on session evidence; can clear if stressors seem resolved
- exam_anxiety_level: update only if session gave clear evidence; otherwise preserve existing value
- last_active: set to today's date (YYYY-MM-DD format)

### Tier 3: observed_patterns
Only add or update a pattern if it has been confirmed at least 2 times. One data point is NOT a pattern.
- If new session evidence aligns with an existing pattern, that confirms it — keep it as-is or strengthen wording.
- If new session evidence contradicts an existing pattern, append a note to communication_notes (e.g. "Note: on [date] opposite behavior observed — watching for more data") but do NOT overwrite the pattern. Wait for 2 more confirming sessions before changing.
- If you are tempted to add a new pattern based solely on this one session, do not. Wait for repetition.
- Fields: communication_style, explanation_style_that_works, what_to_avoid, frustration_signal, encouragement_style.

### Tier 4: academic
- strong_subjects: only add a subject if confirmed strong across multiple sessions or via very clear mastery evidence
- weak_subjects: update if session gave clear evidence of persistent struggle (not just one confused moment)
- specific_gaps: update with new specific gaps identified this session; also remove gaps that appear to be mastered now
- mastered_recently: add any specific skills or concepts the kid demonstrated solid mastery of this session

### Tier 5: interests
- Accumulate. Add new interests mentioned in session_summary.personal_notes or conversation.
- Never remove an interest unless the kid explicitly said they are no longer interested in it.

Return ONLY the updated profile JSON — no explanation, no markdown wrapper, no code block. Return the raw JSON object with the same top-level structure as the input profile. Do not add new top-level keys that weren't in the input.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";

    let updatedProfile: object;
    try {
      updatedProfile = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        updatedProfile = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse updated profile JSON");
      }
    }

    return new Response(JSON.stringify({ profile: updatedProfile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Quinn update-profile edge function error:", err);
    return new Response(
      JSON.stringify({ error: true, message: "Profile update failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
