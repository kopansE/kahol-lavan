import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const { future_reservation_id } = await req.json();

    if (!future_reservation_id) {
      return errorResponse("future_reservation_id is required", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Get the future reservation record
    const { data: futureRes, error: frError } = await supabaseAdmin
      .from("future_reservations")
      .select("*")
      .eq("id", future_reservation_id)
      .single();

    if (frError || !futureRes) {
      console.error("❌ Future reservation not found:", frError);
      return errorResponse("Future reservation not found", 404);
    }

    // Verify user is either the reserver or the publisher
    if (futureRes.reserver_id !== user.id && futureRes.publisher_id !== user.id) {
      return errorResponse("You are not authorized to cancel this reservation", 403);
    }

    // Check if already processed
    if (futureRes.status !== "pending") {
      return errorResponse(`This future reservation is already ${futureRes.status}`, 400);
    }

    console.log(`🗑️ Cancelling future reservation ${future_reservation_id} by user ${user.id}`);

    // Cancel the future reservation
    const { error: updateError } = await supabaseAdmin
      .from("future_reservations")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", future_reservation_id);

    if (updateError) {
      console.error("❌ Failed to cancel future reservation:", updateError);
      return errorResponse(`Failed to cancel: ${updateError.message}`, 500);
    }

    // Pin stays "published" - no status change needed
    console.log(`✅ Pin ${futureRes.pin_id} remains published`);

    // Cancel the associated chat session
    if (futureRes.chat_session_id) {
      const { error: chatUpdateError } = await supabaseAdmin
        .from("chat_sessions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", futureRes.chat_session_id);

      if (chatUpdateError) {
        console.error("⚠️ Failed to cancel chat session:", chatUpdateError);
      } else {
        console.log(`✅ Chat session ${futureRes.chat_session_id} cancelled`);
      }
    }

    console.log(`✅ Future reservation ${future_reservation_id} cancelled successfully`);

    return successResponse({
      success: true,
      message: "Future reservation cancelled successfully. The parking spot is available again.",
      future_reservation_id: future_reservation_id,
    });
  } catch (err) {
    console.error("Error in cancel-future-reservation:", err);
    return errorResponse((err as Error).message || "Internal server error");
  }
});
