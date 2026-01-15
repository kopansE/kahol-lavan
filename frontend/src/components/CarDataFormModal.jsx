import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import "./CarDataFormModal.css";

const CarDataFormModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    car_license_plate: "",
    car_make: "",
    car_model: "",
    car_color: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateLicensePlate = (plate) => {
    if (!plate || plate.trim().length === 0) {
      return "License plate is required";
    }
    // Israeli license plate format: 7-8 digits with optional dashes
    const plateRegex = /^\d{2,3}-?\d{2}-?\d{3}$/;
    if (!plateRegex.test(plate.trim())) {
      return "Invalid format. Expected: XX-XXX-XX or XXX-XX-XXX";
    }
    return null;
  };

  const validateTextField = (value, fieldName, maxLength) => {
    if (!value || value.trim().length === 0) {
      return `${fieldName} is required`;
    }
    if (value.trim().length > maxLength) {
      return `${fieldName} must be ${maxLength} characters or less`;
    }
    const textRegex = /^[a-zA-Z0-9\s\-'.]+$/;
    if (!textRegex.test(value.trim())) {
      return `${fieldName} contains invalid characters`;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    const plateError = validateLicensePlate(formData.car_license_plate);
    if (plateError) newErrors.car_license_plate = plateError;

    const makeError = validateTextField(formData.car_make, "Car make", 50);
    if (makeError) newErrors.car_make = makeError;

    const modelError = validateTextField(formData.car_model, "Car model", 50);
    if (modelError) newErrors.car_model = modelError;

    const colorError = validateTextField(formData.car_color, "Car color", 30);
    if (colorError) newErrors.car_color = colorError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        alert("Please log in to update your car data.");
        return;
      }

      const token = sessionData.session.access_token;
      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/update-user-car-data`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update car data");
      }

      alert("✅ Car data saved successfully!");
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error("Error updating car data:", error);
      alert(`Failed to save car data: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="car-data-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">🚗</div>

        <h2 className="modal-title">Enter Your Car Details</h2>

        <p className="modal-message">
          Help others identify your vehicle during parking exchanges
        </p>

        <form onSubmit={handleSubmit} className="car-data-form">
          <div className="form-group">
            <label htmlFor="car_license_plate" className="form-label">
              License Plate *
            </label>
            <input
              type="text"
              id="car_license_plate"
              name="car_license_plate"
              value={formData.car_license_plate}
              onChange={handleChange}
              className={`form-input ${
                errors.car_license_plate ? "form-input-error" : ""
              }`}
              placeholder="e.g., 12-345-67"
              disabled={isSubmitting}
            />
            {errors.car_license_plate && (
              <span className="form-error">{errors.car_license_plate}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="car_make" className="form-label">
              Car Make *
            </label>
            <input
              type="text"
              id="car_make"
              name="car_make"
              value={formData.car_make}
              onChange={handleChange}
              className={`form-input ${
                errors.car_make ? "form-input-error" : ""
              }`}
              placeholder="e.g., Toyota, Honda, Mazda"
              disabled={isSubmitting}
            />
            {errors.car_make && (
              <span className="form-error">{errors.car_make}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="car_model" className="form-label">
              Car Model *
            </label>
            <input
              type="text"
              id="car_model"
              name="car_model"
              value={formData.car_model}
              onChange={handleChange}
              className={`form-input ${
                errors.car_model ? "form-input-error" : ""
              }`}
              placeholder="e.g., Corolla, Civic, CX-5"
              disabled={isSubmitting}
            />
            {errors.car_model && (
              <span className="form-error">{errors.car_model}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="car_color" className="form-label">
              Car Color *
            </label>
            <input
              type="text"
              id="car_color"
              name="car_color"
              value={formData.car_color}
              onChange={handleChange}
              className={`form-input ${
                errors.car_color ? "form-input-error" : ""
              }`}
              placeholder="e.g., White, Black, Silver"
              disabled={isSubmitting}
            />
            {errors.car_color && (
              <span className="form-error">{errors.car_color}</span>
            )}
          </div>

          <div className="modal-buttons">
            <button
              type="submit"
              className="modal-btn modal-btn-confirm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Car Data"}
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CarDataFormModal;
