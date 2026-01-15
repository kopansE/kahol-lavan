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
    const supabaseAdmin = createSupabaseAdmin();

    // Fetch user profile from users table
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select(
        `
        id,
        email,
        full_name,
        avatar_url,
        car_license_plate,
        car_make,
        car_model,
        car_color,
        user_data_complete,
        payment_setup_completed,
        payment_method_last4,
        payment_method_brand,
        created_at,
        updated_at
      `
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("❌ Error fetching user profile:", profileError);
      return errorResponse(`Failed to fetch profile: ${profileError.message}`, 500);
    }

    if (!userProfile) {
      return errorResponse("User profile not found", 404);
    }

    console.log("✅ User profile fetched successfully:", user.id);

    return successResponse({
      success: true,
      profile: userProfile,
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
