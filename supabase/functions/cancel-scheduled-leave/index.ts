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
    // Authenticate the user making the request
    const user = await authenticateUser(req);
    const { schedule_id } = await req.json();

    if (!schedule_id) {
      return errorResponse("schedule_id is required", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Get the scheduled leave record
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("scheduled_leaves")
      .select("*")
      .eq("id", schedule_id)
      .eq("user_id", user.id)
      .single();

    if (scheduleError || !schedule) {
      console.error("❌ Scheduled leave not found:", scheduleError);
      return errorResponse("Scheduled leave not found", 404);
    }

    // Check if already processed
    if (schedule.status !== "pending") {
      console.log(`⚠️ Schedule already ${schedule.status}`);
      return errorResponse(`This schedule is already ${schedule.status}`, 400);
    }

    // Cancel the QStash message if it exists
    const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");

    if (schedule.qstash_message_id && QSTASH_TOKEN) {
      console.log(`🗑️ Cancelling QStash message: ${schedule.qstash_message_id}`);
      try {
        const cancelResponse = await fetch(
          `https://qstash.upstash.io/v2/messages/${schedule.qstash_message_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${QSTASH_TOKEN}`,
            },
          }
        );

        if (cancelResponse.ok) {
          console.log(`✅ QStash message cancelled successfully`);
        } else {
          const errorText = await cancelResponse.text();
          console.warn(`⚠️ Failed to cancel QStash message: ${errorText}`);
          // Continue anyway - the message might have already fired
        }
      } catch (cancelError) {
        console.warn(`⚠️ Error cancelling QStash message:`, cancelError);
        // Continue anyway
      }
    }

    // Update the scheduled_leaves record to cancelled
    const { error: updateError } = await supabaseAdmin
      .from("scheduled_leaves")
      .update({ status: "cancelled" })
      .eq("id", schedule_id);

    if (updateError) {
      console.error("❌ Failed to update schedule status:", updateError);
      return errorResponse(`Failed to cancel schedule: ${updateError.message}`, 500);
    }

    // Revert pin status back to "waiting" if it's published
    const { data: pin } = await supabaseAdmin
      .from("pins")
      .select("id, status")
      .eq("id", schedule.pin_id)
      .single();

    if (pin && pin.status === "published") {
      // Also cancel any linked future reservations
      const { data: futureRes } = await supabaseAdmin
        .from("future_reservations")
        .select("id, chat_session_id")
        .eq("scheduled_leave_id", schedule_id)
        .eq("status", "pending")
        .maybeSingle();

      if (futureRes) {
        console.log(`🗑️ Also cancelling linked future reservation ${futureRes.id}`);

        await supabaseAdmin
          .from("future_reservations")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", futureRes.id);

        // Cancel linked chat session
        if (futureRes.chat_session_id) {
          await supabaseAdmin
            .from("chat_sessions")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", futureRes.chat_session_id);
        }
      }

      // Revert pin to waiting
      await supabaseAdmin
        .from("pins")
        .update({ status: "waiting", reserved_by: null })
        .eq("id", schedule.pin_id);

      console.log(`✅ Pin ${schedule.pin_id} reverted to waiting`);
    }

    console.log(`✅ Scheduled leave ${schedule_id} cancelled successfully`);

    return successResponse({
      success: true,
      message: "Scheduled leave cancelled successfully",
      schedule_id: schedule_id,
    });
  } catch (err) {
    console.error("Error in cancel-scheduled-leave:", err);
    return errorResponse((err as Error).message || "Internal server error");
  }
});
