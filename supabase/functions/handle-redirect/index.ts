import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let target = url.searchParams.get("target");

    // FALLBACK for Rapyd: If no target is provided, assume it's the dev tunnel
    // This allows us to send a "clean" URL to Rapyd (no query params)
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

    // DEBUG: Log everything
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
