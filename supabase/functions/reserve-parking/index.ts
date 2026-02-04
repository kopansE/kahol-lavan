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
} from "../_shared/rapyd-utils.ts";

const RESERVATION_AMOUNT = 50;
const CURRENCY = "ILS";

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

    // Check if user already has an active reservation
    const { data: existingReservation, error: reservationCheckError } =
      await supabaseAdmin
        .from("pins")
        .select("id")
        .eq("reserved_by", user.id)
        .eq("status", "reserved")
        .maybeSingle();

    if (reservationCheckError) {
      console.error(
        "Error checking existing reservations:",
        reservationCheckError
      );
      return errorResponse("Failed to check existing reservations", 500);
    }

    if (existingReservation) {
      return errorResponse(
        "You already have an active reservation. Please cancel it before reserving another spot.",
        400
      );
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

    console.log(
      `💰 Reserver wallet balance: ${currentBalance} ${CURRENCY} (needs ${RESERVATION_AMOUNT} ${CURRENCY})`
    );

    // If insufficient balance, add funds
    if (currentBalance < RESERVATION_AMOUNT) {
      const amountToAdd = RESERVATION_AMOUNT - currentBalance;
      console.log(`💳 Adding ${amountToAdd} ${CURRENCY} to reserver's wallet`);
      await addFundsToWallet(senderData.rapyd_wallet_id, amountToAdd, CURRENCY);
      console.log(`✅ Funds added successfully`);
    }

    // Check receiver's initial balance
    const receiverInitialBalance = await checkWalletBalance(
      receiverData.rapyd_wallet_id,
      CURRENCY
    );
    console.log(
      `💼 Owner's wallet balance before transfer: ${receiverInitialBalance} ${CURRENCY}`
    );

    // Initiate transfer between wallets (status will be PEN - pending)
    console.log(
      `💸 Initiating transfer of ${RESERVATION_AMOUNT} ${CURRENCY} from reserver → owner (PENDING approval)`
    );
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

    console.log(`✅ Transfer initiated:`, {
      transfer_id: transferResult.transferId,
      status: transferResult.status,
    });

    // Calculate expiration (24 hours from now)
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 24);

    // Create transfer request record for notification
    const { data: transferRequestData, error: transferRequestError } = await supabaseAdmin
      .from("transfer_requests")
      .insert({
        transfer_id: transferResult.transferId,
        pin_id: pin_id,
        sender_id: user.id,
        receiver_id: pinData.user_id,
        amount: RESERVATION_AMOUNT,
        currency: CURRENCY,
        status: "pending",
        sender_wallet_id: senderData.rapyd_wallet_id,
        receiver_wallet_id: receiverData.rapyd_wallet_id,
        expiration: expirationDate.toISOString(),
        metadata: {
          source_transaction_id: transferResult.sourceTransactionId,
          destination_transaction_id: transferResult.destinationTransactionId,
        },
      })
      .select("id")
      .single();

    if (transferRequestError || !transferRequestData) {
      console.error("❌ Failed to create transfer request:", transferRequestError);
      throw new Error(`Failed to create transfer request: ${transferRequestError?.message || "No data returned"}`);
    }

    const transferRequestId = transferRequestData.id;
    console.log(`✅ Transfer request created with ID: ${transferRequestId}`);

    // Note: Transaction record is NOT created here
    // It will be created by approve-in-chat when both users approve (success only)

    // Update pin status to reserved with reserved_by
    console.log("📌 Updating pin status to reserved (pending approval):", pin_id);
    const { error: updateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "reserved", reserved_by: user.id })
      .eq("id", pin_id);

    if (updateError) {
      console.error("❌ Failed to update pin status:", updateError);
      throw new Error(`Failed to update pin status: ${updateError.message}`);
    }

    console.log("✅ Reservation request created - waiting for owner approval");

    // Create chat channel for the reservation
    let sessionId: string | null = null;
    try {
      console.log("💬 Creating chat channel for reservation");
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
          holder_id: user.id, // Parker (person reserving)
          tracker_id: pinData.user_id, // Spot owner
          transfer_request_id: transferRequestId, // Link session to this specific reservation
        }),
      });

      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        console.log(`✅ Chat channel created: ${channelData.channel_id}`);
        sessionId = channelData.session_id;
      } else {
        const errorText = await channelResponse.text();
        console.error("⚠️ Failed to create chat channel:", errorText);
        // Don't fail the reservation if chat creation fails
      }
    } catch (chatError) {
      console.error("⚠️ Error creating chat channel:", chatError);
      // Don't fail the reservation if chat creation fails
    }

    // Schedule the auto-approval timer (QStash)
    if (sessionId) {
      try {
        console.log("⏰ Scheduling auto-approval timer");
        const scheduleTimerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/schedule-approval-timer`;
        const authHeader = req.headers.get("Authorization");

        const timerResponse = await fetch(scheduleTimerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader || "",
          },
          body: JSON.stringify({
            session_id: sessionId,
          }),
        });

        if (timerResponse.ok) {
          const timerData = await timerResponse.json();
          console.log(`✅ Auto-approval timer scheduled: ${timerData.timer_id}, expires at: ${timerData.expires_at}`);
        } else {
          const errorText = await timerResponse.text();
          console.error("⚠️ Failed to schedule timer:", errorText);
          // Don't fail the reservation if timer scheduling fails
        }
      } catch (timerError) {
        console.error("⚠️ Error scheduling timer:", timerError);
        // Don't fail the reservation if timer scheduling fails
      }
    } else {
      console.warn("⚠️ No session_id available, skipping timer scheduling");
    }

    return successResponse({
      success: true,
      transfer_id: transferResult.transferId,
      amount: RESERVATION_AMOUNT,
      status: "pending_approval",
      message: "Reservation request sent! Waiting for parking owner to accept.",
    });
  } catch (err) {
    console.error("Error in reserve-parking:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
