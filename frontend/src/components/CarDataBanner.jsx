import React from "react";
import "./CarDataBanner.css";

const CarDataBanner = ({ onClickBanner }) => {
  return (
    <div className="car-data-banner" onClick={onClickBanner}>
      <div className="car-data-banner-content">
        <span className="car-data-banner-icon">🚗</span>
        <span className="car-data-banner-text">
          Please enter your car's data 😀
        </span>
        <span className="car-data-banner-arrow">→</span>
      </div>
    </div>
  );
};

export default CarDataBanner;
