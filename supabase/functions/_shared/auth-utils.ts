/**
 * Shared authentication utilities
 * Used by: all authenticated edge functions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Create Supabase admin client with service role key
 */
export function createSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

/**
 * Create Supabase client with anon key
 */
export function createSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
}

/**
 * Authenticate user from request and return user object
 * Also ensures user exists in public.users table
 */
export async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("No authorization header");
  }

  const supabaseClient = createSupabaseClient();
  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser(token);

  if (userError || !user) {
    throw new Error("User not found");
  }

  // Ensure user exists in public.users (handles cases where user was deleted from public.users)
  const supabaseAdmin = createSupabaseAdmin();
  await supabaseAdmin.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
      ignoreDuplicates: false,
    }
  );

  return user;
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreFlight() {
  return new Response("ok", { headers: corsHeaders });
}

/**
 * Create error response with CORS headers
 */
export function errorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Create success response with CORS headers
 */
export function successResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
