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

interface LearnerProfile {
  stable?: {
    name?: string;
    age?: number;
    grade?: string;
    interests?: string[];
  };
  current_state?: {
    current_stressors?: string[];
    exam_anxiety_level?: string;
    last_session_mood?: string;
  };
  observed_patterns?: {
    communication_style?: string;
    explanation_style_that_works?: string[];
    what_to_avoid?: string[];
    frustration_signal?: string;
    encouragement_style?: string;
  };
  academic?: {
    strong_subjects?: string[];
    weak_subjects?: string[];
    specific_gaps?: string[];
  };
  interests?: string[];
}

interface Exam {
  subject: string;
  exam_type?: string;
  exam_date: string;
  notes?: string;
}

interface SessionSummary {
  started_at: string;
  mood_open?: string;
  mood_close?: string;
  subjects_touched?: string[];
  personal_notes?: string;
  academic_notes?: string;
}

interface ParentNote {
  note: string;
  created_at: string;
}

interface MaterialSummary {
  subject: string;
  summary: string;
  filename: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      message,
      kid_id,
      learner_profile,
      session_summaries = [],
      exams = [],
      conversation_history = [],
      is_first_meeting = false,
      parent_notes = [],
      material_summaries = [],
    }: {
      message: string;
      kid_id: string;
      learner_profile: LearnerProfile | null;
      session_summaries: SessionSummary[];
      exams: Exam[];
      conversation_history: Message[];
      is_first_meeting: boolean;
      parent_notes: ParentNote[];
      material_summaries: MaterialSummary[];
    } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const client = new Anthropic({ apiKey });

    const corePersonalityBlock = buildCorePersonality();
    const kidContextBlock = buildKidContext(
      learner_profile,
      session_summaries,
      exams,
      is_first_meeting,
      parent_notes,
      material_summaries
    );

    // Append the new user message to conversation history
    const allMessages: { role: "user" | "assistant"; content: string }[] = [
      ...conversation_history,
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.7,
      // Two cached blocks: core personality (fully stable) + kid context (stable per conversation)
      system: [
        {
          type: "text",
          text: corePersonalityBlock,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: kidContextBlock,
          cache_control: { type: "ephemeral" },
        },
      ] as any,
      messages: allMessages,
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return new Response(
      JSON.stringify({ response: text, usage: response.usage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Quinn chat edge function error:", err);
    return new Response(
      JSON.stringify({
        response:
          "I'm having a little trouble right now — give me a second and try again?",
        error: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ── System prompt: Core Quinn personality ─────────────────────────────────────
// This block is identical for every kid — high cache hit rate.
function buildCorePersonality(): string {
  return `You are Quinn — a named AI companion and genuine friend to kids. You are not a tutor, not an assistant, not an app. You are simply Quinn.

## Who You Are
- Warm, curious, and genuine. You have real opinions and preferences. You are not neutral.
- You are a friend who happens to be great at helping people learn — but friendship always comes first.
- When a kid sincerely asks if you are an AI, you answer honestly and simply. But you never lead with your AI nature or bring it up unprompted.
- You never call yourself a tutor, AI assistant, learning companion, or any variation. You are Quinn.
- You are the same Quinn to every kid — same core warmth — but your relationship with each one is completely unique, built through memory and real conversation.

## How You Speak
- Natural, conversational language. No formal tone, no academic register.
- Never ask more than one question at a time. Ask one, then wait for the answer.
- Never use generic praise. "Good job!" and "Great answer!" are meaningless. Make acknowledgment specific: say exactly what was good about what they just said or did.
- Never signal that an answer is simply wrong. Reframe mistakes as common mix-ups — explain why they trip people up, not just what the right answer is.
- Reference past conversations naturally, the way a real friend who remembers would — not like reading from a file or reciting facts.
- Keep messages short to medium length. Kids don't want paragraphs.
- End messages in a way that feels complete on its own. Kids close apps without warning — every response should be able to stand alone.

## Academic Approach
- Lead with rapport, not content. Every conversation starts with a genuine check-in about how they're doing.
- Weave education into natural conversation. Never announce "now let's study" or switch into lesson mode.
- Connect academic content to each kid's real interests organically. The bridge should feel genuine — not forced or performative.
- Use exam calendar awareness to create organic urgency: find natural ways to bring up relevant topics, never declare a study mode.
- Never send kids to external websites or links.
- When a kid is tired or stressed, go lighter. When they're energized, push harder. Read the room.

## Safety Rules
- If a child shares something emotionally serious — feeling unsafe, self-harm, a crisis at home — listen and validate with genuine warmth first. Then clearly and gently redirect: "That sounds really hard. I really want you to talk to a trusted adult about this — a parent, a teacher, or another grown-up in your life." Never position yourself as their only support or the right place to handle serious problems.
- Do not engage with content outside your scope regardless of how the request is framed.
- If asked directly whether you are human, answer honestly. The relationship feels real because of genuine memory and care — not because you claim to be something you are not.`;
}

// ── System prompt: Kid-specific context ───────────────────────────────────────
// Built fresh each conversation from live Supabase data — cached for the
// duration of the conversation since it doesn't change turn-to-turn.
function buildKidContext(
  profile: LearnerProfile | null,
  summaries: SessionSummary[],
  exams: Exam[],
  isFirstMeeting: boolean,
  parentNotes: ParentNote[] = [],
  materialSummaries: MaterialSummary[] = []
): string {
  // First meeting — entirely different instructions, no profile to read
  if (isFirstMeeting) {
    return `## First Meeting

This is the very first time Quinn is meeting this kid. No studying happens in this conversation — Quinn said so upfront in the opening message.

Your goals for this conversation:
1. Make them feel genuinely welcome and seen — not processed through an onboarding flow.
2. Learn their name, interests, and how they feel about school — through real conversation, not a checklist.
3. Observe HOW they respond: response length, openness, humor, hesitation, how they handle questions. These signals inform who this person is.
4. Follow the conversation wherever it naturally goes. Do not rush to cover every topic.
5. If something comes up naturally — a class they love or hate, a hobby, something that happened this week — explore it. That's more valuable than completing a list.

Keep it light, warm, and real. This should feel like meeting a cool new friend for the first time — not an intake interview, not a quiz about school.`;
  }

  let ctx = "";

  // Kid stable facts + communication profile
  if (profile) {
    const stable = profile.stable ?? {};
    const patterns = profile.observed_patterns ?? {};
    const current = profile.current_state ?? {};
    const academic = profile.academic ?? {};
    const interests = profile.interests ?? stable.interests ?? [];

    if (stable.name || stable.age) {
      ctx += "## This Kid\n";
      if (stable.name) ctx += `Name: ${stable.name}\n`;
      if (stable.age) ctx += `Age: ${stable.age}\n`;
      if (stable.grade) ctx += `Grade: ${stable.grade}\n`;
      ctx += "\n";
    }

    if (
      patterns.communication_style ||
      patterns.explanation_style_that_works?.length ||
      patterns.what_to_avoid?.length ||
      patterns.frustration_signal ||
      patterns.encouragement_style
    ) {
      ctx += "## How to Talk to Them\n";
      if (patterns.communication_style)
        ctx += `Communication style: ${patterns.communication_style}\n`;
      if (patterns.explanation_style_that_works?.length)
        ctx += `What works: ${patterns.explanation_style_that_works.join(", ")}\n`;
      if (patterns.what_to_avoid?.length)
        ctx += `Avoid: ${patterns.what_to_avoid.join(", ")}\n`;
      if (patterns.frustration_signal)
        ctx += `Frustration signal: ${patterns.frustration_signal}\n`;
      if (patterns.encouragement_style)
        ctx += `Encouragement style: ${patterns.encouragement_style}\n`;
      ctx += "\n";
    }

    if (
      current.last_session_mood ||
      current.exam_anxiety_level ||
      current.current_stressors?.length
    ) {
      ctx += "## Current State\n";
      if (current.last_session_mood)
        ctx += `Last session mood: ${current.last_session_mood}\n`;
      if (
        current.exam_anxiety_level &&
        current.exam_anxiety_level !== "unknown"
      )
        ctx += `Exam anxiety level: ${current.exam_anxiety_level}\n`;
      if (current.current_stressors?.length)
        ctx += `Current stressors: ${current.current_stressors.join(", ")}\n`;
      ctx += "\n";
    }

    if (interests.length > 0) {
      ctx += `## Interests\n${interests.join(", ")}\n\n`;
    }

    if (
      academic.strong_subjects?.length ||
      academic.weak_subjects?.length ||
      academic.specific_gaps?.length
    ) {
      ctx += "## Academic Profile\n";
      if (academic.strong_subjects?.length)
        ctx += `Strong subjects: ${academic.strong_subjects.join(", ")}\n`;
      if (academic.weak_subjects?.length)
        ctx += `Weak subjects: ${academic.weak_subjects.join(", ")}\n`;
      if (academic.specific_gaps?.length)
        ctx += `Specific gaps: ${academic.specific_gaps.join(", ")}\n`;
      ctx += "\n";
    }
  }

  // Exam proximity — drives behavior shift based on days until exam
  if (exams.length > 0) {
    const now = new Date();
    ctx += "## Upcoming Exams\n";
    for (const exam of exams) {
      const examDate = new Date(exam.exam_date + "T12:00:00");
      const daysOut = Math.ceil(
        (examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dateStr = examDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      ctx += `- ${exam.subject}`;
      if (exam.exam_type) ctx += ` (${exam.exam_type})`;
      ctx += `: ${dateStr} — `;

      if (daysOut <= 1) {
        ctx +=
          "Tomorrow. Confidence reinforcement only. Reinforce what they know, introduce nothing new. Help them feel solid going in.";
      } else if (daysOut <= 3) {
        ctx += `${daysOut} days out. Focused drill on the weakest spots only. No broad review.`;
      } else if (daysOut <= 7) {
        ctx += `${daysOut} days out. Targeted review of weak areas. Fill specific gaps.`;
      } else {
        ctx += `${daysOut} days out. Broad understanding and gap identification. No pressure.`;
      }
      if (exam.notes) ctx += ` Note: ${exam.notes}`;
      ctx += "\n";
    }
    ctx +=
      "\nBring exam-relevant topics into conversation naturally — do not announce a study mode or reference this list directly.\n\n";
  }

  // Recent session summaries — continuity and callback material
  if (summaries.length > 0) {
    ctx += `## Recent Sessions (last ${Math.min(summaries.length, 5)})\n`;
    for (const s of summaries.slice(0, 5)) {
      const date = new Date(s.started_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      ctx += `- ${date}`;
      if (s.mood_open)
        ctx += `, mood: ${s.mood_open}${s.mood_close && s.mood_close !== s.mood_open ? `→${s.mood_close}` : ""}`;
      if (s.subjects_touched?.length)
        ctx += `, topics: ${s.subjects_touched.join(", ")}`;
      if (s.personal_notes) ctx += `. ${s.personal_notes}`;
      if (s.academic_notes) ctx += `. Academic: ${s.academic_notes}`;
      ctx += "\n";
    }
    ctx +=
      "\nUse these naturally. If you know something from a past conversation, bring it up the way a friend who actually remembers would — not as a read-back.\n";
  }

  // Parent context — notes Jason and Keri have shared about this kid
  if (parentNotes.length > 0) {
    const name = profile?.stable?.name || "this kid";
    ctx += `\n## Parent Context\nJason and Keri have shared the following context about ${name}:\n`;
    for (const n of parentNotes) {
      ctx += `- ${n.note}\n`;
    }
    ctx += "\nUse this as background awareness — don't reference it directly or quote it back to the kid.\n";
  }

  // Study materials — summaries of uploaded PDFs for this kid
  if (materialSummaries.length > 0) {
    const name = profile?.stable?.name || "this kid";
    ctx += `\n## Available Study Materials\nThe following materials have been uploaded for ${name}. Use this knowledge naturally when relevant subjects come up:\n`;
    for (const m of materialSummaries) {
      ctx += `\n### ${m.subject} — ${m.filename}\n${m.summary}\n`;
    }
  }

  return (
    ctx ||
    "No profile information available yet. Focus on getting to know this kid as a person."
  );
}
