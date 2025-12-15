import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// EXACT implementation from Rapyd official Node.js documentation
function generateRapydSignature(
  httpMethod: string,
  urlPath: string,
  salt: string,
  timestamp: string,
  accessKey: string,
  secretKey: string,
  body: string = ""
): string {
  const method = httpMethod.toLowerCase();
  const toSign =
    method + urlPath + salt + timestamp + accessKey + secretKey + body;

  const hash = createHmac("sha256", secretKey);
  hash.update(toSign);

  // THIS IS THE EXACT LINE FROM RAPYD OFFICIAL DOCS
  const hexDigest = hash.digest("hex");
  const signature = Buffer.from(hexDigest).toString("base64");

  return signature;
}

async function makeRapydRequest(
  method: string,
  path: string,
  body: any = null
): Promise<any> {
  const accessKey = Deno.env.get("RAPYD_ACCESS_KEY");
  const secretKey = Deno.env.get("RAPYD_SECRET_KEY");
  const baseUrl = Deno.env.get("RAPYD_API_BASE_URL");

  if (!accessKey || !secretKey || !baseUrl) {
    throw new Error("Missing Rapyd credentials");
  }

  // Generate salt - alphanumeric only
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let salt = "";
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 12; i++) {
    salt += chars[randomBytes[i] % chars.length];
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Rapyd requires compact JSON (no spaces) for signature calculation
  const bodyString = body ? JSON.stringify(body) : "";

  const signature = generateRapydSignature(
    method,
    path,
    salt,
    timestamp,
    accessKey,
    secretKey,
    bodyString
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    access_key: accessKey,
    salt: salt,
    timestamp: timestamp,
    signature: signature,
  };

  const options: RequestInit = {
    method: method.toUpperCase(),
    headers: headers,
    ...(body && { body: bodyString }),
  };

  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);
  const rawText = await response.text();

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    data = { rawText };
  }

  if (!response.ok || data.status?.status !== "SUCCESS") {
    console.error("Rapyd error:", data);
    throw new Error(
      data.status?.error_code ||
        data.status?.message ||
        `Rapyd API error: ${response.status}`
    );
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userDataError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch user data" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let customerId = userData.rapyd_customer_id;
    let walletId = userData.rapyd_wallet_id;

    // Clear test bypass values
    if (
      customerId &&
      (customerId.includes("test") || customerId.includes("bypass"))
    ) {
      customerId = null;
    }
    if (
      walletId &&
      (walletId.includes("test") || walletId.includes("bypass"))
    ) {
      walletId = null;
    }

    if (!customerId) {
      const customerBody = {
        name: userData.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
        phone_number: "",
        metadata: { user_id: user.id },
      };

      const customerResponse = await makeRapydRequest(
        "post",
        "/v1/customers",
        customerBody
      );
      customerId = customerResponse.data.id;

      const { error: customerUpdateError } = await supabaseAdmin
        .from("users")
        .update({ rapyd_customer_id: customerId })
        .eq("id", user.id);

      if (customerUpdateError) {
        console.error(
          "Failed to save rapyd_customer_id to database:",
          customerUpdateError
        );
        throw new Error(
          `Database update failed for customer ID: ${customerUpdateError.message}`
        );
      }
    }

    if (!walletId) {
      const walletBody = {
        first_name: userData.full_name?.split(" ")[0] || "User",
        last_name: userData.full_name?.split(" ").slice(1).join(" ") || "",
        email: user.email,
        ewallet_reference_id: user.id,
        metadata: { user_id: user.id },
        type: "person",
        contact: {
          phone_number: "",
          email: user.email,
          first_name: userData.full_name?.split(" ")[0] || "User",
          last_name: userData.full_name?.split(" ").slice(1).join(" ") || "",
          contact_type: "personal",
          country: "IL",
        },
      };

      // *** CORRECTION: Using the current, correct endpoint /v1/ewallets ***
      const walletResponse = await makeRapydRequest(
        "post",
        "/v1/ewallets",
        walletBody
      );
      // ******************************************************************

      walletId = walletResponse.data.id;

      const { error: walletUpdateError } = await supabaseAdmin
        .from("users")
        .update({ rapyd_wallet_id: walletId })
        .eq("id", user.id);

      if (walletUpdateError) {
        console.error(
          "Failed to save rapyd_wallet_id to database:",
          walletUpdateError
        );
        throw new Error(
          `Database update failed for wallet ID: ${walletUpdateError.message}`
        );
      }
    }

    // Attempt to parse request body for dynamic redirect URL
    let redirectBaseUrl: string | null = null;
    try {
      // Read body directly (no clone needed as we don't read it elsewhere)
      const body = await req.json();
      console.log("Received body:", body); // DEBUG LOG
      if (body && typeof body.redirect_base_url === "string") {
        redirectBaseUrl = body.redirect_base_url;
      }
    } catch (e) {
      console.error(
        "Error parsing request body - this may cause redirect issues:",
        e.message
      );
      // Body parsing failure is a potential issue - log more details
      return new Response(
        JSON.stringify({
          error: "Failed to parse request body",
          details: e.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Clean up URL (remove trailing slash)
    if (redirectBaseUrl && redirectBaseUrl.endsWith("/")) {
      redirectBaseUrl = redirectBaseUrl.slice(0, -1);
    }

    const appUrl =
      redirectBaseUrl || Deno.env.get("APP_URL") || "http://localhost:5173";
    console.log("Using App URL for Rapyd redirect:", appUrl);

    // Use the middleman function for redirection
    // This solves the issue where Rapyd rejects ngrok/localhost URLs
    let supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // Ensure we have the project URL not the API URL if possible, or construct standard functions URL
    // Standard format: https://<project_ref>.supabase.co/functions/v1/<function_name>
    // Often SUPABASE_URL is like https://xyz.supabase.co, which is correct.

    // Check if we are in a local dev environment or using a custom redirect base
    // If redirectBaseUrl is present (ngrok), we route through the middleman
    let completePaymentUrl = `${appUrl}?payment_setup=complete`;
    let errorPaymentUrl = `${appUrl}?payment_setup=error`;
    let cancelCheckoutUrl = `${appUrl}?payment_setup=cancelled`;

    if (redirectBaseUrl && redirectBaseUrl.includes("ngrok")) {
      // Construct middleman URL explicitly to avoid issues with SUPABASE_URL env var format
      const middlemanUrl = `${supabaseUrl}/functions/v1/handle-redirect`;
      console.log("Using Middleman Redirect:", middlemanUrl);

      // Add status query parameters to distinguish between success, error, and cancellation
      // This allows handle-redirect to route to the correct page
      completePaymentUrl = `${middlemanUrl}?payment_setup=complete`;
      errorPaymentUrl = `${middlemanUrl}?payment_setup=error`;
      cancelCheckoutUrl = `${middlemanUrl}?payment_setup=cancelled`;
    } else {
      console.log("Not using Middleman. Redirect Base URL:", redirectBaseUrl);
    }

    const checkoutBody = {
      amount: 100, // 1 ILS in agorot (smallest amount)
      country: "IL",
      currency: "ILS",
      customer: customerId,
      payment_method_type_categories: ["card"],
      complete_payment_url: completePaymentUrl,
      error_payment_url: errorPaymentUrl,
      cancel_checkout_url: cancelCheckoutUrl,
      merchant_reference_id: `setup_${user.id}_${Date.now()}`,
      metadata: {
        user_id: user.id,
        type: "card_setup",
      },
      requested_currency: "ILS",
      capture: false, // Don't capture, just authorize to save payment method
    };

    const makeCheckoutRequest = async () => {
      // Body is already fully constructed with correct URLs
      return await makeRapydRequest("post", "/v1/checkout", checkoutBody);
    };

    let checkoutResponse;
    try {
      checkoutResponse = await makeCheckoutRequest();
    } catch (error) {
      if (
        error.message.includes("ERROR_HOSTED_PAGE_INVALID_URL") &&
        appUrl.includes("localhost")
      ) {
        console.warn(
          "Localhost URL rejected by Rapyd. Falling back to APP_URL (Vercel)."
        );
        const fallbackUrl = Deno.env.get("APP_URL");
        if (fallbackUrl && fallbackUrl !== appUrl) {
          // Re-construct body with fallback URL
          const fallbackBody = {
            ...checkoutBody,
            complete_payment_url: `${fallbackUrl}?payment_setup=complete`,
            error_payment_url: `${fallbackUrl}?payment_setup=error`,
            cancel_checkout_url: `${fallbackUrl}?payment_setup=cancelled`,
          };
          checkoutResponse = await makeRapydRequest(
            "post",
            "/v1/checkout",
            fallbackBody
          );
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        hosted_page_url: checkoutResponse.data.redirect_url,
        checkout_id: checkoutResponse.data.id,
        customer_id: customerId,
        wallet_id: walletId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
