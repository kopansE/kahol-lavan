import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

const TIMER_DURATION_SECONDS = 1200; // 20 minutes

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

    // Verify the chat session exists and user is part of it
    const { data: chatSession, error: chatError } = await supabaseAdmin
      .from("chat_sessions")
      .select("id, holder_id, tracker_id, status")
      .eq("id", session_id)
      .single();

    if (chatError || !chatSession) {
      console.error("❌ Chat session not found:", chatError);
      return errorResponse("Chat session not found", 404);
    }

    // Verify user is part of this chat session
    if (chatSession.holder_id !== user.id && chatSession.tracker_id !== user.id) {
      return errorResponse("You are not authorized to schedule a timer for this session", 403);
    }

    // Check if session is still active
    if (chatSession.status !== "active") {
      return errorResponse(`Chat session is ${chatSession.status}. Cannot schedule timer.`, 400);
    }

    // Check if a pending timer already exists for this session
    const { data: existingTimer, error: timerCheckError } = await supabaseAdmin
      .from("pending_timers")
      .select("id, status")
      .eq("session_id", session_id)
      .eq("status", "pending")
      .single();

    if (existingTimer) {
      console.log(`⚠️ Timer already exists for session ${session_id}`);
      return successResponse({
        success: true,
        already_scheduled: true,
        timer_id: existingTimer.id,
        message: "Timer already scheduled for this session",
      });
    }

    // Generate unique secret token for webhook verification
    const secretToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TIMER_DURATION_SECONDS * 1000);

    console.log(`🔐 Generated secret token for session ${session_id}`);
    console.log(`⏰ Timer will expire at: ${expiresAt.toISOString()}`);

    // Get environment variables for QStash
    const QSTASH_URL = Deno.env.get("QSTASH_URL"); // e.g., https://qstash.upstash.io/v2/publish
    const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!QSTASH_URL || !QSTASH_TOKEN || !SUPABASE_URL) {
      console.error("❌ Missing QStash configuration");
      return errorResponse("Server configuration error: QStash not configured", 500);
    }

    // Target URL for the timer expiration handler
    const targetUrl = `${SUPABASE_URL}/functions/v1/handle-timer-expiration`;
    
    // QStash publish endpoint: {QSTASH_URL}/{destination_url}
    // Note: destination URL should NOT be URL-encoded
    const qstashPublishUrl = `${QSTASH_URL}/${targetUrl}`;

    console.log(`📤 Scheduling QStash message to: ${targetUrl}`);
    console.log(`⏱️ Delay: ${TIMER_DURATION_SECONDS}s`);

    // Call QStash to schedule the delayed message
    // The body is the actual payload that will be delivered to the target URL
    const qstashResponse = await fetch(qstashPublishUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Delay": `${TIMER_DURATION_SECONDS}s`,
      },
      body: JSON.stringify({
        session_id,
        secret_token: secretToken,
      }),
    });

    if (!qstashResponse.ok) {
      const errorText = await qstashResponse.text();
      console.error(`❌ QStash API error: ${qstashResponse.status} - ${errorText}`);
      return errorResponse(`Failed to schedule timer: ${errorText}`, 500);
    }

    const qstashResult = await qstashResponse.json();
    const qstashMessageId = qstashResult.messageId;

    console.log(`✅ QStash message scheduled: ${qstashMessageId}`);

    // Store the timer in the database
    const { data: timerData, error: insertError } = await supabaseAdmin
      .from("pending_timers")
      .insert({
        session_id,
        secret_token: secretToken,
        qstash_message_id: qstashMessageId,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("❌ Failed to store timer:", insertError);
      // Try to cancel the QStash message since we couldn't store the timer
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
      return errorResponse(`Failed to store timer: ${insertError.message}`, 500);
    }

    console.log(`✅ Timer stored in database: ${timerData.id}`);

    return successResponse({
      success: true,
      timer_id: timerData.id,
      expires_at: expiresAt.toISOString(),
      qstash_message_id: qstashMessageId,
      message: `Timer scheduled. Auto-approval will trigger in ${TIMER_DURATION_SECONDS} seconds.`,
    });
  } catch (err) {
    console.error("Error in schedule-approval-timer:", err);
    return errorResponse((err as Error).message || "Internal server error");
  }
});
