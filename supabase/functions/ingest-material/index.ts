import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LearnerProfile {
  stable?: {
    name?: string;
    age?: number;
    grade?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      kid_id,
      subject,
      pdf_base64,
      filename,
      learner_profile,
    }: {
      kid_id: string;
      subject: string;
      pdf_base64: string;
      filename: string;
      learner_profile: LearnerProfile | null;
    } = body;

    if (!pdf_base64 || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: pdf_base64, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const client = new Anthropic({ apiKey });

    const name = learner_profile?.stable?.name || "this student";
    const age = learner_profile?.stable?.age ?? "unknown age";
    const grade = learner_profile?.stable?.grade || "an unknown grade";

    const prompt = `You are processing a study material for ${name}, a ${age}-year-old in grade ${grade}. Extract the key concepts, important definitions, formulas, and likely exam topics from this document. Structure your output as: Overview (2-3 sentences), Key Concepts (bullet list), Important Details (bullet list), Likely Exam Topics (bullet list). Be concise — this summary will be injected into an AI tutor's context window.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf_base64,
              },
            } as any,
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const summary =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ingest-material error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to process document", summary: null }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
