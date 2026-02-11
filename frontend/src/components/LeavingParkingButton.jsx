import React from "react";
import "../App.css";

const LeavingParkingButton = ({ waitingPin, onActivate }) => {
  const handleClick = async () => {
    const confirmed = window.confirm(
      "האם אתה עוזב את החניה עכשיו? היא תהיה גלויה למשתמשים אחרים.",
    );

    if (confirmed) {
      await onActivate();
    }
  };

  return (
    <div className="leaving-parking-button" onClick={handleClick}>
      <div className="leaving-parking-icon">🚗</div>
      <div className="leaving-parking-text">
        <div className="leaving-parking-title">עוזב חניה</div>
        <div className="leaving-parking-subtitle">לחץ לפרסום המקום שלך</div>
      </div>
    </div>
  );
};

export default LeavingParkingButton;
