import React from "react";
import { formatParkingZone } from "../utils/parkingZoneUtils";
import "./PinConfirmationModal.css";

const PinConfirmationModal = ({
  address,
  parkingZone,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-icon">📍</div>

        <h2 className="modal-title">מיקום סימון</h2>

        <p className="modal-message">סימנת מיקום ב:</p>

        <div className="modal-address">
          {isLoading ? (
            <div className="address-loading">
              <div className="spinner-small"></div>
              <span>מחפש כתובת...</span>
            </div>
          ) : (
            <strong>{address}</strong>
          )}
        </div>

        {!isLoading && (
          <div style={{ fontSize: "0.9em", marginTop: "8px", color: "#666" }}>
            🅿️ {formatParkingZone(parkingZone)}
          </div>
        )}

        <p className="modal-question">חנית כאן? 🙂</p>

        <div className="modal-buttons">
          <button
            className="modal-btn modal-btn-confirm"
            onClick={onConfirm}
            disabled={isLoading}
          >
            כן, חניתי!
          </button>
          <button
            className="modal-btn modal-btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinConfirmationModal;
