import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

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

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to query Overpass API with retry logic
async function queryOverpassWithRetry(
  query: string, 
  maxRetries: number = 1
): Promise<{ ok: boolean; data?: any; status?: number }> {
  const overpassUrl = "https://overpass-api.de/api/interpreter";
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(overpassUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      // If successful, return the data
      if (response.ok) {
        const data = await response.json();
        return { ok: true, data };
      }

      // Check if we should retry (504 Gateway Timeout or 429 Too Many Requests)
      if ((response.status === 504 || response.status === 429) && attempt < maxRetries) {
        console.warn(`⚠️ Overpass API returned ${response.status}, retrying in 2 seconds... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await delay(2000);
        continue;
      }

      // Non-retryable error or max retries reached
      return { ok: false, status: response.status };
    } catch (error) {
      console.error(`❌ Fetch error on attempt ${attempt + 1}:`, error);
      if (attempt < maxRetries) {
        await delay(2000);
        continue;
      }
      return { ok: false, status: 0 };
    }
  }

  return { ok: false, status: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);

    if (!checkRateLimit(user.id)) {
      return errorResponse("Rate limit exceeded. Please wait before making more requests.", 429);
    }

    const url = new URL(req.url);
    const streetName = url.searchParams.get("streetName");
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    const viewport = url.searchParams.get("viewport");

    if (!streetName || !lat || !lng) {
      return errorResponse("streetName, lat, and lng are required", 400);
    }

    console.log(`🔍 Street geometry request for: "${streetName}" at (${lat}, ${lng}) by user: ${user.id}`);

    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    
    let viewportData = null;
    if (viewport) {
      try {
        viewportData = JSON.parse(viewport);
      } catch (e) {
        console.warn("Failed to parse viewport:", e);
      }
    }

    // Define search area - use viewport if available, otherwise create one
    let south, west, north, east;
    
    if (viewportData && viewportData.northeast && viewportData.southwest) {
      south = viewportData.southwest.lat;
      west = viewportData.southwest.lng;
      north = viewportData.northeast.lat;
      east = viewportData.northeast.lng;
      
      // Expand the viewport slightly to ensure we catch the whole street
      const latPadding = (north - south) * 0.2;
      const lngPadding = (east - west) * 0.2;
      south -= latPadding;
      north += latPadding;
      west -= lngPadding;
      east += lngPadding;
    } else {
      // Create a search area around the center point (~300m radius)
      // Tightened from 0.005 to reduce server load
      const offset = 0.003;
      south = centerLat - offset;
      west = centerLng - offset;
      north = centerLat + offset;
      east = centerLng + offset;
    }

    // Clean street name for search (remove common prefixes/suffixes)
    const cleanStreetName = streetName
      .replace(/^רחוב\s+/i, '') // Remove "רחוב" (street in Hebrew)
      .replace(/^st\.?\s+/i, '')
      .replace(/^street\s+/i, '')
      .trim();

    // Escape quotes for Overpass QL string literals (exact match queries)
    // In Overpass QL, double quotes must be escaped with backslash: " -> \"
    // Single quotes should also be escaped for safety: ' -> \'
    const overpassSafeStreetName = cleanStreetName
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/"/g, '\\"')    // Escape double quotes
      .replace(/'/g, "\\'");   // Escape single quotes

    // Escape special characters for Overpass regex queries
    // This includes regex metacharacters AND quotes
    const escapedStreetName = cleanStreetName
      .replace(/\\/g, '\\\\')           // Escape backslashes first
      .replace(/"/g, '\\"')             // Escape double quotes for Overpass string
      .replace(/'/g, "\\'")             // Escape single quotes
      .replace(/[.*+?^${}()|[\]]/g, '\\$&');  // Escape regex metacharacters

    // Build Overpass API query - EXACT MATCH first (faster)
    const exactMatchQuery = `
      [out:json][timeout:60];
      (
        way["name"="${overpassSafeStreetName}"](${south},${west},${north},${east});
        way["name:he"="${overpassSafeStreetName}"](${south},${west},${north},${east});
        way["name:en"="${overpassSafeStreetName}"](${south},${west},${north},${east});
      );
      out geom;
    `;

    // Fallback REGEX query (slower, but catches partial matches)
    const regexMatchQuery = `
      [out:json][timeout:60];
      (
        way["name"~"${escapedStreetName}",i](${south},${west},${north},${east});
        way["name:he"~"${escapedStreetName}",i](${south},${west},${north},${east});
        way["name:en"~"${escapedStreetName}",i](${south},${west},${north},${east});
      );
      out geom;
    `;

    console.log(`📡 Querying Overpass API (exact match) for street: "${cleanStreetName}"`);

    // Try exact match first
    let result = await queryOverpassWithRetry(exactMatchQuery, 1);
    
    // If exact match failed or returned no results, try regex match
    if (!result.ok || !result.data?.elements || result.data.elements.length === 0) {
      if (!result.ok) {
        console.warn(`⚠️ Exact match query failed with status ${result.status}, trying regex match...`);
      } else {
        console.log(`📡 No exact match found, trying regex match for: "${cleanStreetName}"`);
      }
      
      result = await queryOverpassWithRetry(regexMatchQuery, 1);
    }

    // If both queries failed, return error or fallback
    if (!result.ok) {
      console.error(`❌ Overpass API error after retries: ${result.status}`);
      // Return center point as fallback instead of error
      return successResponse({
        success: true,
        geometry: {
          segments: [[[centerLat, centerLng]]],
          bounds: viewportData || {
            northeast: { lat: centerLat + 0.002, lng: centerLng + 0.002 },
            southwest: { lat: centerLat - 0.002, lng: centerLng - 0.002 },
          },
        },
      });
    }

    const data = result.data;

    if (!data.elements || data.elements.length === 0) {
      console.warn(`⚠️ No street geometry found for: ${streetName}`);
      // Return center point as fallback (single-point segment)
      return successResponse({
        success: true,
        geometry: {
          segments: [[[centerLat, centerLng]]],
          bounds: viewportData || {
            northeast: { lat: centerLat + 0.002, lng: centerLng + 0.002 },
            southwest: { lat: centerLat - 0.002, lng: centerLng - 0.002 },
          },
        },
      });
    }

    // Extract coordinates from each way as separate segments
    // Each segment is an array of [lat, lng] coordinates from one way
    const segments: Array<Array<[number, number]>> = [];
    const allCoordinates: Array<[number, number]> = []; // For bounds calculation
    
    for (const element of data.elements) {
      if (element.type === "way" && element.geometry && element.geometry.length > 0) {
        // Create a segment for this way
        const segment: Array<[number, number]> = [];
        for (const node of element.geometry) {
          const coord: [number, number] = [node.lat, node.lon];
          segment.push(coord);
          allCoordinates.push(coord); // Also collect for bounds calculation
        }
        // Only add segments with at least 2 points (to form a line)
        if (segment.length >= 2) {
          segments.push(segment);
        }
      }
    }

    if (segments.length === 0) {
      console.warn(`⚠️ No valid segments extracted for: ${streetName}`);
      return successResponse({
        success: true,
        geometry: {
          segments: [[[centerLat, centerLng]]],
          bounds: viewportData || {
            northeast: { lat: centerLat + 0.002, lng: centerLng + 0.002 },
            southwest: { lat: centerLat - 0.002, lng: centerLng - 0.002 },
          },
        },
      });
    }

    // Calculate actual bounds from all coordinates
    const lats = allCoordinates.map(c => c[0]);
    const lngs = allCoordinates.map(c => c[1]);
    const bounds = {
      northeast: { 
        lat: Math.max(...lats), 
        lng: Math.max(...lngs) 
      },
      southwest: { 
        lat: Math.min(...lats), 
        lng: Math.min(...lngs) 
      },
    };

    const totalPoints = segments.reduce((sum, seg) => sum + seg.length, 0);
    console.log(`✅ Found ${totalPoints} points in ${segments.length} segment(s) for street: ${streetName}`);

    return successResponse({
      success: true,
      geometry: {
        segments: segments,
        bounds: bounds,
      },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    if (error.message === "No authorization header" || error.message === "User not found") {
      return errorResponse("Authentication required", 401);
    }
    return errorResponse(error.message || "Internal server error");
  }
});