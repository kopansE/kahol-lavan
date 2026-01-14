import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
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
    const { position, parking_zone, address } = await req.json();

    if (!position || position.length !== 2) {
      return errorResponse("Invalid position format", 400);
    }

    const supabaseAdmin = createSupabaseAdmin();

    // Delete any existing pins for this user
    await supabaseAdmin.from("pins").delete().eq("user_id", user.id);

    // Insert new pin with "waiting" status
    const { data: pin, error: insertError } = await supabaseAdmin
      .from("pins")
      .insert({
        user_id: user.id,
        position: position,
        parking_zone: parking_zone,
        status: "waiting",
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Error inserting pin:", insertError);
      return errorResponse(`Failed to save pin: ${insertError.message}`, 500);
    }

    // Update user's last pin location
    await supabaseAdmin
      .from("users")
      .update({
        last_pin_location: {
          id: pin.id,
          position: position,
          address: address,
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return successResponse({ success: true, pin });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
