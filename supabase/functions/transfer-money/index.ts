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

    // Parse request body
    const { recipient_wallet_id, amount, currency, description } = await req.json();

    if (!recipient_wallet_id || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: recipient_wallet_id, amount, currency" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get sender's wallet
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData?.rapyd_wallet_id) {
      return new Response(
        JSON.stringify({ error: "Wallet not found. Please setup payment first." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sourceWallet = userData.rapyd_wallet_id;

    // Transfer money between wallets using Rapyd API
    const transferBody = {
      source_ewallet: sourceWallet,
      destination_ewallet: recipient_wallet_id,
      amount: amount,
      currency: currency,
      metadata: {
        user_id: user.id,
        description: description || "Wallet transfer",
      },
    };

    const transferResponse = await makeRapydRequest(
      "post",
      "/v1/account/transfer",
      transferBody
    );

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transferResponse.data.id,
        amount: transferResponse.data.amount,
        currency: transferResponse.data.currency,
        status: transferResponse.data.status,
        destination_ewallet: recipient_wallet_id,
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

