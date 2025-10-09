import React from "react";
import "../App.css";

const LoadingSpinner = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        Loading...
      </div>
    </div>
  );
};

export default LoadingSpinner;
