import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

// Simple in-memory rate limiting (per user)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 30; // Max requests
const RATE_LIMIT_WINDOW_MS = 60000; // Per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // Authenticate user
    const user = await authenticateUser(req);

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return errorResponse("Rate limit exceeded. Please wait before making more requests.", 429);
    }

    // Validate API key
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("❌ GOOGLE_MAPS_API_KEY not configured");
      return errorResponse("Server configuration error", 500);
    }

    // Get query parameter
    const url = new URL(req.url);
    const input = url.searchParams.get("input");
    const sessionToken = url.searchParams.get("sessionToken");

    if (!input || input.trim().length < 2) {
      return errorResponse("Input query must be at least 2 characters", 400);
    }

    // Build Google Places Autocomplete API URL
    // Focus on Israel and surrounding areas
    const googleApiUrl = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    googleApiUrl.searchParams.set("input", input);
    googleApiUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    googleApiUrl.searchParams.set("language", "he"); // Hebrew
    googleApiUrl.searchParams.set("components", "country:il"); // Focus on Israel
    googleApiUrl.searchParams.set("types", "geocode|establishment"); // Addresses and places

    // Add session token if provided (for billing optimization)
    if (sessionToken) {
      googleApiUrl.searchParams.set("sessiontoken", sessionToken);
    }

    console.log(`🔍 Places autocomplete request for: "${input}" by user: ${user.id}`);

    // Call Google Places API
    const response = await fetch(googleApiUrl.toString());
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("❌ Google API error:", data.status, data.error_message);
      return errorResponse(`Places API error: ${data.status}`, 500);
    }

    // Transform response to only include necessary fields
    const predictions = (data.predictions || []).map((prediction: any) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      mainText: prediction.structured_formatting?.main_text || "",
      secondaryText: prediction.structured_formatting?.secondary_text || "",
      types: prediction.types || [],
    }));

    console.log(`✅ Found ${predictions.length} predictions for: "${input}"`);

    return successResponse({
      success: true,
      predictions,
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    if (error.message === "No authorization header" || error.message === "User not found") {
      return errorResponse("Authentication required", 401);
    }
    return errorResponse(error.message || "Internal server error");
  }
});
