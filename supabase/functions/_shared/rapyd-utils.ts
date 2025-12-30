/**
 * Shared utilities for Rapyd API integration
 * Used by: complete-payment-setup, setup-payment-method, reserve-parking
 */

import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

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

