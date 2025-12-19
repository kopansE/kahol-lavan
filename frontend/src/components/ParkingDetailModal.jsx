import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import "./ParkingDetailModal.css";

const ParkingDetailModal = ({ parking, onClose }) => {
  const modalRef = useRef(null);
  const [isReserving, setIsReserving] = useState(false);

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

  const handleReserveClick = async (e) => {
    e.stopPropagation();

    if (isReserving) return;

    try {
      setIsReserving(true);

      // Get the access token
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        alert("Please log in to reserve parking.");
        return;
      }

      const token = sessionData.session.access_token;
      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/reserve-parking`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin_id: parking.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to reserve parking");
      }

      alert(`✅ ${result.message}\nAmount paid: ₪${result.amount_paid}`);
      onClose();

      // Optionally refresh the map to remove the reserved parking
      window.location.reload();
    } catch (error) {
      console.error("Error reserving parking:", error);
      alert(`Failed to reserve parking: ${error.message}`);
    } finally {
      setIsReserving(false);
    }
  };

  if (!parking) return null;

  return (
    <div className="parking-detail-overlay">
      <div className="parking-detail-modal" ref={modalRef}>
        <div className="parking-detail-header">
          <div className="parking-address">{parking.address}</div>
        </div>
        <div className="parking-detail-body">
          <button
            className="reserve-button"
            onClick={handleReserveClick}
            disabled={isReserving}
          >
            <span>{isReserving ? "Processing..." : "Reserve parking"}</span>
            <span>50 ₪</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingDetailModal;
