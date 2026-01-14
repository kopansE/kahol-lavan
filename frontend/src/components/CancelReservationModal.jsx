import React, { useEffect, useRef, useState } from "react";
import "./CancelReservationModal.css";

const CancelReservationModal = ({ onConfirm, onClose, userType }) => {
  const modalRef = useRef(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleConfirmClick = async (e) => {
    e.stopPropagation();

    if (isCancelling) return;

    try {
      setIsCancelling(true);
      await onConfirm();
    } catch (error) {
      console.error("Error cancelling reservation:", error);
    } finally {
      setIsCancelling(false);
    }
  };

  const getMessage = () => {
    if (userType === "reserving") {
      return "Are you sure you want to cancel your reservation? You will not receive a full refund.";
    } else {
      return "Are you sure you want to cancel this reservation? The reserving user will receive a full refund.";
    }
  };

  return (
    <div className="cancel-reservation-overlay">
      <div className="cancel-reservation-modal" ref={modalRef}>
        <div className="cancel-reservation-header">
          <h2>Cancel Reservation</h2>
        </div>
        <div className="cancel-reservation-body">
          <p>{getMessage()}</p>
          <div className="cancel-reservation-buttons">
            <button
              className="cancel-reservation-confirm-button"
              onClick={handleConfirmClick}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Yes, Cancel Reservation"}
            </button>
            <button
              className="cancel-reservation-close-button"
              onClick={onClose}
              disabled={isCancelling}
            >
              No, Keep Reservation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelReservationModal;
