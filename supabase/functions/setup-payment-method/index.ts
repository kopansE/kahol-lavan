import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import { makeRapydRequest } from "../_shared/rapyd-utils.ts";

/**
 * Setup payment method using Rapyd checkout
 * This creates a checkout session for the user to add their payment method
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const supabaseAdmin = createSupabaseAdmin();

    // Get user data
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userDataError) {
      return errorResponse("Failed to fetch user data", 500);
    }

    // Parse request body for redirect URL
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch (e) {
      // Empty body is okay
    }

    // Handle payment setup completion callback from frontend
    if (requestBody && requestBody.mark_complete === true) {
      const { error: completeUpdateError } = await supabaseAdmin
        .from("users")
        .update({
          payment_setup_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (completeUpdateError) {
        return errorResponse("Failed to mark payment setup as complete", 500);
      }

      return successResponse({
        success: true,
        message: "Payment setup marked as complete",
      });
    }

    // Get existing customer ID if available
    let customerId = userData.rapyd_customer_id;

    // Clear test bypass values
    if (
      customerId &&
      (customerId.includes("test") || customerId.includes("bypass"))
    ) {
      customerId = null;
    }

    // Extract redirect URL from request body
    let redirectBaseUrl: string | null = null;
    if (requestBody && typeof requestBody.redirect_base_url === "string") {
      redirectBaseUrl = requestBody.redirect_base_url;
    }

    // Clean up URL (remove trailing slash)
    if (redirectBaseUrl && redirectBaseUrl.endsWith("/")) {
      redirectBaseUrl = redirectBaseUrl.slice(0, -1);
    }

    const appUrl =
      redirectBaseUrl || Deno.env.get("APP_URL") || "http://localhost:5173";
    console.log("Using App URL for Rapyd redirect:", appUrl);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // Check if we need to use middleman redirect for local/ngrok URLs
    const isLocalOrNgrok =
      !appUrl ||
      appUrl.includes("localhost") ||
      appUrl.includes("127.0.0.1") ||
      appUrl.includes("ngrok") ||
      appUrl.startsWith("http://") ||
      !appUrl.startsWith("https://");

    console.log(
      "URL detection - appUrl:",
      appUrl,
      "isLocalOrNgrok:",
      isLocalOrNgrok
    );

    let completeCheckoutUrl: string;
    let errorPaymentUrl: string;
    let cancelCheckoutUrl: string;

    if (isLocalOrNgrok) {
      // Use middleman redirect for local/dev URLs
      const middlemanUrl = `${supabaseUrl}/functions/v1/handle-redirect`;
      console.log(
        "Using Middleman Redirect (local/dev detected):",
        middlemanUrl
      );

      const encodedTarget = encodeURIComponent(appUrl);
      completeCheckoutUrl = `${middlemanUrl}?payment_setup=complete&target=${encodedTarget}`;
      errorPaymentUrl = `${middlemanUrl}?payment_setup=error&target=${encodedTarget}`;
      cancelCheckoutUrl = `${middlemanUrl}?payment_setup=cancelled&target=${encodedTarget}`;
    } else {
      // Production URLs - use direct redirect
      console.log("Using Direct Redirect (production):", appUrl);
      completeCheckoutUrl = `${appUrl}?payment_setup=complete`;
      errorPaymentUrl = `${appUrl}?payment_setup=error`;
      cancelCheckoutUrl = `${appUrl}?payment_setup=cancelled`;
    }

    // Ensure all URLs are HTTPS (Rapyd requirement)
    const ensureHttps = (url: string): string => {
      if (
        url.startsWith("http://") &&
        !url.includes("localhost") &&
        !url.includes("127.0.0.1")
      ) {
        return url.replace("http://", "https://");
      }
      return url;
    };

    completeCheckoutUrl = ensureHttps(completeCheckoutUrl);
    errorPaymentUrl = ensureHttps(errorPaymentUrl);
    cancelCheckoutUrl = ensureHttps(cancelCheckoutUrl);

    console.log("Final URLs for Rapyd:");
    console.log("  complete_url:", completeCheckoutUrl);
    console.log("  cancel_url:", cancelCheckoutUrl);
    console.log("  error_payment_url:", errorPaymentUrl);

    // Build checkout body
    const checkoutBody: any = {
      amount: 100, // 1 ILS in agorot (smallest amount)
      country: "IL",
      currency: "ILS",
      payment_method_type_categories: ["card"],
      complete_url: completeCheckoutUrl,
      cancel_url: cancelCheckoutUrl,
      complete_payment_url: completeCheckoutUrl,
      error_payment_url: errorPaymentUrl,
      merchant_reference_id: `setup_${user.id}_${Date.now()}`,
      metadata: {
        user_id: user.id,
        type: "card_setup",
      },
      requested_currency: "ILS",
      capture: false, // Don't capture, just authorize to save payment method
      custom_elements: {
        save_card_default: true, // Tell Rapyd to save payment method to customer
      },
    };

    // Only include customer ID if it exists
    if (customerId) {
      checkoutBody.customer = customerId;
      console.log("Using existing customer ID:", customerId);
    } else {
      console.log(
        "No existing customer - Rapyd will create customer during checkout"
      );
    }

    let checkoutResponse;
    try {
      checkoutResponse = await makeRapydRequest(
        "post",
        "/v1/checkout",
        checkoutBody
      );
    } catch (error) {
      // If URL error and we're not already using middleman, try using middleman as fallback
      if (
        error.message.includes("ERROR_HOSTED_PAGE_INVALID_URL") &&
        !isLocalOrNgrok
      ) {
        console.warn(
          "URL rejected by Rapyd. Falling back to middleman redirect."
        );
        const middlemanUrl = `${supabaseUrl}/functions/v1/handle-redirect`;
        const encodedTarget = encodeURIComponent(appUrl);
        const fallbackBody = {
          ...checkoutBody,
          complete_url: `${middlemanUrl}?payment_setup=complete&target=${encodedTarget}`,
          cancel_url: `${middlemanUrl}?payment_setup=cancelled&target=${encodedTarget}`,
          complete_payment_url: `${middlemanUrl}?payment_setup=complete&target=${encodedTarget}`,
          error_payment_url: `${middlemanUrl}?payment_setup=error&target=${encodedTarget}`,
        };
        checkoutResponse = await makeRapydRequest(
          "post",
          "/v1/checkout",
          fallbackBody
        );
      } else {
        throw error;
      }
    }

    // Store checkout ID for later retrieval in complete-payment-setup
    const { error: checkoutUpdateError } = await supabaseAdmin
      .from("users")
      .update({
        payment_setup_complete: false,
        rapyd_checkout_id: checkoutResponse.data.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (checkoutUpdateError) {
      console.error(
        "Failed to update checkout status in database:",
        checkoutUpdateError
      );
      // Don't throw - this is not critical, checkout can still proceed
    }

    return successResponse({
      success: true,
      hosted_page_url: checkoutResponse.data.redirect_url,
      checkout_id: checkoutResponse.data.id,
      customer_id: customerId || null,
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    return errorResponse(error.message || "Internal server error");
  }
});
