import React from "react";
import "../App.css";

const CancelReservationButton = ({ reservedPin, onCancelReservation }) => {
  const handleClick = async () => {
    if (onCancelReservation) {
      await onCancelReservation(reservedPin);
    }
  };

  return (
    <div className="cancel-reservation-button" onClick={handleClick}>
      <div className="cancel-reservation-icon">🚫</div>
      <div className="cancel-reservation-text">
        <div className="cancel-reservation-title">Cancel Reservation</div>
        <div className="cancel-reservation-subtitle">
          Click to cancel your spot
        </div>
      </div>
    </div>
  );
};

export default CancelReservationButton;

