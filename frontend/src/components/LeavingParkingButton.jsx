import React from "react";
import "../App.css";

const LeavingParkingButton = ({ waitingPin, onActivate }) => {
  const handleClick = async () => {
    const confirmed = window.confirm(
      "Are you leaving this parking spot now? This will make it visible to other users."
    );

    if (confirmed) {
      await onActivate();
    }
  };

  return (
    <div className="leaving-parking-button" onClick={handleClick}>
      <div className="leaving-parking-icon">🚗</div>
      <div className="leaving-parking-text">
        <div className="leaving-parking-title">Leaving Parking</div>
        <div className="leaving-parking-subtitle">
          Click to publish your spot
        </div>
      </div>
    </div>
  );
};

export default LeavingParkingButton;
