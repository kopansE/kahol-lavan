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

    // First, check if the pin exists at all
    const { data: pin, error: fetchError } = await supabaseAdmin
      .from("pins")
      .select("*")
      .eq("id", pin_id)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Error fetching pin:", fetchError);
      return errorResponse(`Database error: ${fetchError.message}`, 500);
    }

    if (!pin) {
      console.log(`❌ Pin ${pin_id} not found in database`);
      return errorResponse("Pin not found", 404);
    }

    console.log(`📍 Pin found:`, {
      pin_id: pin.id,
      user_id: pin.user_id,
      status: pin.status,
      requesting_user: user.id,
    });

    // Check if pin belongs to user
    if (pin.user_id !== user.id) {
      console.log(`❌ Pin ${pin_id} does not belong to user ${user.id}`);
      return errorResponse("This pin does not belong to you", 403);
    }

    // Check if pin is in waiting status
    if (pin.status !== "waiting") {
      console.log(
        `❌ Pin ${pin_id} is in status "${pin.status}", not "waiting"`
      );
      return errorResponse(
        `Pin cannot be activated. Current status: ${pin.status}`,
        400
      );
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

    console.log(`✅ Pin ${pin_id} activated successfully`);

    return successResponse({
      success: true,
      message: "Pin activated",
      pin: {
        id: pin.id,
        status: "active",
        position: pin.position,
        parking_zone: pin.parking_zone,
      },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
