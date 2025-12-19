import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts";

const RAPYD_ACCESS_KEY = Deno.env.get("RAPYD_ACCESS_KEY")!;
const RAPYD_SECRET_KEY = Deno.env.get("RAPYD_SECRET_KEY")!;
const RAPYD_BASE_URL =
  Deno.env.get("RAPYD_API_BASE_URL") || "https://sandboxapi.rapyd.net";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateSignature(
  method: string,
  path: string,
  salt: string,
  timestamp: string,
  body: string
) {
  const bodyString = body === "{}" || body === "" ? "" : body;
  const toSign =
    method.toLowerCase() +
    path +
    salt +
    timestamp +
    RAPYD_ACCESS_KEY +
    RAPYD_SECRET_KEY +
    bodyString;
  const hash = crypto.createHmac("sha256", RAPYD_SECRET_KEY);
  hash.update(toSign);
  return btoa(hash.digest("hex"));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pin_id } = await req.json();

    if (!pin_id) {
      return new Response(JSON.stringify({ error: "pin_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the pin details including the owner's user_id
    const { data: pinData, error: pinError } = await supabaseAdmin
      .from("pins")
      .select("user_id, status")
      .eq("id", pin_id)
      .single();

    if (pinError || !pinData) {
      return new Response(JSON.stringify({ error: "Pin not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pinData.status !== "active") {
      return new Response(JSON.stringify({ error: "Pin is not active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent users from reserving their own parking
    if (pinData.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Cannot reserve your own parking" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the current user's (sender) payment info
    const { data: senderData, error: senderError } = await supabaseAdmin
      .from("users")
      .select("rapyd_customer_id")
      .eq("id", user.id)
      .single();

    if (senderError || !senderData || !senderData.rapyd_customer_id) {
      return new Response(
        JSON.stringify({
          error:
            "Payment method not set up. Please add a payment method first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the receiver's (parking owner) wallet info
    const { data: receiverData, error: receiverError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id")
      .eq("id", pinData.user_id)
      .single();

    if (receiverError || !receiverData || !receiverData.rapyd_wallet_id) {
      return new Response(
        JSON.stringify({
          error: "Parking owner's wallet not found",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the sender's payment methods to find their card
    const listPaymentMethodsPath = `/v1/customers/${senderData.rapyd_customer_id}/payment_methods`;
    const listSalt = crypto.randomBytes(12).toString("hex");
    const listTimestamp = Math.floor(Date.now() / 1000).toString();
    const listSignature = generateSignature(
      "get",
      listPaymentMethodsPath,
      listSalt,
      listTimestamp,
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
      return new Response(
        JSON.stringify({
          error: "No payment method found. Please add a card first.",
          details: paymentMethodsResult.status.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

    const signature = generateSignature("post", path, salt, timestamp, body);

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
      return new Response(
        JSON.stringify({
          error: result.status.message || "Payment failed",
          details: result.status.error_code,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update the pin status to "reserved" or create a reservation record
    // (You might want to add a reservations table or update the pin status)
    const { error: updateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "reserved", reserved_by: user.id })
      .eq("id", pin_id);

    if (updateError) {
      console.error("Failed to update pin status:", updateError);
      // Don't fail the request since payment succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: result.data.id,
        amount_paid: amount,
        destination_wallet: receiverData.rapyd_wallet_id,
        message: "Parking reserved successfully!",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in reserve-parking:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
