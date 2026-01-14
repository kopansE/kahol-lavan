import React from "react";
import "../App.css";

const ReservedParkingButton = ({ reservedPin, reservedByName, onCancelReservation }) => {
  const handleClick = async () => {
    if (onCancelReservation) {
      await onCancelReservation(reservedPin);
    }
  };

  return (
    <div className="reserved-parking-button" onClick={handleClick}>
      <div className="reserved-parking-icon">📅</div>
      <div className="reserved-parking-text">
        <div className="reserved-parking-title">Parking Reserved</div>
        <div className="reserved-parking-subtitle">
          Reserved by: {reservedByName || "Loading..."}
        </div>
      </div>
    </div>
  );
};

export default ReservedParkingButton;

