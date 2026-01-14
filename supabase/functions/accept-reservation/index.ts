import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import {
  acceptTransfer,
  checkWalletBalance,
} from "../_shared/rapyd-utils.ts";

const CURRENCY = "ILS";

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
      return errorResponse("You are not authorized to accept this reservation", 403);
    }

    // Verify transfer is still pending
    if (transferRequest.status !== "pending") {
      return errorResponse(`Transfer request is already ${transferRequest.status}`, 400);
    }

    // Check if transfer has expired
    const expiration = new Date(transferRequest.expiration);
    if (expiration < new Date()) {
      // Update status to expired
      await supabaseAdmin
        .from("transfer_requests")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", transfer_request_id);

      return errorResponse("Transfer request has expired", 400);
    }

    // Get receiver's balance before transfer
    const balanceBefore = await checkWalletBalance(
      transferRequest.receiver_wallet_id,
      CURRENCY
    );
    console.log(`💰 Receiver balance before: ${balanceBefore} ${CURRENCY}`);

    // Accept the transfer in Rapyd
    console.log(`✅ Accepting transfer: ${transferRequest.transfer_id}`);
    const acceptResult = await acceptTransfer(
      transferRequest.transfer_id,
      "accept",
      {
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
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
    console.log(`💰 Receiver balance after: ${balanceAfter} ${CURRENCY}`);

    // Update transfer request status
    const { error: updateError } = await supabaseAdmin
      .from("transfer_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", transfer_request_id);

    if (updateError) {
      console.error("❌ Failed to update transfer request:", updateError);
      throw new Error(`Failed to update transfer request: ${updateError.message}`);
    }

    // Update transaction status to completed
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .update({ status: "completed" })
      .eq("rapyd_payment_id", transferRequest.transfer_id);

    if (transactionError) {
      console.error("❌ Failed to update transaction:", transactionError);
    }

    console.log("✅ Reservation accepted successfully");

    return successResponse({
      success: true,
      transfer_id: transferRequest.transfer_id,
      amount_received: transferRequest.amount,
      new_balance: balanceAfter,
      balance_increase: balanceAfter - balanceBefore,
      message: "Reservation accepted! Funds transferred to your wallet.",
    });
  } catch (err) {
    console.error("Error in accept-reservation:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
