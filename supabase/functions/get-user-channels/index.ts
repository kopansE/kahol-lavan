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
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const supabaseAdmin = createSupabaseAdmin();

    // Get all chat sessions where user is a participant
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from("chat_sessions")
      .select(`
        id,
        pin_id,
        holder_id,
        tracker_id,
        stream_channel_id,
        started_at,
        expires_at,
        status,
        created_at,
        updated_at,
        pins (
          id,
          status,
          parking_zone,
          position
        )
      `)
      .or(`holder_id.eq.${user.id},tracker_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

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
    const enrichedChannels = sessions.map((session) => {
      const otherUserId = session.holder_id === user.id ? session.tracker_id : session.holder_id;
      const otherUser = otherUsers?.find((u) => u.id === otherUserId);

      return {
        id: session.id,
        stream_channel_id: session.stream_channel_id,
        stream_channel_type: "messaging",
        pin_id: session.pin_id,
        created_at: session.created_at,
        last_message_at: session.updated_at,
        status: session.status,
        pin: session.pins,
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
    return errorResponse(err.message || "Internal server error");
  }
});
