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

    const { pin_id, holder_id, tracker_id, transfer_request_id, future_reservation_id } = await req.json();

    if (!pin_id || !holder_id || !tracker_id) {
      return errorResponse("pin_id, holder_id, and tracker_id are required", 400);
    }

    // Either transfer_request_id or future_reservation_id is required
    const isFutureReservation = !!future_reservation_id;
    if (!transfer_request_id && !future_reservation_id) {
      return errorResponse("transfer_request_id or future_reservation_id is required", 400);
    }

    const apiKey = Deno.env.get("STREAM_API_KEY");
    const apiSecret = Deno.env.get("STREAM_API_SECRET");

    if (!apiKey || !apiSecret) {
      return errorResponse("Stream Chat credentials not configured", 500);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Check for existing session based on the type
    if (isFutureReservation) {
      // Check if a session already exists for this future_reservation
      const { data: existingSession, error: lookupError } = await supabaseAdmin
        .from("chat_sessions")
        .select("stream_channel_id, status, id")
        .eq("future_reservation_id", future_reservation_id)
        .maybeSingle();

      if (lookupError) {
        console.error("Session lookup error:", lookupError);
        return errorResponse("Failed to check existing session", 500);
      }

      if (existingSession) {
        console.log(`✅ Session already exists for future_reservation ${future_reservation_id}`);
        return successResponse({
          channel_id: existingSession.stream_channel_id,
          session_id: existingSession.id,
          already_exists: true,
          session_status: existingSession.status,
        });
      }
    } else {
      // Check if a session already exists for this transfer_request
      const { data: existingSession, error: lookupError } = await supabaseAdmin
        .from("chat_sessions")
        .select("stream_channel_id, status, id")
        .eq("transfer_request_id", transfer_request_id)
        .maybeSingle();

      if (lookupError) {
        console.error("Session lookup error:", lookupError);
        return errorResponse("Failed to check existing session", 500);
      }

      if (existingSession) {
        console.log(`✅ Session already exists for transfer_request ${transfer_request_id}`);
        return successResponse({
          channel_id: existingSession.stream_channel_id,
          session_id: existingSession.id,
          already_exists: true,
          session_status: existingSession.status,
        });
      }
    }

    // No existing session - create a new one

    // Initialize Stream
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Channel ID based on the type
    const channelId = isFutureReservation
      ? `future-${future_reservation_id}`
      : `deal-${transfer_request_id}`;

    // Get user details
    const { data: users, error: usersError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, full_name, car_license_plate")
      .in("id", [holder_id, tracker_id]);

    if (usersError || !users || users.length < 2) {
      console.error("User lookup failed:", usersError);
      return errorResponse("Failed to fetch user details from profiles", 500);
    }

    const holder = users.find((u: any) => u.id === holder_id);
    const tracker = users.find((u: any) => u.id === tracker_id);

    // Sync Users to Stream
    await serverClient.upsertUsers([
      { id: holder_id, name: holder?.full_name || "Parker" },
      { id: tracker_id, name: tracker?.full_name || "Owner" },
    ]);

    // Create unique Stream Channel
    const channel = serverClient.channel("messaging", channelId, {
      members: [holder_id, tracker_id],
      created_by_id: holder_id,
      name: isFutureReservation
        ? `Future: ${holder?.car_license_plate || "Chat"}`
        : `Parking: ${holder?.car_license_plate || "Chat"}`,
    });

    try {
      await channel.create();
      console.log(`✅ Stream Channel Created: ${channelId}`);
    } catch (_err) {
      // Channel might already exist (edge case), try to watch it
      await channel.watch();
      console.log(`✅ Stream Channel Already Exists: ${channelId}`);
    }

    // Save new session to Database
    const now = new Date().toISOString();

    // Build the insert object based on type
    const sessionInsert: any = {
      holder_id,
      tracker_id,
      stream_channel_id: channelId,
      created_at: now,
      updated_at: now,
      // Initialize approval flags
      holder_approved: false,
      tracker_approved: false,
      holder_cancelled: false,
      tracker_cancelled: false,
    };

    if (isFutureReservation) {
      // Future reservation: no timer, no transfer_request yet
      sessionInsert.future_reservation_id = future_reservation_id;
      sessionInsert.type = "future_reservation";
      sessionInsert.status = "future_reservation";
      // No started_at or expires_at - these will be set when the reservation activates
    } else {
      // Immediate reservation: active with timer
      const twentyMinutesInMs = 20 * 60 * 1000;
      sessionInsert.transfer_request_id = transfer_request_id;
      sessionInsert.type = "reservation";
      sessionInsert.status = "active";
      sessionInsert.started_at = now;
      sessionInsert.expires_at = new Date(Date.now() + twentyMinutesInMs).toISOString();
    }

    const { data: insertedSession, error: insertError } = await supabaseAdmin
      .from("chat_sessions")
      .insert(sessionInsert)
      .select("id")
      .single();

    if (insertError) {
      console.error("DB Insert Error:", insertError);
      // Check if it's a duplicate key error (race condition)
      if (insertError.code === "23505") {
        if (isFutureReservation) {
          const { data: justCreatedSession } = await supabaseAdmin
            .from("chat_sessions")
            .select("id, stream_channel_id, status")
            .eq("future_reservation_id", future_reservation_id)
            .single();

          if (justCreatedSession) {
            return successResponse({
              channel_id: justCreatedSession.stream_channel_id,
              session_id: justCreatedSession.id,
              already_exists: true,
              session_status: justCreatedSession.status,
            });
          }
        } else {
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
      }
      return errorResponse("Chat created but failed to save to database", 500);
    }
    
    const logLabel = isFutureReservation
      ? `future_reservation ${future_reservation_id}`
      : `transfer_request ${transfer_request_id}`;
    console.log(`✅ Created new session for ${logLabel}: ${channelId}`);

    return successResponse({ 
      channel_id: channelId,
      session_id: insertedSession.id,
    });

  } catch (err) {
    console.error("CRITICAL ERROR:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal Error");
  }
});
