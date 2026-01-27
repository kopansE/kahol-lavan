import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import { acceptTransfer, checkWalletBalance, logTransaction } from "../_shared/rapyd-utils.ts";

const CURRENCY = "ILS";
const PLATFORM_FEE = 0;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const { session_id } = await req.json();

    if (!session_id) {
      return errorResponse("session_id is required", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Get chat session by ID directly
    const { data: chatSession, error: chatError } = await supabaseAdmin
      .from("chat_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (chatError || !chatSession) {
      console.error("❌ Chat session not found:", chatError);
      return errorResponse("Chat session not found", 404);
    }

    // Verify user is part of this chat
    if (chatSession.holder_id !== user.id && chatSession.tracker_id !== user.id) {
      return errorResponse("You are not authorized to approve this reservation", 403);
    }

    // Check if chat session is still active
    if (chatSession.status !== "active") {
      return errorResponse(
        `Chat session is ${chatSession.status}. Cannot approve.`,
        400
      );
    }

    // Determine if user is holder (buyer) or tracker (seller)
    const isHolder = chatSession.holder_id === user.id;
    const approvalField = isHolder ? "holder_approved" : "tracker_approved";

    // Check if user already approved
    if (chatSession[approvalField]) {
      return successResponse({
        success: true,
        already_approved: true,
        user_approved: true,
        other_user_approved: isHolder
          ? chatSession.tracker_approved
          : chatSession.holder_approved,
        both_approved: chatSession.holder_approved && chatSession.tracker_approved,
        message: "You have already approved this reservation.",
      });
    }

    // Update approval flag
    const updateData: Record<string, any> = {
      [approvalField]: true,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("chat_sessions")
      .update(updateData)
      .eq("id", chatSession.id);

    if (updateError) {
      console.error("❌ Failed to update approval:", updateError);
      throw new Error(`Failed to update approval: ${updateError.message}`);
    }

    // Check if both users have now approved
    const otherUserApproved = isHolder
      ? chatSession.tracker_approved
      : chatSession.holder_approved;
    const bothApproved = otherUserApproved; // Other was already approved, we just approved

    console.log(`✅ User ${user.id} approved. Both approved: ${bothApproved}`);

    // If both approved, execute the deal
    if (bothApproved) {
      console.log("🎉 Both users approved! Executing deal...");

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
        console.error(`❌ Transfer request status is ${transferRequest.status}, expected pending`);
        throw new Error(`Transfer request is already ${transferRequest.status}`);
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

        return errorResponse("Transfer request has expired", 400);
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
          accepted_by_both: true,
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
          payerId: transferRequest.sender_id,    // Buyer
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
          user_id: buyerId,       // Buyer now owns this pin
          reserved_by: null,      // Clear reservation
          status: "waiting",       // Pin is active (buyer might leave later)
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

      console.log("✅ Deal completed successfully via chat");

      return successResponse({
        success: true,
        user_approved: true,
        other_user_approved: true,
        both_approved: true,
        reservation_completed: true,
        amount_transferred: transferRequest.amount,
        new_balance: balanceAfter,
        balance_increase: balanceAfter - balanceBefore,
        message:
          "Deal completed! Both users approved. Parking spot has been transferred.",
      });
    }

    // Only one user has approved so far
    return successResponse({
      success: true,
      user_approved: true,
      other_user_approved: false,
      both_approved: false,
      message: "Your approval recorded. Waiting for the other user to approve.",
    });
  } catch (err) {
    console.error("Error in approve-in-chat:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
