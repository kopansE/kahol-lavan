import React from "react";
import { formatParkingZone } from "../utils/parkingZoneUtils";
import "./PinConfirmationModal.css";

const PinConfirmationModal = ({ address, parkingZone, isLoading, onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-icon">📍</div>

        <h2 className="modal-title">Pin Location</h2>

        <p className="modal-message">You dropped a pin at:</p>

        <div className="modal-address">
          {isLoading ? (
            <div className="address-loading">
              <div className="spinner-small"></div>
              <span>Finding address...</span>
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

        <p className="modal-question">Did you park here? 🙂</p>

        <div className="modal-buttons">
          <button
            className="modal-btn modal-btn-confirm"
            onClick={onConfirm}
            disabled={isLoading}
          >
            Yes, I did!
          </button>
          <button
            className="modal-btn modal-btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinConfirmationModal;
