import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

/**
 * Generate Stream Chat token for authenticated user
 * Requires environment variables:
 * - STREAM_API_KEY
 * - STREAM_API_SECRET
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);

    const apiKey = Deno.env.get("STREAM_API_KEY");
    const apiSecret = Deno.env.get("STREAM_API_SECRET");

    if (!apiKey || !apiSecret) {
      console.error("Stream Chat credentials not configured");
      return errorResponse("Stream Chat not configured", 500);
    }

    // Generate Stream Chat token
    // Token format: HMAC-SHA256(user_id, api_secret)
    const userId = user.id;
    
    // Create token payload
    const header = {
      alg: "HS256",
      typ: "JWT"
    };
    
    const payload = {
      user_id: userId,
    };

    // Encode header and payload
    const encoder = new TextEncoder();
    const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    // Create signature
    const message = `${headerBase64}.${payloadBase64}`;
    const key = encoder.encode(apiSecret);
    const data = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    
    const token = `${message}.${signatureBase64}`;

    console.log(`✅ Generated Stream Chat token for user ${userId}`);

    return successResponse({
      token,
      api_key: apiKey,
      user_id: userId,
    });
  } catch (err) {
    console.error("Error in get-stream-token:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
