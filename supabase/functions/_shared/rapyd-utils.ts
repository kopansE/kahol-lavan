/**
 * Shared utilities for Rapyd API integration
 * Used by: complete-payment-setup, setup-payment-method, reserve-parking
 */

import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Generate Rapyd API signature according to their official documentation
 */
export function generateRapydSignature(
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

/**
 * Make an authenticated request to the Rapyd API
 */
export async function makeRapydRequest(
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

/**
 * Check the balance of a Rapyd ewallet account
 * Returns the balance in the specified currency (defaults to ILS)
 */
export async function checkWalletBalance(
  ewalletId: string,
  currency: string = "ILS"
): Promise<number> {
  const path = `/v1/ewallets/${ewalletId}/accounts`;
  const response = await makeRapydRequest("GET", path);

  if (!response.data || !Array.isArray(response.data)) {
    throw new Error("Invalid wallet accounts response");
  }

  const account = response.data.find((acc: any) => acc.currency === currency);

  if (!account) {
    // If no account exists for this currency, balance is 0
    return 0;
  }

  return account.balance || 0;
}

/**
 * Add funds to a Rapyd ewallet account
 * Returns the new balance after deposit
 */
export async function addFundsToWallet(
  ewalletId: string,
  amount: number,
  currency: string = "ILS"
): Promise<{ balance: number; transactionId: string }> {
  const path = "/v1/account/deposit";
  const body = {
    amount: amount,
    currency: currency,
    ewallet: ewalletId,
  };

  const response = await makeRapydRequest("POST", path, body);

  if (!response.data) {
    throw new Error("Invalid deposit response");
  }

  return {
    balance: response.data.balance || 0,
    transactionId: response.data.id,
  };
}

/**
 * Transfer funds between two Rapyd ewallets
 * Returns the transfer details including transaction IDs
 */
export async function transferFundsBetweenWallets(
  sourceEwalletId: string,
  destinationEwalletId: string,
  amount: number,
  currency: string = "ILS",
  metadata?: Record<string, any>
): Promise<{
  transferId: string;
  sourceTransactionId: string;
  destinationTransactionId: string;
  status: string;
}> {
  const path = "/v1/ewallets/transfer";
  const body: Record<string, any> = {
    amount: amount,
    currency: currency,
    source_ewallet: sourceEwalletId,
    destination_ewallet: destinationEwalletId,
  };

  if (metadata) {
    body.metadata = metadata;
  }

  const response = await makeRapydRequest("POST", path, body);

  if (!response.data) {
    throw new Error("Invalid transfer response");
  }

  return {
    transferId: response.data.id,
    sourceTransactionId: response.data.source_transaction_id || "",
    destinationTransactionId: response.data.destination_transaction_id || "",
    status: response.data.status,
  };
}

/**
 * Map Rapyd transaction status codes to our database-friendly status values
 */
function mapRapydStatus(rapydStatus: string): string {
  const statusMap: Record<string, string> = {
    PEN: "pending",
    ACT: "completed",
    COM: "completed",
    CLO: "completed",
    FAI: "failed",
    ERR: "failed",
    CAN: "cancelled",
    REJ: "failed",
  };

  // Return mapped status or lowercase version if not in map
  return statusMap[rapydStatus] || rapydStatus.toLowerCase();
}

/**
 * Log a transaction to the database
 */
export async function logTransaction(
  supabase: SupabaseClient,
  data: {
    payerId: string;
    receiverId: string;
    pinId: string;
    rapydPaymentId: string;
    rapydCheckoutId?: string;
    amountIls: number;
    platformFeeIls: number;
    netAmountIls: number;
    status: string;
    metadata?: Record<string, any>;
  }
): Promise<string> {
  // Map Rapyd status to database-friendly status
  const mappedStatus = mapRapydStatus(data.status);

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      payer_id: data.payerId,
      receiver_id: data.receiverId,
      pin_id: data.pinId,
      rapyd_payment_id: data.rapydPaymentId,
      rapyd_checkout_id: data.rapydCheckoutId || null,
      amount_ils: data.amountIls,
      platform_fee_ils: data.platformFeeIls,
      net_amount_ils: data.netAmountIls,
      status: mappedStatus,
      metadata: data.metadata || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to log transaction:", error);
    throw new Error("Failed to log transaction");
  }

  return transaction.id;
}
