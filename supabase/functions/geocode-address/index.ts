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
const RATE_LIMIT_REQUESTS = 20; // Max requests
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

    // Get query parameters
    const url = new URL(req.url);
    const placeId = url.searchParams.get("placeId");
    const address = url.searchParams.get("address");
    const sessionToken = url.searchParams.get("sessionToken");

    if (!placeId && !address) {
      return errorResponse("Either placeId or address is required", 400);
    }

    let googleApiUrl: URL;
    let isPlaceDetails = false;

    if (placeId) {
      // Use Place Details API for more accurate results when we have a place_id
      googleApiUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      googleApiUrl.searchParams.set("place_id", placeId);
      googleApiUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
      googleApiUrl.searchParams.set("fields", "geometry,address_components,formatted_address,types,name");
      googleApiUrl.searchParams.set("language", "he");
      
      // Add session token if provided (for billing optimization)
      if (sessionToken) {
        googleApiUrl.searchParams.set("sessiontoken", sessionToken);
      }
      
      isPlaceDetails = true;
      console.log(`🔍 Place details request for placeId: ${placeId} by user: ${user.id}`);
    } else {
      // Fallback to Geocoding API for address string
      googleApiUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      googleApiUrl.searchParams.set("address", address!);
      googleApiUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
      googleApiUrl.searchParams.set("language", "he");
      googleApiUrl.searchParams.set("region", "il");
      console.log(`🔍 Geocoding request for address: "${address}" by user: ${user.id}`);
    }

    // Call Google API
    const response = await fetch(googleApiUrl.toString());
    const data = await response.json();

    if (isPlaceDetails) {
      // Handle Place Details response
      if (data.status !== "OK") {
        console.error("❌ Google Place Details API error:", data.status, data.error_message);
        return errorResponse(`Place Details API error: ${data.status}`, 500);
      }

      const result = data.result;
      const location = result.geometry?.location;

      if (!location) {
        return errorResponse("No location found for this place", 404);
      }

      // Determine if this is a street (route) or a specific address
      const types = result.types || [];
      const isStreet = types.includes("route");

      // For streets, get the viewport to show the whole street
      const viewport = result.geometry?.viewport;

      console.log(`✅ Place details found: ${result.formatted_address}, type: ${types.join(", ")}`);

      return successResponse({
        success: true,
        result: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          name: result.name,
          types: types,
          isStreet: isStreet,
          viewport: viewport ? {
            northeast: viewport.northeast,
            southwest: viewport.southwest,
          } : null,
          addressComponents: result.address_components,
        },
      });
    } else {
      // Handle Geocoding response
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error("❌ Google Geocoding API error:", data.status, data.error_message);
        return errorResponse(`Geocoding API error: ${data.status}`, 500);
      }

      if (!data.results || data.results.length === 0) {
        return errorResponse("No results found for this address", 404);
      }

      const result = data.results[0];
      const location = result.geometry?.location;

      if (!location) {
        return errorResponse("No location found for this address", 404);
      }

      // Determine if this is a street (route) or a specific address
      const types = result.types || [];
      const isStreet = types.includes("route");

      // For streets, get the viewport to show the whole street
      const viewport = result.geometry?.viewport;

      console.log(`✅ Geocoding result: ${result.formatted_address}, type: ${types.join(", ")}`);

      return successResponse({
        success: true,
        result: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          types: types,
          isStreet: isStreet,
          viewport: viewport ? {
            northeast: viewport.northeast,
            southwest: viewport.southwest,
          } : null,
          addressComponents: result.address_components,
        },
      });
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    if (error.message === "No authorization header" || error.message === "User not found") {
      return errorResponse("Authentication required", 401);
    }
    return errorResponse(error.message || "Internal server error");
  }
});
