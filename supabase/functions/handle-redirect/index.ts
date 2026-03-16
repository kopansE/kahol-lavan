import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth-utils.ts";

/**
 * Middleman redirect function.
 * Rapyd requires HTTPS URLs for redirects.
 *
 * - Web flow:    target param is a valid HTTPS URL → 302 redirect to it.
 * - Mobile flow: no target (or non-HTTPS target) → serve a landing page
 *                telling the user to close the browser and return to the app.
 *                The mobile app polls for payment completion separately.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("target");
    const paymentStatus = url.searchParams.get("payment_setup") || "complete";
    console.log("[handle-redirect] Incoming URL:", req.url);
    console.log("[handle-redirect] target param:", target);
    console.log("[handle-redirect] payment_setup param:", paymentStatus);
    console.log("[handle-redirect] User-Agent:", req.headers.get("user-agent"));

    // If target is a valid HTTPS URL, do a standard 302 redirect (web flow)
    if (target && target.startsWith("https://")) {
      const targetUrl = new URL(target);

      url.searchParams.forEach((value, key) => {
        if (key !== "target") {
          targetUrl.searchParams.append(key, value);
        }
      });

      console.log("Web redirect → 302 to:", targetUrl.toString());

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: targetUrl.toString() },
      });
    }

    // Mobile flow — 302 redirect directly to the app deep link.
    // The mobile app opens the payment page via openAuthSessionAsync
    // (ASWebAuthenticationSession on iOS / Custom Tabs on Android), which
    // intercepts any navigation to the kahollavan:// scheme at the OS level
    // and closes the browser automatically. No HTML page needed.
    const deepLink = `kahollavan://?payment_setup=${paymentStatus}`;
    console.log("Mobile deep-link redirect →", deepLink);

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: deepLink },
    });
  } catch (error) {
    console.error("Redirect error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
