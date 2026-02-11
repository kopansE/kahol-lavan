import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../contexts/ToastContext";
import { formatParkingZone } from "../utils/parkingZoneUtils";
import "./ParkingDetailModal.css";

const PublishedParkingDetailModal = ({
  parking,
  onClose,
  userReservedPins,
  publishedPins,
  currentUserId,
}) => {
  const modalRef = useRef(null);
  const { showToast } = useToast();
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const hasExistingReservation =
    userReservedPins && userReservedPins.length > 0;

  // Determine reservation status from data passed by get-active-pins (no RLS issues)
  const futureReservedBy = parking?.future_reserved_by || null;
  const futureReservationId = parking?.future_reservation_id || null;
  const isScheduledByMe =
    futureReservedBy && futureReservedBy === currentUserId;
  const isScheduledByOther =
    futureReservedBy && futureReservedBy !== currentUserId;
  const alreadyScheduled = isScheduledByMe || isScheduledByOther;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const formatScheduledTime = (isoString) => {
    if (!isoString) return "זמן לא ידוע";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const timeStr = date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateStr = date.toLocaleDateString("he-IL", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    if (diffMs < 0) return `${dateStr} ב-${timeStr} (חלף)`;
    if (diffHours > 0) {
      return `${dateStr} ב-${timeStr} (בעוד ${diffHours}ש ${diffMinutes}ד)`;
    }
    return `${dateStr} ב-${timeStr} (בעוד ${diffMinutes}ד)`;
  };

  const handleScheduleClick = async (e) => {
    e.stopPropagation();

    if (isScheduling) return;

    if (hasExistingReservation) {
      showToast("כבר יש לך הזמנה פעילה. אנא בטל אותה לפני תזמון מקום נוסף.");
      return;
    }

    try {
      setIsScheduling(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        showToast("אנא התחבר כדי לתזמן חניה.");
        return;
      }

      const token = sessionData.session.access_token;
      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/reserve-parking`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin_id: parking.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to schedule parking");
      }

      showToast("החניה תוזמנה בהצלחה!");
      onClose();

      // Refresh the map
      window.location.reload();
    } catch (error) {
      console.error("Error scheduling parking:", error);
      showToast(`תזמון החניה נכשל: ${error.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelFutureReservation = async (e) => {
    e.stopPropagation();

    if (isCancelling || !futureReservationId) return;

    const confirmed = window.confirm(
      "האם אתה בטוח שברצונך לבטל את ההזמנה המתוזמנת?",
    );
    if (!confirmed) return;

    try {
      setIsCancelling(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        showToast("אנא התחבר כדי לבטל.");
        return;
      }

      const token = sessionData.session.access_token;
      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/cancel-future-reservation`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          future_reservation_id: futureReservationId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to cancel reservation");
      }

      showToast("ההזמנה בוטלה בהצלחה.");
      onClose();

      // Refresh the map
      window.location.reload();
    } catch (error) {
      console.error("Error cancelling future reservation:", error);
      showToast(`ביטול ההזמנה נכשל: ${error.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!parking) return null;

  const userData = parking.user || parking.users || parking;
  const ownerName = userData?.full_name || "בעלים לא ידוע";
  const carMake = userData?.car_make;
  const carModel = userData?.car_model;
  const carColor = userData?.car_color;
  const licensePlate = userData?.car_license_plate;

  return (
    <div className="parking-detail-overlay">
      <div className="parking-detail-modal" ref={modalRef}>
        <div className="parking-detail-header">
          <div className="parking-address">{parking.address}</div>
        </div>
        <div className="parking-detail-body">
          {/* Scheduled Departure Time */}
          <div className="parking-info-section">
            <h3 className="info-section-title">יציאה מתוזמנת</h3>
            <div className="info-item">
              <span className="info-icon">🕐</span>
              <span
                className="info-text"
                style={{ fontWeight: 600, color: "#34A853" }}
              >
                {formatScheduledTime(parking.scheduled_for)}
              </span>
            </div>
          </div>

          {/* Parking Zone */}
          <div className="parking-info-section">
            <h3 className="info-section-title">מיקום</h3>
            <div className="info-item">
              <span className="info-icon">🅿️</span>
              <span className="info-text">
                {formatParkingZone(parking.parking_zone)}
              </span>
            </div>
          </div>

          {/* Owner Information */}
          <div className="parking-info-section">
            <h3 className="info-section-title">בעלים</h3>
            <div className="info-item">
              <span className="info-icon">👤</span>
              <span className="info-text">{ownerName}</span>
            </div>
          </div>

          {/* Car Information */}
          {(carMake || carModel || carColor || licensePlate) && (
            <div className="parking-info-section">
              <h3 className="info-section-title">פרטי רכב</h3>
              {(carMake || carModel) && (
                <div className="info-item">
                  <span className="info-icon">🚗</span>
                  <span className="info-text">
                    {carMake} {carModel}
                  </span>
                </div>
              )}
              {carColor && (
                <div className="info-item">
                  <span className="info-icon">🎨</span>
                  <span className="info-text">{carColor}</span>
                </div>
              )}
              {licensePlate && (
                <div className="info-item">
                  <span className="info-icon">🔢</span>
                  <span className="info-text license-plate">
                    {licensePlate}
                  </span>
                </div>
              )}
            </div>
          )}

          {hasExistingReservation && !isScheduledByMe && (
            <div className="reservation-warning">
              כבר יש לך הזמנה פעילה. בטל אותה קודם כדי לתזמן מקום אחר.
            </div>
          )}

          {isScheduledByMe && (
            <div
              className="reservation-warning"
              style={{
                background: "#e8f5e9",
                borderColor: "#34A853",
                color: "#2e7d32",
              }}
            >
              תזמנת מקום זה. הוא יופעל בזמן המתוזמן.
            </div>
          )}

          {isScheduledByOther && (
            <div className="reservation-warning">
              חניה זו כבר תוזמנה על ידי משתמש אחר.
            </div>
          )}

          {isScheduledByMe ? (
            <button
              className="reserve-button"
              onClick={handleCancelFutureReservation}
              disabled={isCancelling}
              style={{ background: "#dc3545" }}
            >
              <span>{isCancelling ? "מבטל..." : "בטל את ההזמנה שלי"}</span>
            </button>
          ) : (
            <button
              className="reserve-button"
              onClick={handleScheduleClick}
              disabled={
                isScheduling || hasExistingReservation || isScheduledByOther
              }
              style={{ background: isScheduledByOther ? "#999" : "#34A853" }}
            >
              <span>
                {isScheduling
                  ? "מתזמן..."
                  : isScheduledByOther
                    ? "כבר מתוזמן"
                    : hasExistingReservation
                      ? "כבר הוזמנה"
                      : "תזמן מקום זה"}
              </span>
              {!isScheduledByOther && <span>חינם</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublishedParkingDetailModal;
