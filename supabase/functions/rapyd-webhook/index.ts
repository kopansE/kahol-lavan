import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

// Helper function to make Rapyd API requests
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
  };

  if (body) {
    options.body = bodyString;
  }

  const url = `${baseUrl}${path}`;

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || data.status?.status !== "SUCCESS") {
    console.error("Rapyd API error:", data);
    throw new Error(
      data.status?.message || `Rapyd API error: ${response.status}`
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

    // Verify user
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

    // Get user data from database
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userDataError) {
      console.error("Error fetching user data:", userDataError);
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

    // Step 1: Create Rapyd Customer if not exists
    if (!customerId) {
      const customerBody = {
        name: userData.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
        phone_number: "",
        metadata: {
          user_id: user.id,
        },
      };

      const customerResponse = await makeRapydRequest(
        "POST",
        "/v1/customers",
        customerBody
      );

      customerId = customerResponse.data.id;

      // Update database with customer ID
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

    // Step 2: Create Rapyd Wallet if not exists
    if (!walletId) {
      const walletBody = {
        first_name: userData.full_name?.split(" ")[0] || "User",
        last_name: userData.full_name?.split(" ").slice(1).join(" ") || "",
        email: user.email,
        ewallet_reference_id: user.id,
        metadata: {
          user_id: user.id,
        },
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

      // Using the current, correct endpoint /v1/ewallets
      const walletResponse = await makeRapydRequest(
        "POST",
        "/v1/ewallets",
        walletBody
      );

      walletId = walletResponse.data.id;

      // Update database with wallet ID
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

    // Step 3: Generate Hosted Card Collection Page
    const cardPageBody = {
      customer: customerId,
      country: "IL", // Israel
      currency: "ILS", // Israeli Shekel
      cancel_checkout_url: `${Deno.env.get("APP_URL")}/payment-cancelled`,
      complete_checkout_url: `${Deno.env.get("APP_URL")}/payment-success`,
      error_payment_url: `${Deno.env.get("APP_URL")}/payment-error`,
      page_expiration: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    };

    const cardPageResponse = await makeRapydRequest(
      "POST",
      "/v1/hosted/card_tokenization",
      cardPageBody
    );

    const hostedPageUrl = cardPageResponse.data.redirect_url;
    const hostedPageId = cardPageResponse.data.id;

    // Return the hosted page URL to frontend
    return new Response(
      JSON.stringify({
        success: true,
        hosted_page_url: hostedPageUrl,
        hosted_page_id: hostedPageId,
        customer_id: customerId,
        wallet_id: walletId,
        message: "Please complete card setup on the hosted page",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
