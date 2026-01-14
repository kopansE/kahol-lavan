import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import {
  checkWalletBalance,
  addFundsToWallet,
  transferFundsBetweenWallets,
  logTransaction,
} from "../_shared/rapyd-utils.ts";

const RESERVATION_AMOUNT = 50;
const CURRENCY = "ILS";
const PLATFORM_FEE = 0;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const { pin_id } = await req.json();

    if (!pin_id) {
      return errorResponse("pin_id is required", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Get pin details
    const { data: pinData, error: pinError } = await supabaseAdmin
      .from("pins")
      .select("user_id, status, reserved_by")
      .eq("id", pin_id)
      .single();

    if (pinError || !pinData) {
      return errorResponse("Pin not found", 404);
    }

    console.log("📌 Pin data:", {
      pin_id,
      owner_id: pinData.user_id,
      reserved_by: pinData.reserved_by,
      status: pinData.status,
      canceling_user: user.id,
    });

    if (pinData.status !== "reserved") {
      return errorResponse("Pin is not reserved", 400);
    }

    // Check if user is either the parking owner or the reserving user
    const isOwner = pinData.user_id === user.id;
    const isReserver = pinData.reserved_by === user.id;

    if (!isOwner && !isReserver) {
      return errorResponse(
        "You are not authorized to cancel this reservation",
        403
      );
    }

    if (!pinData.reserved_by) {
      return errorResponse("Reservation data is invalid", 400);
    }

    // Get owner's wallet (sender - will send money back)
    const { data: ownerData, error: ownerError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id, email")
      .eq("id", pinData.user_id)
      .single();

    if (ownerError || !ownerData || !ownerData.rapyd_wallet_id) {
      console.error("Owner data error:", ownerError);
      return errorResponse("Parking owner's wallet not found", 400);
    }

    console.log("💼 Owner wallet:", {
      email: ownerData.email,
      wallet_id: ownerData.rapyd_wallet_id,
    });

    // Get reserver's wallet (receiver - will get money back)
    const { data: reserverData, error: reserverError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id, email")
      .eq("id", pinData.reserved_by)
      .single();

    if (reserverError || !reserverData || !reserverData.rapyd_wallet_id) {
      console.error("Reserver data error:", reserverError);
      return errorResponse("Reserving user's wallet not found", 400);
    }

    console.log("💼 Reserver wallet:", {
      email: reserverData.email,
      wallet_id: reserverData.rapyd_wallet_id,
    });

    // Check owner's wallet balance
    const ownerBalance = await checkWalletBalance(
      ownerData.rapyd_wallet_id,
      CURRENCY
    );

    console.log(
      `💰 Owner wallet balance: ${ownerBalance} ${CURRENCY} (needs ${RESERVATION_AMOUNT} ${CURRENCY} for refund)`
    );

    // If owner doesn't have enough balance to refund, add funds to their wallet
    // This shouldn't happen if the reservation worked correctly
    if (ownerBalance < RESERVATION_AMOUNT) {
      const amountToAdd = RESERVATION_AMOUNT - ownerBalance;
      console.warn(
        `⚠️ Owner wallet has insufficient funds! This suggests the original reservation payment didn't go through correctly.`
      );
      console.log(
        `💳 Adding ${amountToAdd} ${CURRENCY} to owner's wallet for refund (this will charge the owner's payment method)`
      );

      try {
        await addFundsToWallet(
          ownerData.rapyd_wallet_id,
          amountToAdd,
          CURRENCY
        );
        console.log(`✅ Funds added to owner's wallet`);
      } catch (addFundsError) {
        console.error(
          "❌ Failed to add funds to owner's wallet:",
          addFundsError
        );
        throw new Error(
          `Cannot process refund: Owner wallet has insufficient balance (${ownerBalance} ${CURRENCY}) and failed to add funds. Original error: ${addFundsError.message}`
        );
      }
    } else {
      console.log(`✅ Owner wallet has sufficient funds for refund`);
    }

    // Transfer funds back from owner to reserver (refund)
    const transferResult = await transferFundsBetweenWallets(
      ownerData.rapyd_wallet_id,
      reserverData.rapyd_wallet_id,
      RESERVATION_AMOUNT,
      CURRENCY,
      {
        description: `Parking reservation cancellation refund`,
        pin_id: pin_id,
        sender_user_id: pinData.user_id,
        receiver_user_id: pinData.reserved_by,
      }
    );

    // Calculate amounts
    const netAmount = RESERVATION_AMOUNT - PLATFORM_FEE;

    // Log refund transaction to database
    await logTransaction(supabaseAdmin, {
      payerId: pinData.user_id, // Owner pays back
      receiverId: pinData.reserved_by, // Reserver receives refund
      pinId: pin_id,
      rapydPaymentId: transferResult.transferId,
      amountIls: RESERVATION_AMOUNT,
      platformFeeIls: PLATFORM_FEE,
      netAmountIls: netAmount,
      status: transferResult.status,
      metadata: {
        source_transaction_id: transferResult.sourceTransactionId,
        destination_transaction_id: transferResult.destinationTransactionId,
        transaction_type: "refund",
      },
    });

    // Update pin status back to active and clear reserved_by
    console.log("📌 Updating pin status back to active:", pin_id);
    const { error: updateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "active", reserved_by: null })
      .eq("id", pin_id);

    if (updateError) {
      console.error("❌ Failed to update pin status:", updateError);
      throw new Error(`Failed to update pin status: ${updateError.message}`);
    }

    console.log("✅ Pin status updated successfully");

    return successResponse({
      success: true,
      transfer_id: transferResult.transferId,
      refund_amount: RESERVATION_AMOUNT,
      message: "Reservation cancelled successfully! Full refund issued.",
    });
  } catch (err) {
    console.error("Error in cancel-reservation:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
