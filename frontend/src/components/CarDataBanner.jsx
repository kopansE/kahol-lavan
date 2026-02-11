import React from "react";
import "./CarDataBanner.css";

const CarDataBanner = ({ onClickBanner }) => {
  return (
    <div className="car-data-banner" onClick={onClickBanner}>
      <div className="car-data-banner-content">
        <span className="car-data-banner-icon">🚗</span>
        <span className="car-data-banner-text">
          אנא הזן את פרטי הרכב שלך 😀
        </span>
        <span className="car-data-banner-arrow">→</span>
      </div>
    </div>
  );
};

export default CarDataBanner;
