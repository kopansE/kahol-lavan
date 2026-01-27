import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

/**
 * Get all chat sessions for the authenticated user
 * Returns sessions with metadata about the other user and the associated pin
 * 
 * Pin data is now accessed through: chat_sessions → transfer_requests → pins
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const supabaseAdmin = createSupabaseAdmin();

    // Get all chat sessions where user is a participant
    // Join through transfer_requests to get pin data
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from("chat_sessions")
      .select(`
        id,
        holder_id,
        tracker_id,
        transfer_request_id,
        stream_channel_id,
        started_at,
        expires_at,
        status,
        created_at,
        updated_at,
        transfer_requests (
          id,
          pin_id,
          amount,
          status,
          pins (
            id,
            status,
            parking_zone,
            position
          )
        )
      `)
      .or(`holder_id.eq.${user.id},tracker_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    // Update expired sessions
    if (sessions) {
      const now = new Date();
      const expiredSessionIds = sessions
        .filter((s) => s.status === 'active' && new Date(s.expires_at) < now)
        .map((s) => s.id);

      if (expiredSessionIds.length > 0) {
        await supabaseAdmin
          .from("chat_sessions")
          .update({ status: "expired", updated_at: now.toISOString() })
          .in("id", expiredSessionIds);

        // Update the status in the sessions array
        sessions.forEach((session) => {
          if (expiredSessionIds.includes(session.id)) {
            session.status = "expired";
          }
        });
      }
    }

    if (sessionsError) {
      console.error("Failed to fetch channels:", sessionsError);
      return errorResponse(`Failed to fetch channels: ${JSON.stringify(sessionsError)}`, 500);
    }

    if (!sessions || sessions.length === 0) {
      return successResponse({ channels: [] });
    }

    // Get the other user's details for each session
    const otherUserIds = sessions.map((session) =>
      session.holder_id === user.id ? session.tracker_id : session.holder_id
    );

    const { data: otherUsers, error: usersError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, full_name, car_license_plate, car_make, car_model, car_color")
      .in("id", otherUserIds);

    if (usersError) {
      console.error("Failed to fetch user details:", usersError);
      return errorResponse("Failed to fetch user details", 500);
    }

    // Combine session data with user details
    // Extract pin data from transfer_requests → pins
    const enrichedChannels = sessions.map((session) => {
      const otherUserId = session.holder_id === user.id ? session.tracker_id : session.holder_id;
      const otherUser = otherUsers?.find((u) => u.id === otherUserId);
      
      // Get pin data through transfer_requests
      const transferRequest = session.transfer_requests;
      const pin = transferRequest?.pins || null;
      const pinId = transferRequest?.pin_id || null;

      return {
        id: session.id,
        stream_channel_id: session.stream_channel_id,
        stream_channel_type: "messaging",
        pin_id: pinId,
        transfer_request_id: session.transfer_request_id,
        created_at: session.created_at,
        started_at: session.started_at,
        expires_at: session.expires_at,
        last_message_at: session.updated_at,
        status: session.status,
        pin: pin,
        other_user: {
          id: otherUserId,
          full_name: otherUser?.full_name || "Unknown User",
          car_license_plate: otherUser?.car_license_plate,
          car_make: otherUser?.car_make,
          car_model: otherUser?.car_model,
          car_color: otherUser?.car_color,
        },
      };
    });

    console.log(`✅ Retrieved ${enrichedChannels.length} channels for user ${user.id}`);

    return successResponse({ channels: enrichedChannels });
  } catch (err) {
    console.error("Error in get-user-channels:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal server error");
  }
});
