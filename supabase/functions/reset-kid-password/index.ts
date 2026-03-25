import { createClient } from "npm:@supabase/supabase-js@2";

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
    // Step 1: Parse and validate body
    const body = await req.json();
    const { kid_id, new_password }: { kid_id: string; new_password: string } =
      body;

    if (!kid_id || !new_password) {
      return new Response(
        JSON.stringify({ error: true, message: "kid_id and new_password are required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Validate password length
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Password must be at least 8 characters.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Extract JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: true, message: "Missing Authorization header." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Create user-scoped client and verify JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: true, message: "Invalid or expired token." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Verify caller is a parent
    const { data: callerProfile, error: profileError } = await supabaseUser
      .from("profiles")
      .select("is_parent")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile || !callerProfile.is_parent) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Only parents can reset kid passwords.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Confirm the kid belongs to this parent
    const { data: kidRow, error: kidError } = await supabaseUser
      .from("kids")
      .select("id")
      .eq("id", kid_id)
      .eq("parent_id", user.id)
      .single();

    if (kidError || !kidRow) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Kid not found or access denied.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 7: Look up the kid's auth user UUID from profiles
    const { data: kidProfile, error: kidProfileError } = await supabaseUser
      .from("profiles")
      .select("id")
      .eq("kid_id", kid_id)
      .single();

    if (kidProfileError || !kidProfile) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Kid auth account not found.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const kidAuthUserId: string = kidProfile.id;

    // Step 8: Create admin client
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Step 9: Reset the kid's password via admin API
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(kidAuthUserId, {
        password: new_password,
      });

    if (updateError) {
      console.error("Quinn reset-kid-password error:", updateError);
      return new Response(
        JSON.stringify({ error: true, message: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 10: Return success
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Quinn reset-kid-password error:", err);
    return new Response(
      JSON.stringify({ error: true, message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
