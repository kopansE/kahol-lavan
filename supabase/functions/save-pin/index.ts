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
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  try {
    console.log("🔍 Edge Function: save-pin started");
    // Get the Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    if (!authHeader) {
      console.error("❌ No Authorization header");
      return new Response(
        JSON.stringify({
          error: "No authorization header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Create Supabase client - use service role to bypass RLS for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    // Create a client with user's token to verify the user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    console.log("Verifying user token...");
    // Get user from JWT token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    console.log("User lookup result:", {
      user: !!user,
      error: userError,
    });
    if (userError) {
      console.error("❌ User error:", userError);
      return new Response(
        JSON.stringify({
          error: userError.message,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    if (!user) {
      console.error("❌ No user found");
      return new Response(
        JSON.stringify({
          error: "User not found",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    console.log("✅ User authenticated:", user.id);
    // Get the request body
    const { position, parking_zone, address } = await req.json();
    console.log("Request body:", {
      position,
      parking_zone,
      address,
    });
    if (!position || position.length !== 2) {
      return new Response(
        JSON.stringify({
          error: "Invalid position format",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Use admin client for database operations to bypass RLS
    console.log("Cancelling existing pins...");
    const { error: cancelError } = await supabaseAdmin
      .from("pins")
      .update({
        status: "cancelled",
      })
      .eq("user_id", user.id)
      .eq("status", "active");
    if (cancelError) {
      console.error("Error cancelling pins:", cancelError);
    }
    // Insert new pin
    console.log("Inserting new pin...");
    const { data: pin, error: insertError } = await supabaseAdmin
      .from("pins")
      .insert({
        user_id: user.id,
        position: position,
        parking_zone: parking_zone,
        status: "active",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (insertError) {
      console.error("❌ Error inserting pin:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to save pin",
          details: insertError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    console.log("✅ Pin inserted:", pin.id);
    // Update user's current_pin_id to reference this new pin
    console.log("Updating user record...");
    const { error: updateUserError } = await supabaseAdmin
      .from("users")
      .update({
        current_pin_id: pin.id,
        last_pin_location: {
          id: pin.id,
          position: position,
          address: address,
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (updateUserError) {
      console.error("⚠️ Error updating user (non-critical):", updateUserError);
    } else {
      console.log("✅ User record updated");
    }
    console.log("✅ Save pin complete!");
    return new Response(
      JSON.stringify({
        success: true,
        pin,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
