import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../contexts/ToastContext";
import { formatParkingZone } from "../utils/parkingZoneUtils";
import "./ParkingDetailModal.css";

/**
 * Detects if the user is on a mobile device
 */
const isMobileDevice = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase(),
  );
};

/**
 * Detects if the user is on iOS
 */
const isIOS = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /iphone|ipad|ipod/i.test(userAgent.toLowerCase());
};

/**
 * Detects if the user is on Android
 */
const isAndroid = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android/i.test(userAgent.toLowerCase());
};

/**
 * Opens the device's default navigation app with directions to the specified coordinates
 * @param {number} lat - Latitude of the destination
 * @param {number} lng - Longitude of the destination
 * @param {string} address - Address label for the destination (optional)
 * @returns {Promise<boolean>} - Whether navigation was successfully opened
 */
const openNavigation = async (lat, lng, address = "") => {
  const destination = `${lat},${lng}`;
  const label = encodeURIComponent(address || "מיקום חניה");

  // Google Maps web URL (universal fallback)
  const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

  if (isMobileDevice()) {
    if (isIOS()) {
      // Try Google Maps app first, then Apple Maps
      const googleMapsUrl = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
      const appleMapsUrl = `maps://?daddr=${destination}&dirflg=d`;

      // Create hidden iframe to try deep link
      const tryDeepLink = (url, fallbackUrl) => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          const timeout = setTimeout(() => {
            // If we're still here after 500ms, the app likely didn't open
            window.open(fallbackUrl, "_blank");
            resolve(true);
          }, 500);

          window.location.href = url;

          // If the app opens, the page will lose focus
          const handleBlur = () => {
            clearTimeout(timeout);
            window.removeEventListener("blur", handleBlur);
            resolve(true);
          };
          window.addEventListener("blur", handleBlur);
        });
      };

      // Try to open Apple Maps (more reliable on iOS)
      window.location.href = appleMapsUrl;
      return true;
    } else if (isAndroid()) {
      // Try Google Maps intent
      const geoUrl = `geo:${destination}?q=${destination}(${label})`;

      // Try geo URI first
      window.location.href = geoUrl;

      // Set a timeout to fallback to web if geo URI doesn't work
      setTimeout(() => {
        window.open(googleMapsWebUrl, "_blank");
      }, 1000);

      return true;
    }
  }

  // Desktop or fallback: open Google Maps in new tab
  window.open(googleMapsWebUrl, "_blank");
  return true;
};

const ParkingDetailModal = ({ parking, onClose, userReservedPins }) => {
  const modalRef = useRef(null);
  const { showToast } = useToast();
  const [isReserving, setIsReserving] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const hasExistingReservation =
    userReservedPins && userReservedPins.length > 0;

  // Check if we have valid coordinates
  const hasValidCoordinates =
    parking?.position &&
    Array.isArray(parking.position) &&
    parking.position.length >= 2 &&
    typeof parking.position[0] === "number" &&
    typeof parking.position[1] === "number";

  const handleNavigateClick = async (e) => {
    e.stopPropagation();

    if (isNavigating || !hasValidCoordinates) return;

    try {
      setIsNavigating(true);
      const [lat, lng] = parking.position;
      const success = await openNavigation(lat, lng, parking.address);

      if (!success) {
        showToast("לא ניתן לפתוח אפליקציית ניווט.");
      }
    } catch (error) {
      console.error("Error opening navigation:", error);
      showToast("פתיחת הניווט נכשלה. אנא נסה שוב.");
    } finally {
      // Brief delay to show loading state
      setTimeout(() => setIsNavigating(false), 500);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleReserveClick = async (e) => {
    e.stopPropagation();

    if (isReserving) return;

    if (hasExistingReservation) {
      showToast("כבר יש לך הזמנה פעילה. אנא בטל אותה לפני הזמנת מקום נוסף.");
      return;
    }

    try {
      setIsReserving(true);

      // Get the access token
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        showToast("אנא התחבר כדי להזמין חניה.");
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
        throw new Error(result.error || "Failed to reserve parking");
      }

      showToast(`החניה הוזמנה בהצלחה! סכום ששולם: ₪${result.amount_paid}`);
      onClose();

      // Optionally refresh the map to remove the reserved parking
      window.location.reload();
    } catch (error) {
      console.error("Error reserving parking:", error);
      showToast(`הזמנת החניה נכשלה: ${error.message}`);
    } finally {
      setIsReserving(false);
    }
  };

  if (!parking) return null;

  // Extract user data (could be nested as 'user', 'users', or at parking level)
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

          {hasExistingReservation && (
            <div className="reservation-warning">
              ⚠️ כבר יש לך הזמנה פעילה. בטל אותה קודם כדי להזמין מקום אחר.
            </div>
          )}
          <button
            className="reserve-button"
            onClick={handleReserveClick}
            disabled={isReserving || hasExistingReservation}
          >
            <span>
              {isReserving
                ? "מעבד..."
                : hasExistingReservation
                  ? "כבר הוזמנה"
                  : "הזמן חניה"}
            </span>
            <span>50 ₪</span>
          </button>
          <button
            className={`navigate-button ${!hasValidCoordinates || isNavigating ? "navigate-button-disabled" : ""}`}
            onClick={handleNavigateClick}
            disabled={!hasValidCoordinates || isNavigating}
          >
            {isNavigating ? (
              <span className="navigate-loading">פותח ניווט...</span>
            ) : (
              <>
                <span className="navigate-icon">🧭</span>
                <span>
                  {hasValidCoordinates ? "נווט לחניה" : "מיקום לא זמין"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingDetailModal;
