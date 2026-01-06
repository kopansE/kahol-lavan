import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import { makeRapydRequest } from "../_shared/rapyd-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const supabaseAdmin = createSupabaseAdmin();

    console.log("🔍 Completing payment setup for user:", user.id);

    // Get user data from database
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userDataError) {
      return errorResponse("Failed to fetch user data", 500);
    }

    let customerId = userData.rapyd_customer_id;
    const checkoutId = userData.rapyd_checkout_id;

    // If no customer ID, fetch it from the checkout
    if (!customerId && checkoutId) {
      console.log(
        "📋 No customer ID found, fetching from checkout:",
        checkoutId
      );

      try {
        const checkoutResponse = await makeRapydRequest(
          "get",
          `/v1/checkout/${checkoutId}`
        );

        customerId = checkoutResponse.data.customer;

        if (customerId) {
          console.log("✅ Customer ID retrieved from checkout:", customerId);

          // Save customer ID to database
          const { error: saveCustomerError } = await supabaseAdmin
            .from("users")
            .update({
              rapyd_customer_id: customerId,
            })
            .eq("id", user.id);

          if (saveCustomerError) {
            console.error("❌ Failed to save customer ID:", saveCustomerError);
          }
        }
      } catch (error) {
        console.error("❌ Failed to fetch checkout:", error);
      }
    }

    if (!customerId) {
      return errorResponse(
        "Customer ID not found. Please try payment setup again.",
        400
      );
    }

    console.log("📋 Fetching payment methods for customer:", customerId);

    // Fetch customer's payment methods from Rapyd
    const paymentMethodsResponse = await makeRapydRequest(
      "get",
      `/v1/customers/${customerId}/payment_methods`
    );

    const paymentMethods = paymentMethodsResponse.data;
    console.log("💳 Payment methods found:", paymentMethods?.length || 0);

    if (!paymentMethods || paymentMethods.length === 0) {
      return errorResponse(
        "No payment method found. Please complete the payment form on Rapyd's page.",
        400
      );
    }

    // Get the most recent payment method (last one added)
    const latestPaymentMethod = paymentMethods[paymentMethods.length - 1];
    const paymentMethodId = latestPaymentMethod.id;
    const last4 = latestPaymentMethod.last4 || null;
    const cardBrand = latestPaymentMethod.type || null;

    console.log("💳 Latest payment method:", paymentMethodId);
    console.log("💳 Last 4 digits:", last4);
    console.log("💳 Card brand:", cardBrand);

    // Update user's payment method in database and mark setup as complete
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        rapyd_payment_method_id: paymentMethodId,
        payment_method_last_4: last4,
        payment_method_brand: cardBrand,
        payment_setup_completed: true, // Mark payment setup as completed
        rapyd_checkout_id: null, // Clear checkout ID after successful completion
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("❌ Failed to update user payment method:", updateError);
      return errorResponse("Failed to save payment method", 500);
    }

    console.log("✅ Payment setup completed for user:", user.id);

    return successResponse({
      success: true,
      payment_method: {
        id: paymentMethodId,
        last4: last4,
        brand: cardBrand,
      },
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    return errorResponse(error.message || "Internal server error");
  }
});
