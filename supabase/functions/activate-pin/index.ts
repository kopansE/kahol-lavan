import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const { pin_id } = await req.json();

    if (!pin_id) {
      return errorResponse("Pin ID is required", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Verify pin belongs to user and is in waiting status
    const { data: pin, error: fetchError } = await supabaseAdmin
      .from("pins")
      .select("*")
      .eq("id", pin_id)
      .eq("user_id", user.id)
      .eq("status", "waiting")
      .single();

    if (fetchError || !pin) {
      return errorResponse("Pin not found or not in waiting status", 404);
    }

    // Update pin status to active
    const { error: updateError } = await supabaseAdmin
      .from("pins")
      .update({ status: "active" })
      .eq("id", pin_id);

    if (updateError) {
      console.error("❌ Error activating pin:", updateError);
      return errorResponse(
        `Failed to activate pin: ${updateError.message}`,
        500
      );
    }

    return successResponse({
      success: true,
      message: "Pin activated",
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
