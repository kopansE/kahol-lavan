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
 * Supports two types of sessions:
 * - "reservation" channels: linked via transfer_requests -> pins
 * - "future_reservation" channels: linked via future_reservations -> pins
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const supabaseAdmin = createSupabaseAdmin();

    // Get all chat sessions where user is a participant
    // Include both transfer_requests and future_reservations joins
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from("chat_sessions")
      .select(`
        id,
        holder_id,
        tracker_id,
        transfer_request_id,
        future_reservation_id,
        type,
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
            position,
            address
          )
        ),
        future_reservations!chat_sessions_future_reservation_id_fkey (
          id,
          pin_id,
          scheduled_for,
          status,
          pins (
            id,
            status,
            parking_zone,
            position,
            address
          )
        )
      `)
      .or(`holder_id.eq.${user.id},tracker_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    // Update expired sessions (only for active reservation sessions with expires_at)
    if (sessions) {
      const now = new Date();
      const expiredSessionIds = sessions
        .filter((s: any) => s.status === 'active' && s.expires_at && new Date(s.expires_at) < now)
        .map((s: any) => s.id);

      if (expiredSessionIds.length > 0) {
        await supabaseAdmin
          .from("chat_sessions")
          .update({ status: "expired", updated_at: now.toISOString() })
          .in("id", expiredSessionIds);

        // Update the status in the sessions array
        sessions.forEach((session: any) => {
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
    const otherUserIds = sessions.map((session: any) =>
      session.holder_id === user.id ? session.tracker_id : session.holder_id
    );

    const { data: otherUsers, error: usersError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, full_name, car_license_plate, car_make, car_model, car_color")
      .in("id", [...new Set(otherUserIds)]);

    if (usersError) {
      console.error("Failed to fetch user details:", usersError);
      return errorResponse("Failed to fetch user details", 500);
    }

    // Combine session data with user details
    const enrichedChannels = sessions.map((session: any) => {
      const otherUserId = session.holder_id === user.id ? session.tracker_id : session.holder_id;
      const otherUser = otherUsers?.find((u: any) => u.id === otherUserId);
      
      const isFutureReservation = session.type === "future_reservation";

      // Get pin data through the appropriate join path
      let pin = null;
      let pinId = null;

      if (isFutureReservation && session.future_reservations) {
        pin = session.future_reservations.pins || null;
        pinId = session.future_reservations.pin_id || null;
      } else if (session.transfer_requests) {
        pin = session.transfer_requests.pins || null;
        pinId = session.transfer_requests.pin_id || null;
      }

      const result: any = {
        id: session.id,
        stream_channel_id: session.stream_channel_id,
        stream_channel_type: "messaging",
        pin_id: pinId,
        transfer_request_id: session.transfer_request_id,
        future_reservation_id: session.future_reservation_id,
        type: session.type || "reservation",
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

      // Add scheduled_for for future reservation channels
      if (isFutureReservation && session.future_reservations) {
        result.scheduled_for = session.future_reservations.scheduled_for;
        result.future_reservation_status = session.future_reservations.status;
      }

      return result;
    });

    console.log(`✅ Retrieved ${enrichedChannels.length} channels for user ${user.id}`);

    return successResponse({ channels: enrichedChannels });
  } catch (err) {
    console.error("Error in get-user-channels:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal server error");
  }
});
