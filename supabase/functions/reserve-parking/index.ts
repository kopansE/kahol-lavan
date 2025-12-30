import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import {
  makeRapydRequest,
  generateRapydSignature,
} from "../_shared/rapyd-utils.ts";
import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts";

const RAPYD_ACCESS_KEY = Deno.env.get("RAPYD_ACCESS_KEY")!;
const RAPYD_SECRET_KEY = Deno.env.get("RAPYD_SECRET_KEY")!;
const RAPYD_BASE_URL =
  Deno.env.get("RAPYD_API_BASE_URL") || "https://sandboxapi.rapyd.net";

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

    // Get the pin details including the owner's user_id
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

    // Prevent users from reserving their own parking
    if (pinData.user_id === user.id) {
      return errorResponse("Cannot reserve your own parking", 400);
    }

    // Get the current user's (sender) payment info
    const { data: senderData, error: senderError } = await supabaseAdmin
      .from("users")
      .select("rapyd_customer_id")
      .eq("id", user.id)
      .single();

    if (senderError || !senderData || !senderData.rapyd_customer_id) {
      return errorResponse(
        "Payment method not set up. Please add a payment method first.",
        400
      );
    }

    // Get the receiver's (parking owner) wallet info
    const { data: receiverData, error: receiverError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id")
      .eq("id", pinData.user_id)
      .single();

    if (receiverError || !receiverData || !receiverData.rapyd_wallet_id) {
      return errorResponse("Parking owner's wallet not found", 400);
    }

    // Get the sender's payment methods to find their card
    const listPaymentMethodsPath = `/v1/customers/${senderData.rapyd_customer_id}/payment_methods`;
    const listSalt = crypto.randomBytes(12).toString("hex");
    const listTimestamp = Math.floor(Date.now() / 1000).toString();
    const listSignature = generateRapydSignature(
      "get",
      listPaymentMethodsPath,
      listSalt,
      listTimestamp,
      RAPYD_ACCESS_KEY,
      RAPYD_SECRET_KEY,
      ""
    );

    const paymentMethodsResponse = await fetch(
      `${RAPYD_BASE_URL}${listPaymentMethodsPath}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          access_key: RAPYD_ACCESS_KEY,
          salt: listSalt,
          timestamp: listTimestamp,
          signature: listSignature,
        },
      }
    );

    const paymentMethodsResult = await paymentMethodsResponse.json();

    if (
      paymentMethodsResult.status.status !== "SUCCESS" ||
      !paymentMethodsResult.data ||
      paymentMethodsResult.data.length === 0
    ) {
      return errorResponse(
        "No payment method found. Please add a card first.",
        400
      );
    }

    // Use the first available payment method
    const cardId = paymentMethodsResult.data[0].id;

    // Create the payment from sender to receiver
    const amount = 50; // 50 ILS
    const path = "/v1/payments";
    const salt = crypto.randomBytes(12).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const body = JSON.stringify({
      amount: amount,
      currency: "ILS",
      customer: senderData.rapyd_customer_id,
      payment_method: cardId,
      capture: true,
      ewallets: [
        {
          ewallet: receiverData.rapyd_wallet_id,
          percentage: 100,
        },
      ],
      metadata: {
        description: `Parking reservation from ${user.email} to pin owner`,
        pin_id: pin_id,
        sender_user_id: user.id,
        receiver_user_id: pinData.user_id,
      },
    });

    const signature = generateRapydSignature(
      "post",
      path,
      salt,
      timestamp,
      RAPYD_ACCESS_KEY,
      RAPYD_SECRET_KEY,
      body
    );

    const response = await fetch(`${RAPYD_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt: salt,
        timestamp: timestamp,
        signature: signature,
      },
      body: body,
    });

    const result = await response.json();

    if (result.status.status !== "SUCCESS") {
      return errorResponse(
        result.status.message || "Payment failed",
        400
      );
    }

    // Update the pin status to "reserved"
    const { error: updateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "reserved", reserved_by: user.id })
      .eq("id", pin_id);

    if (updateError) {
      console.error("Failed to update pin status:", updateError);
      // Don't fail the request since payment succeeded
    }

    return successResponse({
      success: true,
      payment_id: result.data.id,
      amount_paid: amount,
      destination_wallet: receiverData.rapyd_wallet_id,
      message: "Parking reserved successfully!",
    });
  } catch (err) {
    console.error("Error in reserve-parking:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
