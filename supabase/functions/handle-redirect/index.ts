import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth-utils.ts";

/**
 * Middleman redirect function
 * Rapyd requires HTTPS URLs, but local dev uses ngrok/localhost
 * This function receives redirects from Rapyd and forwards them to the actual app URL
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let target = url.searchParams.get("target");

    // FALLBACK: If no target is provided, use ngrok URL from env
    if (!target) {
      console.log("No target param found. Using fallback dev URL.");
      target = Deno.env.get("NGROK_URL");

      if (!target) {
        console.error("NGROK_URL env var not set!");
        return new Response(
          JSON.stringify({
            error: "Missing redirect target and NGROK_URL not set",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log("Handle Redirect called with:", req.url);
    console.log("Target:", target);

    if (!target) {
      console.error("Missing target URL");
      return new Response(JSON.stringify({ error: "Missing target URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Construct the final destination URL
    const targetUrl = new URL(target);

    // Copy all current search params to the target, EXCEPT 'target'
    // This includes payment_setup status (complete, error, cancelled)
    url.searchParams.forEach((value, key) => {
      if (key !== "target") {
        targetUrl.searchParams.append(key, value);
      }
    });

    console.log(`Redirecting to: ${targetUrl.toString()}`);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: targetUrl.toString(),
      },
    });
  } catch (error) {
    console.error("Redirect error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
