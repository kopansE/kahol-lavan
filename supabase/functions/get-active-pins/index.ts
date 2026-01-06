import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const supabaseClient = createSupabaseClient();

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
      }
    }

    // Get query parameters
    const url = new URL(req.url);
    const parking_zone = url.searchParams.get("parking_zone");
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    const radius = url.searchParams.get("radius") || "5"; // default 5km radius

    // Build query - use admin client to bypass RLS
    // Get active pins (excluding user's own)
    let activeQuery = supabaseAdmin
      .from("pins")
      .select(
        `
        id,
        position,
        parking_zone,
        created_at,
        price,
        user_id,
        status,
        reserved_by,
        users (
          email,
          full_name,
          avatar_url
        )
      `
      )
      .eq("status", "active");

    // Exclude user's own pins if logged in
    if (userId) {
      activeQuery = activeQuery.neq("user_id", userId);
    }

    // Get reserved pins where user is either the owner or the reserver
    let reservedQuery = null;
    if (userId) {
      reservedQuery = supabaseAdmin
        .from("pins")
        .select(
          `
          id,
          position,
          parking_zone,
          created_at,
          price,
          user_id,
          status,
          reserved_by,
          users (
            email,
            full_name,
            avatar_url
          )
        `
        )
        .eq("status", "reserved")
        .or(`user_id.eq.${userId},reserved_by.eq.${userId}`);
    }

    // Filter by parking zone if provided
    if (parking_zone) {
      activeQuery = activeQuery.eq("parking_zone", parseInt(parking_zone));
      if (reservedQuery) {
        reservedQuery = reservedQuery.eq(
          "parking_zone",
          parseInt(parking_zone)
        );
      }
    }

    const { data: activePins, error: activeError } = await activeQuery.order(
      "created_at",
      {
        ascending: false,
      }
    );

    if (activeError) {
      console.error("❌ Error fetching active pins:", activeError);
      return errorResponse("Failed to fetch pins", 500);
    }

    let reservedPins = [];
    if (reservedQuery) {
      const { data: reserved, error: reservedError } =
        await reservedQuery.order("created_at", {
          ascending: false,
        });

      if (reservedError) {
        console.error("❌ Error fetching reserved pins:", reservedError);
        // Don't fail the whole request if reserved pins fail
      } else {
        reservedPins = reserved || [];
      }
    }

    // Combine active and reserved pins
    const pins = [...(activePins || []), ...reservedPins];

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
    }

    return successResponse({
      success: true,
      pins: filteredPins,
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
