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
      return "האם אתה בטוח שברצונך לבטל את ההזמנה? לא תקבל החזר מלא.";
    } else {
      return "האם אתה בטוח שברצונך לבטל הזמנה זו? המשתמש המזמין יקבל החזר מלא.";
    }
  };

  return (
    <div className="cancel-reservation-overlay">
      <div className="cancel-reservation-modal" ref={modalRef}>
        <div className="cancel-reservation-header">
          <h2>ביטול הזמנה</h2>
        </div>
        <div className="cancel-reservation-body">
          <p>{getMessage()}</p>
          <div className="cancel-reservation-buttons">
            <button
              className="cancel-reservation-confirm-button"
              onClick={handleConfirmClick}
              disabled={isCancelling}
            >
              {isCancelling ? "מבטל..." : "כן, בטל הזמנה"}
            </button>
            <button
              className="cancel-reservation-close-button"
              onClick={onClose}
              disabled={isCancelling}
            >
              לא, שמור הזמנה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelReservationModal;
