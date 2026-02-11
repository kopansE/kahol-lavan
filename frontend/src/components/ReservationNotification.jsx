import React, { useState } from "react";
import "./ReservationNotification.css";

const ReservationNotification = ({ notification, onAccept, onDecline }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onAccept(notification.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onDecline(notification.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTimeRemaining = (expirationDate) => {
    const now = new Date();
    const expiration = new Date(expirationDate);
    const diff = expiration - now;

    if (diff <= 0) return "פג תוקף";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `נותרו ${hours}ש ${minutes}ד`;
    }
    return `נותרו ${minutes}ד`;
  };

  return (
    <div className="reservation-notification">
      <div className="notification-header">
        <div className="notification-icon">🚗</div>
        <div className="notification-title">בקשת הזמנת חניה</div>
      </div>

      <div className="notification-content">
        <div className="notification-message">
          <strong>{notification.sender_name}</strong> רוצה להזמין את החניה שלך
        </div>

        {notification.pins && notification.pins.address && (
          <div className="notification-address">
            📍 {notification.pins.address}
          </div>
        )}

        <div className="notification-details">
          <div className="notification-amount">
            <span className="amount-label">סכום:</span>
            <span className="amount-value">
              ₪{notification.amount.toFixed(2)}
            </span>
          </div>
          <div className="notification-expiry">
            ⏱️ {formatTimeRemaining(notification.expiration)}
          </div>
        </div>
      </div>

      <div className="notification-actions">
        <button
          className="btn-accept"
          onClick={handleAccept}
          disabled={isProcessing}
        >
          {isProcessing ? "מעבד..." : "אשר"}
        </button>
        <button
          className="btn-decline"
          onClick={handleDecline}
          disabled={isProcessing}
        >
          {isProcessing ? "מעבד..." : "דחה"}
        </button>
      </div>
    </div>
  );
};

export default ReservationNotification;
