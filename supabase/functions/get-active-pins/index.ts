import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
  handleCorsPreFlight,
  errorResponse,
  successResponse,
} from "../_shared/auth-utils.ts";

// Calculate distance between two points using Haversine formula (in km)
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const supabaseClient = createSupabaseClient();

    // Get the user (optional - to exclude their own pins)
    let userId = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser(token);
      if (!userError && user) {
        userId = user.id;
      }
    }

    // Get query parameters
    const url = new URL(req.url);
    const parking_zone = url.searchParams.get("parking_zone");
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    const radius = url.searchParams.get("radius") || "5"; // default 5km radius

    // Build query - use admin client to bypass RLS
    // Get active pins (excluding user's own) - FETCH PINS ONLY
    let activeQuery = supabaseAdmin
      .from("pins")
      .select(
        "id, position, parking_zone, created_at, price, user_id, status, reserved_by, address"
      )
      .eq("status", "active");

    // Exclude user's own pins if logged in
    if (userId) {
      activeQuery = activeQuery.neq("user_id", userId);
    }

    // Get reserved pins where user is either the owner or the reserver
    let reservedQuery = null;
    if (userId) {
      reservedQuery = supabaseAdmin
        .from("pins")
        .select(
          "id, position, parking_zone, created_at, price, user_id, status, reserved_by, address"
        )
        .eq("status", "reserved")
        .or(`user_id.eq.${userId},reserved_by.eq.${userId}`);
    }

    // Get published pins (visible to ALL users including owner)
    let publishedQuery = supabaseAdmin
      .from("pins")
      .select(
        "id, position, parking_zone, created_at, price, user_id, status, reserved_by, address"
      )
      .eq("status", "published");

    // Filter by parking zone if provided
    if (parking_zone) {
      activeQuery = activeQuery.eq("parking_zone", parseInt(parking_zone));
      publishedQuery = publishedQuery.eq("parking_zone", parseInt(parking_zone));
      if (reservedQuery) {
        reservedQuery = reservedQuery.eq(
          "parking_zone",
          parseInt(parking_zone)
        );
      }
    }

    const { data: activePins, error: activeError } = await activeQuery.order(
      "created_at",
      {
        ascending: false,
      }
    );

    if (activeError) {
      console.error("❌ Error fetching active pins:", activeError);
      return errorResponse("Failed to fetch pins", 500);
    }

    let reservedPins: any[] = [];
    if (reservedQuery) {
      const { data: reserved, error: reservedError } =
        await reservedQuery.order("created_at", {
          ascending: false,
        });

      if (reservedError) {
        console.error("❌ Error fetching reserved pins:", reservedError);
        // Don't fail the whole request if reserved pins fail
      } else {
        reservedPins = reserved || [];
      }
    }

    const { data: publishedPinsData, error: publishedError } = await publishedQuery.order(
      "created_at",
      { ascending: false }
    );

    if (publishedError) {
      console.error("❌ Error fetching published pins:", publishedError);
      // Don't fail the whole request
    }

    // ========== SELF-HEALING: Auto-activate past-due published pins ==========
    // If QStash failed to call handle-scheduled-leave, pins stay "published" past their time.
    // Detect and fix these here.
    const publishedPinsList = publishedPinsData || [];
    let healedPinIds: string[] = [];

    if (publishedPinsList.length > 0) {
      // Fetch scheduled leaves for published pins to check which are past due
      const { data: allScheduledLeaves } = await supabaseAdmin
        .from("scheduled_leaves")
        .select("id, pin_id, user_id, secret_token, scheduled_for, status")
        .in("pin_id", publishedPinsList.map((p: any) => p.id))
        .eq("status", "pending");

      if (allScheduledLeaves && allScheduledLeaves.length > 0) {
        const now = new Date();

        for (const sl of allScheduledLeaves) {
          const scheduledTime = new Date(sl.scheduled_for);
          if (scheduledTime > now) continue; // Not past due yet

          console.log(`⚠️ Self-healing: Pin ${sl.pin_id} is past due (scheduled: ${sl.scheduled_for})`);

          // Check if there's a pending future reservation for this pin
          const { data: pendingFR } = await supabaseAdmin
            .from("future_reservations")
            .select("id")
            .eq("pin_id", sl.pin_id)
            .eq("scheduled_leave_id", sl.id)
            .eq("status", "pending")
            .maybeSingle();

          if (!pendingFR) {
            // Simple case: no pending reservation - just activate the pin
            console.log(`🔧 Self-healing: Activating pin ${sl.pin_id} (no pending reservation)`);
            await supabaseAdmin
              .from("pins")
              .update({ status: "active" })
              .eq("id", sl.pin_id);

            await supabaseAdmin
              .from("scheduled_leaves")
              .update({ status: "completed" })
              .eq("id", sl.id);

            healedPinIds.push(sl.pin_id);
            console.log(`✅ Self-healing: Pin ${sl.pin_id} activated successfully`);
          } else {
            // Complex case: has pending reservation - trigger handle-scheduled-leave internally (fire-and-forget)
            console.log(`🔧 Self-healing: Triggering handle-scheduled-leave for pin ${sl.pin_id} (has pending reservation)`);
            const handleUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-scheduled-leave`;
            const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

            // Fire-and-forget: don't await (we don't want to slow down the response)
            fetch(handleUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${svcKey}`,
              },
              body: JSON.stringify({
                user_id: sl.user_id,
                pin_id: sl.pin_id,
                secret_token: sl.secret_token,
              }),
            }).then(res => {
              console.log(`✅ Self-healing: handle-scheduled-leave triggered for pin ${sl.pin_id}, status: ${res.status}`);
            }).catch(err => {
              console.error(`❌ Self-healing: Failed to trigger handle-scheduled-leave for pin ${sl.pin_id}:`, err);
            });

            // Mark this pin as being healed so we don't show it as "published" in the response
            // (handle-scheduled-leave will take care of it momentarily)
            healedPinIds.push(sl.pin_id);
          }
        }
      }
    }

    // Filter out healed pins from the published list (they are being transitioned)
    // They'll appear correctly as "active" or "reserved" on the next refresh
    const cleanPublishedPins = publishedPinsList.filter(
      (p: any) => !healedPinIds.includes(p.id)
    );

    // Combine all pins
    const allPins = [
      ...(activePins || []),
      ...reservedPins,
      ...cleanPublishedPins,
    ];

    // Get unique user IDs from pins
    const userIds = [
      ...new Set(allPins.map((pin) => pin.user_id).filter(Boolean)),
    ];

    // Fetch user data for all users in one query from user_profiles VIEW
    let usersData = [];
    if (userIds.length > 0) {
      console.log("🔍 Fetching user data for IDs:", userIds);
      const { data: users, error: usersError } = await supabaseAdmin
        .from("user_profiles")
        .select(
          "id, full_name, car_license_plate, car_make, car_model, car_color"
        )
        .in("id", userIds);

      if (usersError) {
        console.error(
          "❌ Error fetching users from user_profiles:",
          usersError
        );
        // Continue without user data rather than failing
      } else {
        usersData = users || [];
        console.log("✅ Fetched user data from user_profiles:", usersData);
      }
    }

    // Create a map of user data by user ID for quick lookup
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    // Fetch scheduled_for data for published pins
    const publishedPinIds = allPins
      .filter((p: any) => p.status === "published")
      .map((p: any) => p.id);

    let scheduledLeavesMap = new Map();

    if (publishedPinIds.length > 0) {
      const { data: scheduledLeaves } = await supabaseAdmin
        .from("scheduled_leaves")
        .select("pin_id, scheduled_for")
        .in("pin_id", publishedPinIds)
        .eq("status", "pending");

      if (scheduledLeaves) {
        scheduledLeaves.forEach((sl: any) => {
          scheduledLeavesMap.set(sl.pin_id, sl.scheduled_for);
        });
      }
    }

    // Fetch future reservation data for published pins (bypass RLS with admin client)
    let futureReservationsMap = new Map();

    if (publishedPinIds.length > 0) {
      const { data: futureReservations } = await supabaseAdmin
        .from("future_reservations")
        .select("pin_id, reserver_id, id")
        .in("pin_id", publishedPinIds)
        .eq("status", "pending");

      if (futureReservations) {
        futureReservations.forEach((fr: any) => {
          futureReservationsMap.set(fr.pin_id, {
            future_reservation_id: fr.id,
            reserver_id: fr.reserver_id,
          });
        });
      }
    }

    // Join pins with user data, schedule info, and future reservation info
    const pins = allPins.map((pin: any) => {
      const userData = usersMap.get(pin.user_id);
      const result: any = {
        ...pin,
        user: userData || null,
      };

      // Add scheduled_for and future reservation info for published pins
      if (pin.status === "published") {
        result.scheduled_for = scheduledLeavesMap.get(pin.id) || null;
        const futureRes = futureReservationsMap.get(pin.id);
        if (futureRes) {
          result.future_reservation_id = futureRes.future_reservation_id;
          result.future_reserved_by = futureRes.reserver_id;
        } else {
          result.future_reservation_id = null;
          result.future_reserved_by = null;
        }
      }

      return result;
    });

    // If lat/lng provided, filter by distance
    let filteredPins = pins || [];
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxRadius = parseFloat(radius);
      filteredPins = pins.filter((pin) => {
        if (!pin.position || !Array.isArray(pin.position)) return false;
        const [pinLat, pinLng] = pin.position;
        const distance = calculateDistance(userLat, userLng, pinLat, pinLng);
        return distance <= maxRadius;
      });
    }

    return successResponse({
      success: true,
      pins: filteredPins,
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return errorResponse(error.message || "Internal server error");
  }
});
