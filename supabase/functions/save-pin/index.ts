import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with the user's auth token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the user from the auth token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the request body
    const { position, parking_zone } = await req.json();

    if (!position || position.length !== 2) {
      return new Response(
        JSON.stringify({ error: "Invalid position format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cancel any existing active pins for this user
    await supabaseClient
      .from("pins")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "active");

    // Insert new pin
    const { data: pin, error: insertError } = await supabaseClient
      .from("pins")
      .insert({
        user_id: user.id,
        position: position,
        parking_zone: parking_zone,
        status: "active",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting pin:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save pin" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also update user's last_pin_location
    await supabaseClient
      .from("users")
      .update({
        last_pin_location: {
          id: pin.id,
          position: position,
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return new Response(JSON.stringify({ success: true, pin }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
