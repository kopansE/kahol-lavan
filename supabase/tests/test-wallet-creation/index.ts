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

  console.log("🔑 Access Key (first 10):", accessKey?.substring(0, 10));
  console.log("🔑 Secret Key exists:", !!secretKey);
  console.log("🌐 Base URL:", baseUrl);

  if (!accessKey || !secretKey || !baseUrl) {
    throw new Error("Missing Rapyd credentials");
  }

  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let salt = "";
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 12; i++) {
    salt += chars[randomBytes[i] % chars.length];
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
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
  console.log(`\n📤 REQUEST: ${method.toUpperCase()} ${url}`);
  console.log("📦 Body:", JSON.stringify(body, null, 2));

  const response = await fetch(url, options);
  console.log(`\n📥 RESPONSE: ${response.status} ${response.statusText}`);

  const rawText = await response.text();
  console.log("📄 Raw response:", rawText);

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.error("❌ Failed to parse as JSON");
    throw new Error(`Non-JSON response: ${rawText}`);
  }

  console.log("📊 Parsed data:", JSON.stringify(data, null, 2));

  if (!response.ok || data.status?.status !== "SUCCESS") {
    console.error("❌ Rapyd returned error");
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
    console.log("\n\n🧪 ===== WALLET CREATION TEST =====");

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

    console.log("👤 User:", user.email);

    // Test 1: Create customer first
    console.log("\n📝 TEST 1: Creating customer...");

    const customerBody = {
      name: "Test User",
      email: user.email,
      phone_number: "",
      metadata: { user_id: user.id },
    };

    let customerResponse;
    try {
      customerResponse = await makeRapydRequest(
        "post",
        "/v1/customers",
        customerBody
      );
      console.log("✅ Customer created:", customerResponse.data.id);
    } catch (e) {
      console.error("❌ Customer creation failed:", e.message);
      throw e;
    }

    const customerId = customerResponse.data.id;

    // Test 2: Create wallet
    console.log("\n🏦 TEST 2: Creating wallet...");

    // Generate unique email to avoid "email already in use" error
    const uniqueEmail = `test.${Date.now()}@gmail.com`;
    console.log("📧 Using unique email:", uniqueEmail);

    const walletBody = {
      first_name: "Test",
      last_name: "User",
      email: uniqueEmail, // ← CHANGED: Unique email
      ewallet_reference_id: `${user.id}_${Date.now()}`, // ← CHANGED: Unique reference
      metadata: { user_id: user.id },
      type: "person",
      contact: {
        phone_number: "+972501234567", // Valid Israeli phone number
        email: uniqueEmail, // ← CHANGED: Same unique email
        first_name: "Test",
        last_name: "User",
        contact_type: "personal",
        country: "IL",
        date_of_birth: "1990-01-01",
        address: {
          name: "Test User",
          line_1: "123 Dizengoff Street",
          city: "Tel Aviv",
          country: "IL",
          zip: "12345",
          phone_number: "+972501234567",
        },
      },
    };

    console.log("🔍 Wallet body to send:", JSON.stringify(walletBody, null, 2));

    let walletResponse;
    try {
      walletResponse = await makeRapydRequest(
        "post",
        "/v1/ewallets",
        walletBody
      );
      console.log("✅ Wallet created:", walletResponse.data.id);
    } catch (e) {
      console.error("❌ Wallet creation failed:", e.message);

      // Return detailed error info
      return new Response(
        JSON.stringify({
          success: false,
          error: e.message,
          test_results: {
            customer_created: true,
            customer_id: customerId,
            wallet_created: false,
            wallet_error: e.message,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        test_results: {
          customer_created: true,
          customer_id: customerId,
          wallet_created: true,
          wallet_id: walletResponse.data.id,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ TEST FAILED:", error.message);
    console.error("Stack:", error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
