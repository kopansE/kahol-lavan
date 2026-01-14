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

    // Get pending transfer requests where user is the receiver
    const { data: notifications, error: notificationsError } =
      await supabaseAdmin
        .from("transfer_requests")
        .select(
          `
        id,
        transfer_id,
        pin_id,
        sender_id,
        amount,
        currency,
        status,
        created_at,
        expiration,
        pins (
          id,
          position
        )
      `
        )
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (notificationsError) {
      console.error("Error fetching notifications:", notificationsError);
      return errorResponse("Failed to fetch notifications", 500);
    }

    // Get sender details for each notification
    const enrichedNotifications = await Promise.all(
      // deno-lint-ignore no-explicit-any
      (notifications || []).map(async (notification: any) => {
        const { data: senderData, error: senderError } = await supabaseAdmin
          .from("user_profiles")
          .select("full_name")
          .eq("id", notification.sender_id)
          .single();

        if (senderError) {
          console.error("Error fetching sender data:", senderError);
        }

        return {
          ...notification,
          sender_name: senderData?.full_name || "Unknown User",
        };
      })
    );

    return successResponse({
      success: true,
      notifications: enrichedNotifications,
      count: enrichedNotifications.length,
    });
  } catch (err) {
    console.error("Error in get-pending-notifications:", err);
    return errorResponse(err.message || "Internal server error");
  }
});
