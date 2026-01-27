import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import { acceptTransfer } from "../_shared/rapyd-utils.ts";

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
      return errorResponse(
        "You are not authorized to cancel this reservation",
        403
      );
    }

    // Check if chat session is still active
    if (chatSession.status !== "active") {
      return errorResponse(
        `Chat session is already ${chatSession.status}. Cannot cancel.`,
        400
      );
    }

    // Determine if user is holder (buyer) or tracker (seller)
    const isHolder = chatSession.holder_id === user.id;
    const cancellationField = isHolder ? "holder_cancelled" : "tracker_cancelled";

    // Update cancellation flag
    const updateData: Record<string, any> = {
      [cancellationField]: true,
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("chat_sessions")
      .update(updateData)
      .eq("id", chatSession.id);

    if (updateError) {
      console.error("❌ Failed to update cancellation:", updateError);
      throw new Error(`Failed to update cancellation: ${updateError.message}`);
    }

    console.log(`❌ User ${user.id} cancelled reservation. Executing decline logic...`);

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

    // Decline the transfer in Rapyd (money returns to sender/buyer)
    console.log(`❌ Declining transfer: ${transferRequest.transfer_id}`);
    const declineResult = await acceptTransfer(
      transferRequest.transfer_id,
      "decline",
      {
        declined_at: new Date().toISOString(),
        declined_by: user.id,
        cancelled_via_chat: true,
      }
    );

    console.log(`✅ Transfer declined:`, {
      transfer_id: declineResult.transferId,
      status: declineResult.status,
    });

    // Update transfer request status to cancelled
    const { error: transferUpdateError } = await supabaseAdmin
      .from("transfer_requests")
      .update({
        status: "cancelled",
        responded_at: new Date().toISOString(),
      })
      .eq("id", transferRequest.id);

    if (transferUpdateError) {
      console.error("❌ Failed to update transfer request:", transferUpdateError);
      throw new Error(
        `Failed to update transfer request: ${transferUpdateError.message}`
      );
    }

    // Note: No transaction record to update since transactions are only created on success

    // Update pin status back to active
    const { error: pinError } = await supabaseAdmin
      .from("pins")
      .update({ status: "active", reserved_by: null })
      .eq("id", transferRequest.pin_id);

    if (pinError) {
      console.error("⚠️ Failed to update pin status:", pinError);
      // Don't fail - pin might have been deleted
    }

    console.log("✅ Reservation cancelled successfully via chat");

    return successResponse({
      success: true,
      cancelled: true,
      transfer_id: transferRequest.transfer_id,
      amount_refunded: transferRequest.amount,
      message: "Reservation cancelled. Funds have been returned to the buyer.",
    });
  } catch (err) {
    console.error("Error in cancel-in-chat:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
