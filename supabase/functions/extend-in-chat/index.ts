import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

const EXTENSION_DURATION_SECONDS = 600; // 10 minutes
const MINIMUM_DELAY_SECONDS = 60; // Minimum 1 minute to prevent immediate expiration

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    // Authenticate the user making the request
    const user = await authenticateUser(req);
    const { session_id } = await req.json();

    if (!session_id) {
      return errorResponse("session_id is required", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Get chat session and verify user is part of it
    const { data: chatSession, error: chatError } = await supabaseAdmin
      .from("chat_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (chatError || !chatSession) {
      console.error("❌ Chat session not found:", chatError);
      return errorResponse("Chat session not found", 404);
    }

    // Verify user is part of this chat session
    if (chatSession.holder_id !== user.id && chatSession.tracker_id !== user.id) {
      return errorResponse("You are not authorized to extend this session", 403);
    }

    // Check if session is still active
    if (chatSession.status !== "active") {
      return errorResponse(`Chat session is ${chatSession.status}. Cannot extend.`, 400);
    }

    // Find the pending timer for this session
    const { data: existingTimer, error: timerError } = await supabaseAdmin
      .from("pending_timers")
      .select("*")
      .eq("session_id", session_id)
      .eq("status", "pending")
      .single();

    if (timerError || !existingTimer) {
      console.error("❌ No pending timer found:", timerError);
      return errorResponse("No active timer found for this session", 404);
    }

    console.log(`⏰ Current timer expires at: ${existingTimer.expires_at}`);

    // Get environment variables for QStash
    const QSTASH_URL = Deno.env.get("QSTASH_URL");
    const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!QSTASH_URL || !QSTASH_TOKEN || !SUPABASE_URL) {
      console.error("❌ Missing QStash configuration");
      return errorResponse("Server configuration error: QStash not configured", 500);
    }

    // Cancel the existing QStash message
    if (existingTimer.qstash_message_id) {
      console.log(`🗑️ Cancelling existing QStash message: ${existingTimer.qstash_message_id}`);
      try {
        const cancelResponse = await fetch(
          `https://qstash.upstash.io/v2/messages/${existingTimer.qstash_message_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${QSTASH_TOKEN}`,
            },
          }
        );

        if (cancelResponse.ok) {
          console.log(`✅ Existing QStash message cancelled`);
        } else {
          const errorText = await cancelResponse.text();
          console.warn(`⚠️ Failed to cancel existing QStash message: ${errorText}`);
          // Continue anyway - the old message might have already fired or been cancelled
        }
      } catch (cancelError) {
        console.warn(`⚠️ Error cancelling QStash message:`, cancelError);
        // Continue anyway
      }
    }

    // Calculate remaining time from current expires_at
    const currentExpiresAt = new Date(existingTimer.expires_at);
    const now = new Date();
    const remainingSeconds = Math.max(0, Math.floor((currentExpiresAt.getTime() - now.getTime()) / 1000));

    // Calculate new delay: remaining time + extension (minimum 60 seconds)
    const newDelaySeconds = Math.max(MINIMUM_DELAY_SECONDS, remainingSeconds + EXTENSION_DURATION_SECONDS);
    const newExpiresAt = new Date(now.getTime() + newDelaySeconds * 1000);

    console.log(`📊 Remaining: ${remainingSeconds}s, Extension: ${EXTENSION_DURATION_SECONDS}s, New delay: ${newDelaySeconds}s`);
    console.log(`⏰ New expiration: ${newExpiresAt.toISOString()}`);

    // Generate new secret token for the new QStash message
    const newSecretToken = crypto.randomUUID();

    // Target URL for the timer expiration handler
    const targetUrl = `${SUPABASE_URL}/functions/v1/handle-timer-expiration`;
    const qstashPublishUrl = `${QSTASH_URL}/${targetUrl}`;

    console.log(`📤 Scheduling new QStash message to: ${targetUrl}`);
    console.log(`⏱️ Delay: ${newDelaySeconds}s`);

    // Schedule new QStash message
    const qstashResponse = await fetch(qstashPublishUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Delay": `${newDelaySeconds}s`,
      },
      body: JSON.stringify({
        session_id,
        secret_token: newSecretToken,
      }),
    });

    if (!qstashResponse.ok) {
      const errorText = await qstashResponse.text();
      console.error(`❌ QStash API error: ${qstashResponse.status} - ${errorText}`);
      return errorResponse(`Failed to schedule extended timer: ${errorText}`, 500);
    }

    const qstashResult = await qstashResponse.json();
    const newQstashMessageId = qstashResult.messageId;

    console.log(`✅ New QStash message scheduled: ${newQstashMessageId}`);

    // Update the pending_timer record
    const { error: timerUpdateError } = await supabaseAdmin
      .from("pending_timers")
      .update({
        secret_token: newSecretToken,
        qstash_message_id: newQstashMessageId,
        expires_at: newExpiresAt.toISOString(),
      })
      .eq("id", existingTimer.id);

    if (timerUpdateError) {
      console.error("❌ Failed to update timer:", timerUpdateError);
      // Try to cancel the new QStash message since we couldn't update the timer
      try {
        await fetch(`https://qstash.upstash.io/v2/messages/${newQstashMessageId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${QSTASH_TOKEN}`,
          },
        });
        console.log(`🗑️ Cancelled orphaned QStash message: ${newQstashMessageId}`);
      } catch (orphanError) {
        console.error("⚠️ Failed to cancel orphaned QStash message:", orphanError);
      }
      return errorResponse(`Failed to update timer: ${timerUpdateError.message}`, 500);
    }

    // Update chat_sessions with extension info
    const { error: chatUpdateError } = await supabaseAdmin
      .from("chat_sessions")
      .update({
        expires_at: newExpiresAt.toISOString(),
        extended_at: now.toISOString(),
        extension_requested_by: user.id,
        extension_granted: true,
        updated_at: now.toISOString(),
      })
      .eq("id", session_id);

    if (chatUpdateError) {
      console.error("⚠️ Failed to update chat session:", chatUpdateError);
      // Don't fail the whole operation - the timer extension itself succeeded
    }

    console.log(`✅ Timer extended successfully for session ${session_id}`);

    return successResponse({
      success: true,
      new_expires_at: newExpiresAt.toISOString(),
      extension_seconds: EXTENSION_DURATION_SECONDS,
      new_delay_seconds: newDelaySeconds,
      message: `Timer extended by ${EXTENSION_DURATION_SECONDS / 60} minutes. New expiration: ${newExpiresAt.toISOString()}`,
    });
  } catch (err) {
    console.error("Error in extend-in-chat:", err);
    return errorResponse((err as Error).message || "Internal server error");
  }
});
