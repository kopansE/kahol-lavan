import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    console.log("🔔 Webhook received from Rapyd");

    // Read the webhook payload
    const payload = await req.json();
    console.log("Webhook type:", payload.type);
    console.log("Webhook data:", JSON.stringify(payload, null, 2));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle different webhook types
    if (
      payload.type === "PAYMENT_COMPLETED" ||
      payload.type === "CHECKOUT_PAYMENT_COMPLETED"
    ) {
      console.log("✅ Payment completed webhook");

      const paymentData = payload.data;
      const metadata = paymentData.metadata;
      const userId = metadata?.user_id;

      if (!userId) {
        console.error("⚠️ No user_id in webhook metadata");
        return new Response(
          JSON.stringify({ error: "No user_id in metadata" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Extract payment method info
      const paymentMethodId = paymentData.payment_method;
      const last4 =
        paymentData.payment_method_data?.last4 ||
        paymentData.payment_method_options?.card?.last4 ||
        null;
      const cardBrand =
        paymentData.payment_method_data?.type ||
        paymentData.payment_method_options?.card?.brand ||
        null;

      console.log("💳 Payment method:", paymentMethodId);
      console.log("💳 Last 4 digits:", last4);
      console.log("💳 Card brand:", cardBrand);

      // Update user's payment method in database
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          rapyd_payment_method_id: paymentMethodId,
          payment_method_last_4: last4,
          payment_method_brand: cardBrand,
        })
        .eq("id", userId);

      if (updateError) {
        console.error("❌ Failed to update user payment method:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update payment method" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("✅ Updated payment method for user:", userId);
    } else if (payload.type === "CHECKOUT_CANCELED") {
      console.log("⚠️ Checkout cancelled");
    } else if (payload.type === "PAYMENT_FAILED") {
      console.error("❌ Payment failed:", payload.data);
    } else {
      console.log("ℹ️ Unhandled webhook type:", payload.type);
    }

    // Always respond with 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ received: true, type: payload.type }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Webhook error:", error);
    // Still return 200 so Rapyd doesn't retry
    return new Response(
      JSON.stringify({ error: error.message, received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
