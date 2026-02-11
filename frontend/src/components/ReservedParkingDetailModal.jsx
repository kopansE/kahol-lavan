import React, { useEffect, useRef, useState } from "react";
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
      // Try Apple Maps on iOS
      const appleMapsUrl = `maps://?daddr=${destination}&dirflg=d`;
      window.location.href = appleMapsUrl;
      return true;
    } else if (isAndroid()) {
      // Try geo URI for Android
      const geoUrl = `geo:${destination}?q=${destination}(${label})`;
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

const ReservedParkingDetailModal = ({ parking, onClose }) => {
  const modalRef = useRef(null);
  const { showToast } = useToast();
  const [isNavigating, setIsNavigating] = useState(false);

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
      setTimeout(() => setIsNavigating(false), 500);
    }
  };

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

  if (!parking) return null;

  // Extract user data (owner of the parking spot)
  const userData = parking.user || parking.users || {};
  const ownerName = userData?.full_name || "בעלים לא ידוע";
  const carMake = userData?.car_make;
  const carModel = userData?.car_model;
  const carColor = userData?.car_color;
  const licensePlate = userData?.car_license_plate;

  return (
    <div className="parking-detail-overlay">
      <div className="parking-detail-modal" ref={modalRef}>
        <div className="parking-detail-header">
          <div className="parking-address">
            {parking.address || "חניה שהוזמנה"}
          </div>
        </div>
        <div className="parking-detail-body">
          {/* Status Badge */}
          <div className="reservation-success">✅ הזמנת חניה זו</div>

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

          {/* Reservation Details */}
          {parking.timestamp && (
            <div className="parking-info-section">
              <h3 className="info-section-title">פרטי הזמנה</h3>
              <div className="info-item">
                <span className="info-icon">🕐</span>
                <span className="info-text">
                  {new Date(parking.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          )}

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

          <button className="close-button" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservedParkingDetailModal;
