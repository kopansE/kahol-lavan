import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Receiver } from "https://esm.sh/@upstash/qstash@2.7.0";
import {
  createSupabaseAdmin,
  corsHeaders,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("Upstash-Signature");
  const rawBody = await req.text();

  // Initialize the Receiver for QStash signature verification
  const receiver = new Receiver({
    currentSigningKey: Deno.env.get("QSTASH_CURRENT_SIGNING_KEY")!,
    nextSigningKey: Deno.env.get("QSTASH_NEXT_SIGNING_KEY")!,
  });

  // Verify using the SDK
  try {
    await receiver.verify({
      signature: signature || "",
      body: rawBody,
    });
    console.log("✅ QStash signature verified by SDK");
  } catch (err) {
    console.error("❌ QStash verification failed:", (err as Error).message);
    return errorResponse("Invalid signature", 401);
  }

  try {
    // Parse the body
    const { user_id, pin_id, secret_token } = JSON.parse(rawBody);

    if (!user_id || !pin_id || !secret_token) {
      console.error("❌ Missing required fields");
      return errorResponse("Missing user_id, pin_id, or secret_token", 400);
    }

    console.log(`📥 Received scheduled leave trigger for user: ${user_id}, pin: ${pin_id}`);

    const supabaseAdmin = createSupabaseAdmin();

    // Verify secret_token exists in scheduled_leaves and is still pending
    const { data: scheduleRecord, error: scheduleError } = await supabaseAdmin
      .from("scheduled_leaves")
      .select("*")
      .eq("user_id", user_id)
      .eq("pin_id", pin_id)
      .eq("secret_token", secret_token)
      .single();

    if (scheduleError || !scheduleRecord) {
      console.error("❌ Schedule record not found:", scheduleError);
      // Return 200 to prevent QStash retries for invalid tokens
      return successResponse({ success: false, reason: "Schedule not found" });
    }

    // Check if schedule was already processed (idempotency)
    if (scheduleRecord.status !== "pending") {
      console.log(`⚠️ Schedule already processed: ${scheduleRecord.status}`);
      return successResponse({
        success: true,
        already_processed: true,
        status: scheduleRecord.status,
      });
    }

    // Get the pin and verify it's still in waiting status
    const { data: pin, error: pinError } = await supabaseAdmin
      .from("pins")
      .select("*")
      .eq("id", pin_id)
      .eq("user_id", user_id)
      .single();

    if (pinError || !pin) {
      console.error("❌ Pin not found:", pinError);
      // Mark schedule as cancelled since pin doesn't exist
      await supabaseAdmin
        .from("scheduled_leaves")
        .update({ status: "cancelled" })
        .eq("id", scheduleRecord.id);
      return successResponse({ success: false, reason: "Pin not found" });
    }

    // Check if pin is still in waiting status
    if (pin.status !== "waiting") {
      console.log(`⚠️ Pin status is ${pin.status}, not waiting. Skipping activation.`);
      await supabaseAdmin
        .from("scheduled_leaves")
        .update({ status: "cancelled" })
        .eq("id", scheduleRecord.id);
      return successResponse({
        success: true,
        skipped: true,
        reason: `Pin is already ${pin.status}`,
      });
    }

    console.log("🎉 Scheduled time reached! Activating pin...");

    // ========== ACTIVATE THE PIN ==========
    const { error: updateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "active" })
      .eq("id", pin_id);

    if (updateError) {
      console.error("❌ Failed to activate pin:", updateError);
      throw new Error(`Failed to activate pin: ${updateError.message}`);
    }

    console.log(`✅ Pin ${pin_id} activated successfully`);

    // ========== UPDATE SCHEDULE STATUS ==========
    const { error: scheduleUpdateError } = await supabaseAdmin
      .from("scheduled_leaves")
      .update({ status: "completed" })
      .eq("id", scheduleRecord.id);

    if (scheduleUpdateError) {
      console.error("⚠️ Failed to update schedule status:", scheduleUpdateError);
      // Don't fail - the pin activation already succeeded
    }

    console.log(`✅ Scheduled leave completed for user ${user_id}`);

    return successResponse({
      success: true,
      pin_id: pin_id,
      pin_status: "active",
      message: "Pin activated successfully. Your parking spot is now visible to others.",
    });
  } catch (err) {
    console.error("Error in handle-scheduled-leave:", err);
    // Return 200 to prevent infinite retries, but indicate failure
    return successResponse({
      success: false,
      error: (err as Error).message || "Internal server error",
    });
  }
});
