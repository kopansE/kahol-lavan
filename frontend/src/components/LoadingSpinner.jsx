import React from "react";
import "../App.css";

const LoadingSpinner = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img
          src="/favicon.png"
          alt="KalParking"
          className="loading-logo"
        />
        <div className="loading-spinner"></div>
        טוען...
      </div>
    </div>
  );
};

export default LoadingSpinner;
