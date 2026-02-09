import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Receiver } from "https://esm.sh/@upstash/qstash@2.7.0";
import {
  createSupabaseAdmin,
  corsHeaders,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import {
  checkWalletBalance,
  addFundsToWallet,
  transferFundsBetweenWallets,
} from "../_shared/rapyd-utils.ts";

const RESERVATION_AMOUNT = 50;
const CURRENCY = "ILS";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawBody = await req.text();

  // Check for internal service role key auth (used by self-healing mechanism in get-active-pins)
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isInternalCall = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isInternalCall) {
    // External call (from QStash) - verify QStash signature
    const signature = req.headers.get("Upstash-Signature");

    const receiver = new Receiver({
      currentSigningKey: Deno.env.get("QSTASH_CURRENT_SIGNING_KEY")!,
      nextSigningKey: Deno.env.get("QSTASH_NEXT_SIGNING_KEY")!,
    });

    try {
      await receiver.verify({
        signature: signature || "",
        body: rawBody,
      });
      console.log("✅ QStash signature verified by SDK");
    } catch (err) {
      console.error("❌ QStash verification failed:", (err as Error).message);
      return errorResponse("Invalid signature", 401);
    }
  } else {
    console.log("✅ Internal call authenticated via service role key");
  }

  try {
    // Parse the body
    const { user_id, pin_id, secret_token } = JSON.parse(rawBody);

    if (!user_id || !pin_id || !secret_token) {
      console.error("❌ Missing required fields");
      return errorResponse("Missing user_id, pin_id, or secret_token", 400);
    }

    console.log(`📥 Received scheduled leave trigger for user: ${user_id}, pin: ${pin_id}`);

    const supabaseAdmin = createSupabaseAdmin();

    // Verify secret_token exists in scheduled_leaves and is still pending
    const { data: scheduleRecord, error: scheduleError } = await supabaseAdmin
      .from("scheduled_leaves")
      .select("*")
      .eq("user_id", user_id)
      .eq("pin_id", pin_id)
      .eq("secret_token", secret_token)
      .single();

    if (scheduleError || !scheduleRecord) {
      console.error("❌ Schedule record not found:", scheduleError);
      // Return 200 to prevent QStash retries for invalid tokens
      return successResponse({ success: false, reason: "Schedule not found" });
    }

    // Check if schedule was already processed (idempotency)
    if (scheduleRecord.status !== "pending") {
      console.log(`⚠️ Schedule already processed: ${scheduleRecord.status}`);
      return successResponse({
        success: true,
        already_processed: true,
        status: scheduleRecord.status,
      });
    }

    // Get the pin
    const { data: pin, error: pinError } = await supabaseAdmin
      .from("pins")
      .select("*")
      .eq("id", pin_id)
      .eq("user_id", user_id)
      .single();

    if (pinError || !pin) {
      console.error("❌ Pin not found:", pinError);
      // Mark schedule as cancelled since pin doesn't exist
      await supabaseAdmin
        .from("scheduled_leaves")
        .update({ status: "cancelled" })
        .eq("id", scheduleRecord.id);
      return successResponse({ success: false, reason: "Pin not found" });
    }

    // ========== HANDLE BASED ON PIN STATUS ==========

    if (pin.status === "waiting" || pin.status === "published") {
      // Check if there's a pending future reservation for this pin
      const { data: futureReservation, error: frCheckError } = await supabaseAdmin
        .from("future_reservations")
        .select("*")
        .eq("pin_id", pin_id)
        .eq("scheduled_leave_id", scheduleRecord.id)
        .eq("status", "pending")
        .maybeSingle();

      if (!futureReservation) {
        // No one reserved the pin -> activate it normally
        console.log(`🎉 Scheduled time reached! Pin is "${pin.status}" with no reservation - activating normally...`);

        const { error: updateError } = await supabaseAdmin
          .from("pins")
          .update({ status: "active" })
          .eq("id", pin_id);

        if (updateError) {
          console.error("❌ Failed to activate pin:", updateError);
          throw new Error(`Failed to activate pin: ${updateError.message}`);
        }

        console.log(`✅ Pin ${pin_id} activated successfully`);

        // Update schedule status
        await supabaseAdmin
          .from("scheduled_leaves")
          .update({ status: "completed" })
          .eq("id", scheduleRecord.id);

        console.log(`✅ Scheduled leave completed for user ${user_id}`);

        return successResponse({
          success: true,
          pin_id: pin_id,
          pin_status: "active",
          message: "Pin activated successfully. Your parking spot is now visible to others.",
        });
      }

      // Someone reserved this pin via future reservation -> activate full reservation flow
      console.log(`🎉 Scheduled time reached! Pin is "${pin.status}" with future reservation - activating reservation flow...`);

      const reserverId = futureReservation.reserver_id;
      const publisherId = futureReservation.publisher_id; // pin owner

      console.log(`📋 Future reservation found: reserver=${reserverId}, publisher=${publisherId}`);

      // ========== STEP 1: CREATE PAYMENT (TRANSFER REQUEST) ==========
      // Get sender's (reserver's) wallet
      const { data: senderData, error: senderError } = await supabaseAdmin
        .from("users")
        .select("rapyd_wallet_id")
        .eq("id", reserverId)
        .single();

      if (senderError || !senderData?.rapyd_wallet_id) {
        console.error("❌ Reserver wallet not found:", senderError);
        // Cancel and revert to active
        await supabaseAdmin.from("pins").update({ status: "active", reserved_by: null }).eq("id", pin_id);
        await supabaseAdmin.from("future_reservations").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", futureReservation.id);
        await supabaseAdmin.from("scheduled_leaves").update({ status: "completed" }).eq("id", scheduleRecord.id);
        return successResponse({ success: false, reason: "Reserver wallet not found. Pin activated normally." });
      }

      // Get receiver's (owner's) wallet
      const { data: receiverData, error: receiverError } = await supabaseAdmin
        .from("users")
        .select("rapyd_wallet_id")
        .eq("id", publisherId)
        .single();

      if (receiverError || !receiverData?.rapyd_wallet_id) {
        console.error("❌ Owner wallet not found:", receiverError);
        await supabaseAdmin.from("pins").update({ status: "active", reserved_by: null }).eq("id", pin_id);
        await supabaseAdmin.from("future_reservations").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", futureReservation.id);
        await supabaseAdmin.from("scheduled_leaves").update({ status: "completed" }).eq("id", scheduleRecord.id);
        return successResponse({ success: false, reason: "Owner wallet not found. Pin activated normally." });
      }

      // Check sender's wallet balance and add funds if needed
      const currentBalance = await checkWalletBalance(senderData.rapyd_wallet_id, CURRENCY);
      console.log(`💰 Reserver wallet balance: ${currentBalance} ${CURRENCY} (needs ${RESERVATION_AMOUNT} ${CURRENCY})`);

      if (currentBalance < RESERVATION_AMOUNT) {
        const amountToAdd = RESERVATION_AMOUNT - currentBalance;
        console.log(`💳 Adding ${amountToAdd} ${CURRENCY} to reserver's wallet`);
        await addFundsToWallet(senderData.rapyd_wallet_id, amountToAdd, CURRENCY);
        console.log(`✅ Funds added successfully`);
      }

      // Initiate transfer between wallets
      console.log(`💸 Initiating transfer of ${RESERVATION_AMOUNT} ${CURRENCY}`);
      const transferResult = await transferFundsBetweenWallets(
        senderData.rapyd_wallet_id,
        receiverData.rapyd_wallet_id,
        RESERVATION_AMOUNT,
        CURRENCY,
        {
          description: `Future parking reservation activation`,
          pin_id: pin_id,
          sender_user_id: reserverId,
          receiver_user_id: publisherId,
          future_reservation_id: futureReservation.id,
        }
      );

      console.log(`✅ Transfer initiated:`, {
        transfer_id: transferResult.transferId,
        status: transferResult.status,
      });

      // Create transfer request record
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 24);

      const { data: transferRequestData, error: transferRequestError } = await supabaseAdmin
        .from("transfer_requests")
        .insert({
          transfer_id: transferResult.transferId,
          pin_id: pin_id,
          sender_id: reserverId,
          receiver_id: publisherId,
          amount: RESERVATION_AMOUNT,
          currency: CURRENCY,
          status: "pending",
          sender_wallet_id: senderData.rapyd_wallet_id,
          receiver_wallet_id: receiverData.rapyd_wallet_id,
          expiration: expirationDate.toISOString(),
          metadata: {
            source_transaction_id: transferResult.sourceTransactionId,
            destination_transaction_id: transferResult.destinationTransactionId,
            future_reservation_id: futureReservation.id,
          },
        })
        .select("id")
        .single();

      if (transferRequestError || !transferRequestData) {
        console.error("❌ Failed to create transfer request:", transferRequestError);
        throw new Error(`Failed to create transfer request: ${transferRequestError?.message || "No data"}`);
      }

      const transferRequestId = transferRequestData.id;
      console.log(`✅ Transfer request created: ${transferRequestId}`);

      // ========== STEP 2: UPDATE PIN TO RESERVED ==========
      const { error: pinUpdateError } = await supabaseAdmin
        .from("pins")
        .update({ status: "reserved", reserved_by: reserverId })
        .eq("id", pin_id);

      if (pinUpdateError) {
        console.error("❌ Failed to update pin to reserved:", pinUpdateError);
        throw new Error(`Failed to update pin: ${pinUpdateError.message}`);
      }

      console.log(`✅ Pin ${pin_id} status updated to reserved`);

      // ========== STEP 3: UPDATE EXISTING CHAT SESSION ==========
      let sessionId: string | null = futureReservation.chat_session_id;

      if (sessionId) {
        const now = new Date();
        const twentyMinutesInMs = 20 * 60 * 1000;

        const { error: chatUpdateError } = await supabaseAdmin
          .from("chat_sessions")
          .update({
            transfer_request_id: transferRequestId,
            type: "reservation",
            status: "active",
            started_at: now.toISOString(),
            expires_at: new Date(now.getTime() + twentyMinutesInMs).toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", sessionId);

        if (chatUpdateError) {
          console.error("⚠️ Failed to update chat session:", chatUpdateError);
          // Don't fail - try to create a new one
          sessionId = null;
        } else {
          console.log(`✅ Chat session ${sessionId} upgraded to active reservation`);
        }
      }

      // If no existing session or update failed, create a new chat channel
      if (!sessionId) {
        try {
          console.log("💬 Creating new chat channel for activated reservation");
          const createChannelUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-chat-channel`;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

          const channelResponse = await fetch(createChannelUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              pin_id: pin_id,
              holder_id: reserverId,
              tracker_id: publisherId,
              transfer_request_id: transferRequestId,
            }),
          });

          if (channelResponse.ok) {
            const channelData = await channelResponse.json();
            console.log(`✅ Chat channel created: ${channelData.channel_id}`);
            sessionId = channelData.session_id;
          } else {
            const errorText = await channelResponse.text();
            console.error("⚠️ Failed to create chat channel:", errorText);
          }
        } catch (chatError) {
          console.error("⚠️ Error creating chat channel:", chatError);
        }
      }

      // ========== STEP 4: SCHEDULE 20-MIN AUTO-APPROVAL TIMER ==========
      if (sessionId) {
        try {
          console.log("⏰ Scheduling auto-approval timer");
          const scheduleTimerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/schedule-approval-timer`;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

          const timerResponse = await fetch(scheduleTimerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          });

          if (timerResponse.ok) {
            const timerData = await timerResponse.json();
            console.log(`✅ Auto-approval timer scheduled: ${timerData.timer_id}`);
          } else {
            const errorText = await timerResponse.text();
            console.error("⚠️ Failed to schedule timer:", errorText);
          }
        } catch (timerError) {
          console.error("⚠️ Error scheduling timer:", timerError);
        }
      }

      // ========== STEP 5: UPDATE FUTURE RESERVATION & SCHEDULE ==========
      await supabaseAdmin
        .from("future_reservations")
        .update({ status: "activated", updated_at: new Date().toISOString() })
        .eq("id", futureReservation.id);

      await supabaseAdmin
        .from("scheduled_leaves")
        .update({ status: "completed" })
        .eq("id", scheduleRecord.id);

      console.log(`✅ Future reservation activated successfully for pin ${pin_id}`);

      return successResponse({
        success: true,
        pin_id: pin_id,
        pin_status: "reserved",
        future_reservation_activated: true,
        session_id: sessionId,
        message: "Future reservation activated. Parking exchange is now in progress.",
      });

    } else {
      // Pin is in an unexpected status (e.g., already active, reserved, etc.)
      console.log(`⚠️ Pin status is "${pin.status}" - unexpected. Skipping.`);
      await supabaseAdmin
        .from("scheduled_leaves")
        .update({ status: "cancelled" })
        .eq("id", scheduleRecord.id);
      return successResponse({
        success: true,
        skipped: true,
        reason: `Pin is already ${pin.status}`,
      });
    }

  } catch (err) {
    console.error("Error in handle-scheduled-leave:", err);
    // Return 200 to prevent infinite retries, but indicate failure
    return successResponse({
      success: false,
      error: (err as Error).message || "Internal server error",
    });
  }
});
