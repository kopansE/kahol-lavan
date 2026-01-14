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
    const { transfer_request_id } = await req.json();

    if (!transfer_request_id) {
      return errorResponse("transfer_request_id is required", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Get transfer request details
    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from("transfer_requests")
      .select("*")
      .eq("id", transfer_request_id)
      .single();

    if (transferError || !transferRequest) {
      return errorResponse("Transfer request not found", 404);
    }

    // Verify user is the receiver
    if (transferRequest.receiver_id !== user.id) {
      return errorResponse("You are not authorized to decline this reservation", 403);
    }

    // Verify transfer is still pending
    if (transferRequest.status !== "pending") {
      return errorResponse(`Transfer request is already ${transferRequest.status}`, 400);
    }

    // Decline the transfer in Rapyd (money returns to sender)
    console.log(`❌ Declining transfer: ${transferRequest.transfer_id}`);
    const declineResult = await acceptTransfer(
      transferRequest.transfer_id,
      "decline",
      {
        declined_at: new Date().toISOString(),
        declined_by: user.id,
      }
    );

    console.log(`✅ Transfer declined:`, {
      transfer_id: declineResult.transferId,
      status: declineResult.status,
    });

    // Update transfer request status
    const { error: updateError } = await supabaseAdmin
      .from("transfer_requests")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", transfer_request_id);

    if (updateError) {
      console.error("❌ Failed to update transfer request:", updateError);
      throw new Error(`Failed to update transfer request: ${updateError.message}`);
    }

    // Update transaction status to cancelled
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("rapyd_payment_id", transferRequest.transfer_id);

    if (transactionError) {
      console.error("❌ Failed to update transaction:", transactionError);
    }

    // Update pin status back to active
    const { error: pinError } = await supabaseAdmin
      .from("pins")
      .update({ status: "active", reserved_by: null })
      .eq("id", transferRequest.pin_id);

    if (pinError) {
      console.error("❌ Failed to update pin status:", pinError);
    }

    console.log("✅ Reservation declined successfully");

    return successResponse({
      success: true,
      transfer_id: transferRequest.transfer_id,
      amount_refunded: transferRequest.amount,
      message: "Reservation declined. Funds returned to the sender.",
    });
  } catch (err) {
    console.error("Error in decline-reservation:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
