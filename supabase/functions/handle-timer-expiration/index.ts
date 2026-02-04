import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Receiver } from "https://esm.sh/@upstash/qstash@2.7.0";
import {
  createSupabaseAdmin,
  corsHeaders,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import { acceptTransfer, checkWalletBalance, logTransaction } from "../_shared/rapyd-utils.ts";

const CURRENCY = "ILS";
const PLATFORM_FEE = 0;

  // Handle CORS preflight
  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
    const signature = req.headers.get("Upstash-Signature");
    const rawBody = await req.text();
  
    // 1. Initialize the Receiver
    const receiver = new Receiver({
      currentSigningKey: Deno.env.get("QSTASH_CURRENT_SIGNING_KEY")!,
      nextSigningKey: Deno.env.get("QSTASH_NEXT_SIGNING_KEY")!,
    });
  
    // 2. Verify using the SDK (This handles everything you wrote manually)
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

    try {
    // Parse the body
    const { session_id, secret_token } = JSON.parse(rawBody);

    if (!session_id || !secret_token) {
      console.error("❌ Missing required fields");
      return errorResponse("Missing session_id or secret_token", 400);
    }

    console.log(`📥 Received timer expiration for session: ${session_id}`);

    const supabaseAdmin = createSupabaseAdmin();

    // Verify secret_token exists in pending_timers and is still pending
    const { data: timerRecord, error: timerError } = await supabaseAdmin
      .from("pending_timers")
      .select("*")
      .eq("session_id", session_id)
      .eq("secret_token", secret_token)
      .single();

    if (timerError || !timerRecord) {
      console.error("❌ Timer record not found:", timerError);
      // Return 200 to prevent QStash retries for invalid tokens
      return successResponse({ success: false, reason: "Timer not found" });
    }

    // Check if timer was already processed (idempotency)
    if (timerRecord.status !== "pending") {
      console.log(`⚠️ Timer already processed: ${timerRecord.status}`);
      return successResponse({
        success: true,
        already_processed: true,
        status: timerRecord.status,
      });
    }

    // Get the chat session
    const { data: chatSession, error: chatError } = await supabaseAdmin
      .from("chat_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (chatError || !chatSession) {
      console.error("❌ Chat session not found:", chatError);
      // Mark timer as cancelled since session doesn't exist
      await supabaseAdmin
        .from("pending_timers")
        .update({ status: "cancelled" })
        .eq("id", timerRecord.id);
      return successResponse({ success: false, reason: "Session not found" });
    }

    // Check if session was already completed or cancelled
    if (chatSession.status !== "active") {
      console.log(`⚠️ Session already ${chatSession.status}, skipping auto-approval`);
      await supabaseAdmin
        .from("pending_timers")
        .update({ status: "cancelled" })
        .eq("id", timerRecord.id);
      return successResponse({
        success: true,
        skipped: true,
        reason: `Session is ${chatSession.status}`,
      });
    }

    // Check if both users already approved
    if (chatSession.holder_approved && chatSession.tracker_approved) {
      console.log("⚠️ Both users already approved, skipping");
      await supabaseAdmin
        .from("pending_timers")
        .update({ status: "cancelled" })
        .eq("id", timerRecord.id);
      return successResponse({
        success: true,
        skipped: true,
        reason: "Already approved by both users",
      });
    }

    console.log("🎉 Timer expired! Executing auto-approval for BOTH users...");

    // ========== AUTO-APPROVE FOR BOTH USERS ==========
    // Update chat session to mark both as approved
    const { error: updateError } = await supabaseAdmin
      .from("chat_sessions")
      .update({
        holder_approved: true,
        tracker_approved: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatSession.id);

    if (updateError) {
      console.error("❌ Failed to update approval:", updateError);
      throw new Error(`Failed to update approval: ${updateError.message}`);
    }

    console.log("✅ Both users auto-approved");

    // ========== EXECUTE THE DEAL (same logic as approve-in-chat) ==========
    
    // Get transfer request using the 1:1 mapping from chat_session
    if (!chatSession.transfer_request_id) {
      console.error("❌ No transfer_request_id in chat session");
      throw new Error("Transfer request not linked to chat session");
    }

    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from("transfer_requests")
      .select("*")
      .eq("id", chatSession.transfer_request_id)
      .single();

    if (transferError || !transferRequest) {
      console.error("❌ Transfer request not found:", transferError);
      throw new Error("Transfer request not found");
    }

    // Verify transfer is still pending
    if (transferRequest.status !== "pending") {
      console.error(
        `❌ Transfer request status is ${transferRequest.status}, expected pending`
      );
      await supabaseAdmin
        .from("pending_timers")
        .update({ status: "cancelled" })
        .eq("id", timerRecord.id);
      return successResponse({
        success: false,
        reason: `Transfer already ${transferRequest.status}`,
      });
    }

    // Check if transfer has expired
    const expiration = new Date(transferRequest.expiration);
    if (expiration < new Date()) {
      await supabaseAdmin
        .from("transfer_requests")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", transferRequest.id);

      await supabaseAdmin
        .from("chat_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", chatSession.id);

      await supabaseAdmin
        .from("pending_timers")
        .update({ status: "cancelled" })
        .eq("id", timerRecord.id);

      return successResponse({ success: false, reason: "Transfer expired" });
    }

    // Get receiver's (seller's) balance before transfer
    const balanceBefore = await checkWalletBalance(
      transferRequest.receiver_wallet_id,
      CURRENCY
    );
    console.log(`💰 Seller balance before: ${balanceBefore} ${CURRENCY}`);

    // Accept the transfer in Rapyd (money moves from buyer to seller)
    console.log(`✅ Accepting transfer: ${transferRequest.transfer_id}`);
    const acceptResult = await acceptTransfer(
      transferRequest.transfer_id,
      "accept",
      {
        accepted_at: new Date().toISOString(),
        auto_approved: true,
        timer_expired: true,
        holder_id: chatSession.holder_id,
        tracker_id: chatSession.tracker_id,
      }
    );

    console.log(`✅ Transfer accepted:`, {
      transfer_id: acceptResult.transferId,
      status: acceptResult.status,
    });

    // Get receiver's balance after transfer
    const balanceAfter = await checkWalletBalance(
      transferRequest.receiver_wallet_id,
      CURRENCY
    );
    console.log(`💰 Seller balance after: ${balanceAfter} ${CURRENCY}`);

    // Update transfer request status to accepted
    const { error: transferUpdateError } = await supabaseAdmin
      .from("transfer_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", transferRequest.id);

    if (transferUpdateError) {
      console.error("❌ Failed to update transfer request:", transferUpdateError);
      throw new Error(
        `Failed to update transfer request: ${transferUpdateError.message}`
      );
    }

    // ========== CREATE TRANSACTION RECORD (SUCCESS LOG) ==========
    console.log("📝 Creating transaction record...");

    const netAmount = transferRequest.amount - PLATFORM_FEE;

    try {
      const transactionId = await logTransaction(supabaseAdmin, {
        payerId: transferRequest.sender_id, // Buyer
        receiverId: transferRequest.receiver_id, // Seller
        pinId: transferRequest.pin_id,
        rapydPaymentId: transferRequest.transfer_id,
        amountIls: transferRequest.amount,
        platformFeeIls: PLATFORM_FEE,
        netAmountIls: netAmount,
        status: "CLO", // Closed/Completed
        metadata: {
          chat_session_id: chatSession.id,
          transfer_request_id: transferRequest.id,
          completed_at: new Date().toISOString(),
          auto_approved: true,
          timer_expired: true,
        },
      });
      console.log(`✅ Transaction logged: ${transactionId}`);
    } catch (txError) {
      console.error("⚠️ Failed to create transaction record:", txError);
      // Don't fail the whole operation - money has already transferred
    }

    // ========== PARKING SPOT OWNERSHIP TRANSFER ==========
    console.log("🔄 Transferring parking spot ownership...");

    // Buyer ID is sender_id (person who paid)
    const buyerId = transferRequest.sender_id;
    const pinId = transferRequest.pin_id;

    // Step 1: Delete buyer's OTHER pins (they're now parked at the new spot)
    const { data: deletedPins, error: deleteError } = await supabaseAdmin
      .from("pins")
      .delete()
      .eq("user_id", buyerId)
      .neq("id", pinId) // Don't delete the pin being transferred!
      .select("id");

    if (deleteError) {
      console.error("⚠️ Failed to delete buyer's other pins:", deleteError);
      // Continue anyway - not critical
    } else {
      const deletedCount = deletedPins?.length || 0;
      console.log(`🗑️ Deleted ${deletedCount} of buyer's other pins`);
    }

    // Step 2: Transfer pin ownership to buyer
    const { error: transferPinError } = await supabaseAdmin
      .from("pins")
      .update({
        user_id: buyerId, // Buyer now owns this pin
        reserved_by: null, // Clear reservation
        status: "waiting", // Pin is in waiting state, not posted to other users yet
      })
      .eq("id", pinId);

    if (transferPinError) {
      console.error("❌ Failed to transfer pin ownership:", transferPinError);
      throw new Error(
        `Failed to transfer pin ownership: ${transferPinError.message}`
      );
    }

    console.log(`✅ Pin ${pinId} ownership transferred to buyer ${buyerId}`);
    console.log("✅ Parking spot exchange completed successfully!");

    // ========== UPDATE CHAT SESSION ==========
    const { error: chatUpdateError } = await supabaseAdmin
      .from("chat_sessions")
      .update({
        status: "completed",
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatSession.id);

    if (chatUpdateError) {
      console.error("⚠️ Failed to update chat session:", chatUpdateError);
    }

    // ========== UPDATE TIMER STATUS ==========
    await supabaseAdmin
      .from("pending_timers")
      .update({ status: "completed" })
      .eq("id", timerRecord.id);

    console.log("✅ Deal completed successfully via auto-approval timer");

    return successResponse({
      success: true,
      auto_approved: true,
      session_id: chatSession.id,
      amount_transferred: transferRequest.amount,
      message: "Timer expired. Deal auto-approved and completed.",
    });
  } catch (err) {
    console.error("Error in handle-timer-expiration:", err);
    // Return 200 to prevent infinite retries, but indicate failure
    return successResponse({
      success: false,
      error: (err as Error).message || "Internal server error",
    });
  }
});
  
