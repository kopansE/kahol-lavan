import React, { useEffect, useRef } from "react";
import "./ParkingDetailModal.css";

const ParkingDetailModal = ({ parking, onClose }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleReserveClick = (e) => {
    e.stopPropagation();
    // TODO: Implement reserve functionality
    console.log("Reserve parking clicked");
  };

  if (!parking) return null;

  return (
    <div className="parking-detail-overlay">
      <div className="parking-detail-modal" ref={modalRef}>
        <div className="parking-detail-header">
          <div className="parking-address">{parking.address}</div>
        </div>
        <div className="parking-detail-body">
          <button className="reserve-button" onClick={handleReserveClick}>
            <span>Reserve parking</span>
            <span>50 ₪</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingDetailModal;
