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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the user (optional - to exclude their own pins)
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // Get query parameters
    const url = new URL(req.url);
    const parking_zone = url.searchParams.get("parking_zone");
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    const radius = url.searchParams.get("radius") || "5"; // default 5km radius

    // Build query
    let query = supabaseClient
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
    if (user) {
      query = query.neq("user_id", user.id);
    }

    // Filter by parking zone if provided
    if (parking_zone) {
      query = query.eq("parking_zone", parseInt(parking_zone));
    }

    const { data: pins, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching pins:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch pins" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If lat/lng provided, filter by distance
    let filteredPins = pins;
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
    }

    return new Response(JSON.stringify({ success: true, pins: filteredPins }), {
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

// Calculate distance between two points using Haversine formula (in km)
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
