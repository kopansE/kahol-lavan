import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import { acceptTransfer, checkWalletBalance } from "../_shared/rapyd-utils.ts";

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
      return errorResponse(
        "You are not authorized to accept this reservation",
        403
      );
    }

    // Verify transfer is still pending
    if (transferRequest.status !== "pending") {
      return errorResponse(
        `Transfer request is already ${transferRequest.status}`,
        400
      );
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
      throw new Error(
        `Failed to update transfer request: ${updateError.message}`
      );
    }

    // Update transaction status to completed
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .update({ status: "completed" })
      .eq("rapyd_payment_id", transferRequest.transfer_id);

    if (transactionError) {
      console.error("❌ Failed to update transaction:", transactionError);
    }

    // ========== PARKING SPOT EXCHANGE LOGIC ==========
    console.log("🔄 Starting parking spot exchange...");

    // Step 1: Get pin details
    const { data: pinData, error: pinError } = await supabaseAdmin
      .from("pins")
      .select("position, parking_zone, user_id")
      .eq("id", transferRequest.pin_id)
      .single();

    if (pinError || !pinData) {
      console.error("❌ Failed to fetch pin details:", pinError);
      throw new Error(`Failed to fetch pin details: ${pinError?.message}`);
    }

    console.log(`📍 Pin details fetched for pin ${transferRequest.pin_id}`);

    // Step 2: Delete User B's existing pins (User B is giving up their spot)
    const { error: deleteError } = await supabaseAdmin
      .from("pins")
      .delete()
      .eq("user_id", transferRequest.sender_id);

    if (deleteError) {
      console.error("❌ Failed to delete User B's existing pins:", deleteError);
      throw new Error(`Failed to delete User B's pins: ${deleteError.message}`);
    }

    console.log(
      `🗑️ Deleted User B's existing pins (user: ${transferRequest.sender_id})`
    );

    // Step 3: Transfer pin ownership to User B
    const { error: transferPinError } = await supabaseAdmin
      .from("pins")
      .update({
        user_id: transferRequest.sender_id, // User B takes ownership
        reserved_by: null, // Clear reservation
        status: "waiting", // User B is now parked there
      })
      .eq("id", transferRequest.pin_id);

    if (transferPinError) {
      console.error("❌ Failed to transfer pin ownership:", transferPinError);
      throw new Error(
        `Failed to transfer pin ownership: ${transferPinError.message}`
      );
    }

    console.log(
      `✅ Pin ownership transferred to User B (pin: ${transferRequest.pin_id})`
    );
    console.log(
      `📍 User B now has pin at location: ${JSON.stringify(pinData.position)}`
    );
    console.log("✅ Parking spot exchange completed successfully!");

    // ========== END PARKING SPOT EXCHANGE ==========

    console.log("✅ Reservation accepted successfully");

    return successResponse({
      success: true,
      transfer_id: transferRequest.transfer_id,
      amount_received: transferRequest.amount,
      new_balance: balanceAfter,
      balance_increase: balanceAfter - balanceBefore,
      parking_exchanged: true,
      message: "Reservation accepted! User has taken over your parking spot.",
    });
  } catch (err) {
    console.error("Error in accept-reservation:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
