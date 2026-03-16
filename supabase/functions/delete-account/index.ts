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
    const userId = user.id;
    const supabaseAdmin = createSupabaseAdmin();

    // Cancel any active/waiting pins owned by this user
    await supabaseAdmin
      .from("pins")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .in("status", ["active", "waiting", "published"]);

    // Cancel any pins reserved by this user
    await supabaseAdmin
      .from("pins")
      .update({ status: "active", reserved_by: null })
      .eq("reserved_by", userId)
      .eq("status", "reserved");

    // Cancel active chat sessions where user is holder or tracker
    await supabaseAdmin
      .from("chat_sessions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .or(`holder_id.eq.${userId},tracker_id.eq.${userId}`)
      .eq("status", "active");

    // Cancel pending timers for sessions involving this user
    const { data: userSessions } = await supabaseAdmin
      .from("chat_sessions")
      .select("id")
      .or(`holder_id.eq.${userId},tracker_id.eq.${userId}`);

    if (userSessions && userSessions.length > 0) {
      const sessionIds = userSessions.map((s: { id: string }) => s.id);
      await supabaseAdmin
        .from("pending_timers")
        .update({ status: "cancelled" })
        .in("session_id", sessionIds)
        .eq("status", "pending");
    }

    // Delete user's reports (as reporter)
    await supabaseAdmin
      .from("reports")
      .delete()
      .eq("reporter_id", userId);

    // Delete the user row from public.users (cascades handled by FK constraints)
    await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    // Delete the auth user
    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      return errorResponse(
        `Failed to delete auth account: ${deleteAuthError.message}`,
        500
      );
    }

    return successResponse({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
