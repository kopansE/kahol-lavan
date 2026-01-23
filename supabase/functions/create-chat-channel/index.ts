import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// 1. Import Buffer polyfill
import { Buffer } from "node:buffer";

// 2. Set global Buffer immediately
// @ts-ignore
globalThis.Buffer = Buffer;

import {
  createSupabaseAdmin,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // 3. DYNAMIC IMPORT: This is the ONLY way to ensure Buffer is ready
    // before the library tries to use it.
    const { StreamChat } = await import("stream-chat");

    const { pin_id, holder_id, tracker_id } = await req.json();

    if (!pin_id || !holder_id || !tracker_id) {
      return errorResponse("pin_id, holder_id, and tracker_id are required", 400);
    }

    const apiKey = Deno.env.get("STREAM_API_KEY");
    const apiSecret = Deno.env.get("STREAM_API_SECRET");

    if (!apiKey || !apiSecret) {
      return errorResponse("Stream Chat credentials not configured", 500);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Check if session exists
    const { data: existingSession } = await supabaseAdmin
      .from("chat_sessions")
      .select("stream_channel_id")
      .eq("pin_id", pin_id)
      .maybeSingle();

    if (existingSession) {
      return successResponse({
        channel_id: existingSession.stream_channel_id,
        already_exists: true,
      });
    }

    // Initialize Stream
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    const channelId = `reservation-${pin_id}`;

    // Get user details
    const { data: users, error: usersError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, full_name, car_license_plate")
      .in("id", [holder_id, tracker_id]);

    if (usersError || !users || users.length < 2) {
      console.error("User lookup failed:", usersError);
      return errorResponse("Failed to fetch user details from profiles", 500);
    }

    const holder = users.find((u) => u.id === holder_id);
    const tracker = users.find((u) => u.id === tracker_id);

    // Sync Users
    await serverClient.upsertUsers([
      { id: holder_id, name: holder?.full_name || "Parker" },
      { id: tracker_id, name: tracker?.full_name || "Owner" },
    ]);

    // Create Channel
    const channel = serverClient.channel("messaging", channelId, {
      members: [holder_id, tracker_id],
      created_by_id: holder_id,
      name: `Parking: ${holder?.car_license_plate || "Chat"}`,
    });

    await channel.create();
    console.log(`✅ Stream Channel Created: ${channelId}`);

    // 4. Save to Database
    const now = new Date().toISOString();
    const twentyMinutesInMs = 20 * 60 * 1000; // 20 minutes = 1,200,000ms
    const { error: insertError } = await supabaseAdmin
      .from("chat_sessions")
      .insert({
        pin_id,
        holder_id,
        tracker_id,
        stream_channel_id: channelId,
        status: "active",
        started_at: now,
        expires_at: new Date(Date.now() + twentyMinutesInMs).toISOString(),
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      console.error("DB Insert Error:", insertError);
      return errorResponse("Chat created but failed to save to database", 500);
    }

    return successResponse({ channel_id: channelId });

  } catch (err) {
    console.error("CRITICAL ERROR:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal Error");
  }
});