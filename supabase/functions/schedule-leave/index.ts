import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

const MINIMUM_DELAY_SECONDS = 60; // Minimum 1 minute in the future
const MAXIMUM_DELAY_SECONDS = 7 * 24 * 60 * 60; // Maximum 7 days in the future

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // Authenticate the user making the request
    const user = await authenticateUser(req);
    const { scheduled_for } = await req.json();

    if (!scheduled_for) {
      return errorResponse("scheduled_for timestamp is required", 400);
    }

    const scheduledTime = new Date(scheduled_for);
    const now = new Date();

    // Validate scheduled time is in the future
    const delaySeconds = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);

    if (delaySeconds < MINIMUM_DELAY_SECONDS) {
      return errorResponse(`Scheduled time must be at least ${MINIMUM_DELAY_SECONDS} seconds in the future`, 400);
    }

    if (delaySeconds > MAXIMUM_DELAY_SECONDS) {
      return errorResponse(`Scheduled time cannot be more than 7 days in the future`, 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Check if user has a pin with status "waiting"
    const { data: userPin, error: pinError } = await supabaseAdmin
      .from("pins")
      .select("id, status, position, address")
      .eq("user_id", user.id)
      .eq("status", "waiting")
      .single();

    if (pinError || !userPin) {
      console.error("❌ No waiting pin found for user:", pinError);
      return errorResponse("You don't have a parking spot to schedule. Please mark your parking location first.", 404);
    }

    console.log(`📍 Found waiting pin ${userPin.id} for user ${user.id}`);

    // Check if user already has a pending scheduled leave for this pin
    const { data: existingSchedule, error: scheduleCheckError } = await supabaseAdmin
      .from("scheduled_leaves")
      .select("id, scheduled_for, status")
      .eq("user_id", user.id)
      .eq("pin_id", userPin.id)
      .eq("status", "pending")
      .single();

    if (existingSchedule) {
      console.log(`⚠️ User already has a pending schedule for pin ${userPin.id}`);
      return errorResponse(
        `You already have a scheduled leave at ${new Date(existingSchedule.scheduled_for).toLocaleString()}. Please cancel it first.`,
        400
      );
    }

    // Generate unique secret token for webhook verification
    const secretToken = crypto.randomUUID();

    console.log(`🔐 Generated secret token for scheduled leave`);
    console.log(`⏰ Leave scheduled for: ${scheduledTime.toISOString()}`);
    console.log(`⏱️ Delay: ${delaySeconds} seconds`);

    // Get environment variables for QStash
    const QSTASH_URL = Deno.env.get("QSTASH_URL"); // e.g., https://qstash.upstash.io/v2/publish
    const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!QSTASH_URL || !QSTASH_TOKEN || !SUPABASE_URL) {
      console.error("❌ Missing QStash configuration");
      return errorResponse("Server configuration error: QStash not configured", 500);
    }

    // Target URL for the scheduled leave handler
    const targetUrl = `${SUPABASE_URL}/functions/v1/handle-scheduled-leave`;
    
    // QStash publish endpoint
    const qstashPublishUrl = `${QSTASH_URL}/${targetUrl}`;

    console.log(`📤 Scheduling QStash message to: ${targetUrl}`);

    // Call QStash to schedule the delayed message
    const qstashResponse = await fetch(qstashPublishUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Delay": `${delaySeconds}s`,
      },
      body: JSON.stringify({
        user_id: user.id,
        pin_id: userPin.id,
        secret_token: secretToken,
      }),
    });

    if (!qstashResponse.ok) {
      const errorText = await qstashResponse.text();
      console.error(`❌ QStash API error: ${qstashResponse.status} - ${errorText}`);
      return errorResponse(`Failed to schedule leave: ${errorText}`, 500);
    }

    const qstashResult = await qstashResponse.json();
    const qstashMessageId = qstashResult.messageId;

    console.log(`✅ QStash message scheduled: ${qstashMessageId}`);

    // Store the scheduled leave in the database
    const { data: scheduleData, error: insertError } = await supabaseAdmin
      .from("scheduled_leaves")
      .insert({
        user_id: user.id,
        pin_id: userPin.id,
        secret_token: secretToken,
        qstash_message_id: qstashMessageId,
        scheduled_for: scheduledTime.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("❌ Failed to store scheduled leave:", insertError);
      // Try to cancel the QStash message since we couldn't store the schedule
      try {
        await fetch(`https://qstash.upstash.io/v2/messages/${qstashMessageId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${QSTASH_TOKEN}`,
          },
        });
        console.log(`🗑️ Cancelled orphaned QStash message: ${qstashMessageId}`);
      } catch (cancelError) {
        console.error("⚠️ Failed to cancel orphaned QStash message:", cancelError);
      }
      return errorResponse(`Failed to store scheduled leave: ${insertError.message}`, 500);
    }

    console.log(`✅ Scheduled leave stored in database: ${scheduleData.id}`);

    // Update pin status to "published" so it becomes visible to other users
    const { error: pinUpdateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "published" })
      .eq("id", userPin.id);

    if (pinUpdateError) {
      console.error("⚠️ Failed to update pin status to published:", pinUpdateError);
      // Don't fail the whole operation - schedule was created successfully
    } else {
      console.log(`✅ Pin ${userPin.id} status updated to published`);
    }

    return successResponse({
      success: true,
      schedule_id: scheduleData.id,
      scheduled_for: scheduledTime.toISOString(),
      qstash_message_id: qstashMessageId,
      pin_address: userPin.address,
      pin_id: userPin.id,
      message: `Your parking spot is now published and visible to others. It will activate at ${scheduledTime.toLocaleString()}.`,
    });
  } catch (err) {
    console.error("Error in schedule-leave:", err);
    return errorResponse((err as Error).message || "Internal server error");
  }
});
