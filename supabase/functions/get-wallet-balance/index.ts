import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  authenticateUser,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";
import { checkWalletBalance } from "../_shared/rapyd-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const user = await authenticateUser(req);
    const supabaseAdmin = createSupabaseAdmin();

    // Get user's wallet ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("rapyd_wallet_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData || !userData.rapyd_wallet_id) {
      return errorResponse("Wallet not found", 404);
    }

    // Check wallet balance
    const balance = await checkWalletBalance(userData.rapyd_wallet_id, "ILS");

    return successResponse({
      success: true,
      balance: balance,
      currency: "ILS",
    });
  } catch (error) {
    console.error("❌ Error fetching wallet balance:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
