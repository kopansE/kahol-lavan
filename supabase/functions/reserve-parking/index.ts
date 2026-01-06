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
      .select("user_id, status")
      .eq("id", pin_id)
      .single();

    if (pinError || !pinData) {
      return errorResponse("Pin not found", 404);
    }

    if (pinData.status !== "active") {
      return errorResponse("Pin is not active", 400);
    }

    if (pinData.user_id === user.id) {
      return errorResponse("Cannot reserve your own parking", 400);
    }

    // Get sender's wallet
    const { data: senderData, error: senderError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id")
      .eq("id", user.id)
      .single();

    if (senderError || !senderData || !senderData.rapyd_wallet_id) {
      return errorResponse(
        "Wallet not set up. Please complete your wallet setup first.",
        400
      );
    }

    // Get receiver's wallet
    const { data: receiverData, error: receiverError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id")
      .eq("id", pinData.user_id)
      .single();

    if (receiverError || !receiverData || !receiverData.rapyd_wallet_id) {
      return errorResponse("Parking owner's wallet not found", 400);
    }

    // Check sender's wallet balance
    const currentBalance = await checkWalletBalance(
      senderData.rapyd_wallet_id,
      CURRENCY
    );

    // If insufficient balance, add funds
    if (currentBalance < RESERVATION_AMOUNT) {
      const amountToAdd = RESERVATION_AMOUNT - currentBalance;
      await addFundsToWallet(senderData.rapyd_wallet_id, amountToAdd, CURRENCY);
    }

    // Transfer funds between wallets
    const transferResult = await transferFundsBetweenWallets(
      senderData.rapyd_wallet_id,
      receiverData.rapyd_wallet_id,
      RESERVATION_AMOUNT,
      CURRENCY,
      {
        description: `Parking reservation from ${user.email}`,
        pin_id: pin_id,
        sender_user_id: user.id,
        receiver_user_id: pinData.user_id,
      }
    );

    // Calculate amounts
    const netAmount = RESERVATION_AMOUNT - PLATFORM_FEE;

    // Log transaction to database
    await logTransaction(supabaseAdmin, {
      payerId: user.id,
      receiverId: pinData.user_id,
      pinId: pin_id,
      rapydPaymentId: transferResult.transferId,
      amountIls: RESERVATION_AMOUNT,
      platformFeeIls: PLATFORM_FEE,
      netAmountIls: netAmount,
      status: transferResult.status,
      metadata: {
        source_transaction_id: transferResult.sourceTransactionId,
        destination_transaction_id: transferResult.destinationTransactionId,
      },
    });

    // Update pin status to reserved
    console.log("📌 Updating pin status to reserved:", pin_id);
    const { error: updateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "reserved", reserved_by: user.id })
      .eq("id", pin_id);

    if (updateError) {
      console.error("❌ Failed to update pin status:", updateError);
      throw new Error(`Failed to update pin status: ${updateError.message}`);
    }

    console.log("✅ Pin status updated successfully");

    return successResponse({
      success: true,
      transfer_id: transferResult.transferId,
      amount_paid: RESERVATION_AMOUNT,
      destination_wallet: receiverData.rapyd_wallet_id,
      message: "Parking reserved successfully!",
    });
  } catch (err) {
    console.error("Error in reserve-parking:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
