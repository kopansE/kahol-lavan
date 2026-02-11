import React from "react";
import "../App.css";

const NotLeavingParkingButton = ({ activePin, onDeactivate }) => {
  const handleClick = async () => {
    const confirmed = window.confirm(
      "האם אתה נשאר בחניה? היא תוסתר ממשתמשים אחרים.",
    );

    if (confirmed) {
      await onDeactivate();
    }
  };

  return (
    <div className="not-leaving-parking-button" onClick={handleClick}>
      <div className="not-leaving-parking-icon">🅿️</div>
      <div className="not-leaving-parking-text">
        <div className="not-leaving-parking-title">נשאר בחניה</div>
        <div className="not-leaving-parking-subtitle">לחץ להסתרת המקום שלך</div>
      </div>
    </div>
  );
};

export default NotLeavingParkingButton;
