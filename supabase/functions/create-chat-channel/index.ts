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

    const { pin_id, holder_id, tracker_id, transfer_request_id } = await req.json();

    if (!pin_id || !holder_id || !tracker_id) {
      return errorResponse("pin_id, holder_id, and tracker_id are required", 400);
    }

    // transfer_request_id is required for new sessions (ensures 1:1 mapping)
    if (!transfer_request_id) {
      return errorResponse("transfer_request_id is required", 400);
    }

    const apiKey = Deno.env.get("STREAM_API_KEY");
    const apiSecret = Deno.env.get("STREAM_API_SECRET");

    if (!apiKey || !apiSecret) {
      return errorResponse("Stream Chat credentials not configured", 500);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Simple lookup: check if a session already exists for this transfer_request
    const { data: existingSession, error: lookupError } = await supabaseAdmin
      .from("chat_sessions")
      .select("stream_channel_id, status, id")
      .eq("transfer_request_id", transfer_request_id)
      .maybeSingle();

    if (lookupError) {
      console.error("Session lookup error:", lookupError);
      return errorResponse("Failed to check existing session", 500);
    }

    // If session already exists for this transfer_request, return it
    if (existingSession) {
      console.log(`✅ Session already exists for transfer_request ${transfer_request_id}`);
      return successResponse({
        channel_id: existingSession.stream_channel_id,
        session_id: existingSession.id,
        already_exists: true,
        session_status: existingSession.status,
      });
    }

    // No existing session - create a new one

    // Initialize Stream
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    // IMPORTANT: Channel ID is based on transfer_request_id to ensure uniqueness per deal
    // This prevents message mixing between different deals
    const channelId = `deal-${transfer_request_id}`;

    // Each deal gets a unique channel, so no need to expire old sessions

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

    // Sync Users to Stream
    await serverClient.upsertUsers([
      { id: holder_id, name: holder?.full_name || "Parker" },
      { id: tracker_id, name: tracker?.full_name || "Owner" },
    ]);

    // Create unique Stream Channel for this deal
    // Each deal gets its own channel - no message mixing between deals
    const channel = serverClient.channel("messaging", channelId, {
      members: [holder_id, tracker_id],
      created_by_id: holder_id,
      name: `Parking: ${holder?.car_license_plate || "Chat"}`,
    });

    try {
      await channel.create();
      console.log(`✅ Stream Channel Created: ${channelId}`);
    } catch (_err) {
      // Channel might already exist (edge case), try to watch it
      await channel.watch();
      console.log(`✅ Stream Channel Already Exists: ${channelId}`);
    }

    // Save new session to Database (always INSERT, never UPDATE)
    // Note: pin_id is NOT stored here - get it via transfer_requests if needed
    const now = new Date().toISOString();
    const twentyMinutesInMs = 20 * 60 * 1000;
    
    const { data: insertedSession, error: insertError } = await supabaseAdmin
      .from("chat_sessions")
      .insert({
        holder_id,
        tracker_id,
        transfer_request_id, // Links this session to the specific reservation (1:1)
        stream_channel_id: channelId,
        status: "active",
        started_at: now,
        expires_at: new Date(Date.now() + twentyMinutesInMs).toISOString(),
        created_at: now,
        updated_at: now,
        // Initialize approval flags
        holder_approved: false,
        tracker_approved: false,
        holder_cancelled: false,
        tracker_cancelled: false,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("DB Insert Error:", insertError);
      // Check if it's a duplicate key error (race condition - session was just created)
      if (insertError.code === "23505") {
        // Duplicate key - session was created by another request, fetch and return it
        const { data: justCreatedSession } = await supabaseAdmin
          .from("chat_sessions")
          .select("id, stream_channel_id, status")
          .eq("transfer_request_id", transfer_request_id)
          .single();
        
        if (justCreatedSession) {
          return successResponse({
            channel_id: justCreatedSession.stream_channel_id,
            session_id: justCreatedSession.id,
            already_exists: true,
            session_status: justCreatedSession.status,
          });
        }
      }
      return errorResponse("Chat created but failed to save to database", 500);
    }
    
    console.log(`✅ Created new session for transfer_request ${transfer_request_id}: ${channelId}`);

    return successResponse({ 
      channel_id: channelId,
      session_id: insertedSession.id,
    });

  } catch (err) {
    console.error("CRITICAL ERROR:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal Error");
  }
});
