import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../contexts/ToastContext";
import "./SettingsPage.css";

const SettingsPage = ({ user, onBack, onClose }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    car_license_plate: "",
    car_make: "",
    car_model: "",
    car_color: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserCarData();
    }
  }, [user]);

  const loadUserCarData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("car_license_plate, car_make, car_model, car_color")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading car data:", error);
      } else if (data) {
        setFormData({
          car_license_plate: data.car_license_plate || "",
          car_make: data.car_make || "",
          car_model: data.car_model || "",
          car_color: data.car_color || "",
        });
      }
    } catch (error) {
      console.error("Error loading car data:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateLicensePlate = (plate) => {
    if (!plate || plate.trim().length === 0) {
      return "מספר רישוי נדרש";
    }
    const plateRegex = /^\d{2,3}-?\d{2}-?\d{3}$/;
    if (!plateRegex.test(plate.trim())) {
      return "פורמט לא תקין. נדרש: XX-XXX-XX או XXX-XX-XXX";
    }
    return null;
  };

  const validateTextField = (value, fieldName, maxLength) => {
    if (!value || value.trim().length === 0) {
      return `${fieldName} נדרש`;
    }
    if (value.trim().length > maxLength) {
      return `${fieldName} חייב להיות ${maxLength} תווים או פחות`;
    }
    const textRegex = /^[a-zA-Z0-9\s\-'.א-ת]+$/;
    if (!textRegex.test(value.trim())) {
      return `${fieldName} מכיל תווים לא חוקיים`;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
    setSaveSuccess(false);
  };

  const validateForm = () => {
    const newErrors = {};

    const plateError = validateLicensePlate(formData.car_license_plate);
    if (plateError) newErrors.car_license_plate = plateError;

    const makeError = validateTextField(formData.car_make, "יצרן", 50);
    if (makeError) newErrors.car_make = makeError;

    const modelError = validateTextField(formData.car_model, "דגם", 50);
    if (modelError) newErrors.car_model = modelError;

    const colorError = validateTextField(formData.car_color, "צבע", 30);
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
    setSaveSuccess(false);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        showToast("אנא התחבר כדי לעדכן את פרטי הרכב.");
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

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating car data:", error);
      showToast(`שמירת פרטי הרכב נכשלה: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <button className="back-button" onClick={onBack}>
          ‹
        </button>
        <h2 className="page-title">הגדרות</h2>
        <button className="page-close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="loading-state">טוען...</div>
        ) : (
          <form onSubmit={handleSubmit} className="settings-form">
            <div className="form-section">
              <div className="section-header">
                <span className="section-icon">🚗</span>
                <h3 className="section-title">פרטי רכב</h3>
              </div>
              <p className="section-description">
                עזור לאחרים לזהות את הרכב שלך בזמן החלפת חניות
              </p>

              <div className="form-group">
                <label htmlFor="car_license_plate" className="form-label">
                  מספר רישוי *
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
                  placeholder="לדוגמה: 12-345-67"
                  disabled={isSubmitting}
                />
                {errors.car_license_plate && (
                  <span className="form-error">{errors.car_license_plate}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="car_make" className="form-label">
                  יצרן *
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
                  placeholder="לדוגמה: טויוטה, הונדה, מאזדה"
                  disabled={isSubmitting}
                />
                {errors.car_make && (
                  <span className="form-error">{errors.car_make}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="car_model" className="form-label">
                  דגם *
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
                  placeholder="לדוגמה: קורולה, סיוויק, CX-5"
                  disabled={isSubmitting}
                />
                {errors.car_model && (
                  <span className="form-error">{errors.car_model}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="car_color" className="form-label">
                  צבע *
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
                  placeholder="לדוגמה: לבן, שחור, כסוף"
                  disabled={isSubmitting}
                />
                {errors.car_color && (
                  <span className="form-error">{errors.car_color}</span>
                )}
              </div>
            </div>

            <button
              type="submit"
              className={`save-button ${saveSuccess ? "success" : ""}`}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "שומר..."
                : saveSuccess
                  ? "נשמר!"
                  : "שמור שינויים"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
