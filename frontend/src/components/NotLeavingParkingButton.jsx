import React from "react";
import "../App.css";

const NotLeavingParkingButton = ({ activePin, onDeactivate }) => {
  const handleClick = async () => {
    const confirmed = window.confirm(
      "Are you staying in this parking spot? This will hide it from other users."
    );

    if (confirmed) {
      await onDeactivate();
    }
  };

  return (
    <div className="not-leaving-parking-button" onClick={handleClick}>
      <div className="not-leaving-parking-icon">🅿️</div>
      <div className="not-leaving-parking-text">
        <div className="not-leaving-parking-title">Not Leaving</div>
        <div className="not-leaving-parking-subtitle">
          Click to hide your spot
        </div>
      </div>
    </div>
  );
};

export default NotLeavingParkingButton;
