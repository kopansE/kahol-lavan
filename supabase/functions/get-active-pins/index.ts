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
    console.log("🔍 Edge Function: get-active-pins started");
    // Create Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    // Get the user (optional - to exclude their own pins)
    let userId = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser(token);
      if (!userError && user) {
        userId = user.id;
        console.log("✅ User authenticated:", userId);
      }
    }
    // Get query parameters
    const url = new URL(req.url);
    const parking_zone = url.searchParams.get("parking_zone");
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    const radius = url.searchParams.get("radius") || "5"; // default 5km radius
    console.log("Query params:", {
      parking_zone,
      lat,
      lng,
      radius,
    });
    // Build query - use admin client to bypass RLS
    let query = supabaseAdmin
      .from("pins")
      .select(
        `
        id,
        position,
        parking_zone,
        created_at,
        expires_at,
        price,
        users!pins_user_id_fkey (
          email,
          full_name,
          avatar_url
        )
      `
      )
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString()); // Only get non-expired pins
    // Exclude user's own pins if logged in
    if (userId) {
      query = query.neq("user_id", userId);
    }
    // Filter by parking zone if provided
    if (parking_zone) {
      query = query.eq("parking_zone", parseInt(parking_zone));
    }
    const { data: pins, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) {
      console.error("❌ Error fetching pins:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch pins",
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
    console.log(`✅ Found ${pins?.length || 0} pins`);
    // If lat/lng provided, filter by distance
    let filteredPins = pins || [];
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxRadius = parseFloat(radius);
      filteredPins = pins.filter((pin) => {
        if (!pin.position || !Array.isArray(pin.position)) return false;
        const [pinLat, pinLng] = pin.position;
        const distance = calculateDistance(userLat, userLng, pinLat, pinLng);
        return distance <= maxRadius;
      });
      console.log(
        `✅ Filtered to ${filteredPins.length} pins within ${maxRadius}km`
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        pins: filteredPins,
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
        error: error.message,
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
// Calculate distance between two points using Haversine formula (in km)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
