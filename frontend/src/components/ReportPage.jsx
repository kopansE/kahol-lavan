import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../contexts/ToastContext";
import "./ReportPage.css";

const REPORT_REASONS = [
  { value: "no_show", label: "לא הופיע - המשתמש לא הגיע" },
  { value: "wrong_location", label: "מיקום שגוי - מקום החניה לא היה נכון" },
  { value: "harassment", label: "הטרדה - התנהגות לא ראויה" },
  { value: "fraud", label: "הונאה - פעילות מרמה" },
  { value: "other", label: "אחר" },
];

const ReportPage = ({
  onBack,
  onClose,
  reportedUserId,
  reportedUserName,
  transferRequestId,
}) => {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reportType) {
      setError("אנא בחר סיבה לדיווח שלך");
      return;
    }

    if (!description.trim()) {
      setError("אנא ספק תיאור של הבעיה");
      return;
    }

    if (description.trim().length < 10) {
      setError("אנא ספק תיאור מפורט יותר (לפחות 10 תווים)");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        setError("שגיאת אימות. אנא התחבר מחדש.");
        return;
      }

      // Determine severity based on report type
      let severity = "medium";
      if (reportType === "fraud" || reportType === "harassment") {
        severity = "high";
      } else if (reportType === "other") {
        severity = "low";
      }

      const { error: insertError } = await supabase.from("reports").insert({
        reporter_id: userId,
        reported_user_id: reportedUserId,
        transfer_request_id: transferRequestId,
        report_type: reportType,
        description: description.trim(),
        severity: severity,
        status: "pending",
      });

      if (insertError) {
        console.error("Error submitting report:", insertError);
        setError("שליחת הדיווח נכשלה. אנא נסה שוב.");
        return;
      }

      showToast("הדיווח נשלח בהצלחה. נבדוק אותו בהקדם.");
      onClose();
    } catch (err) {
      console.error("Error submitting report:", err);
      setError("אירעה שגיאה בלתי צפויה. אנא נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="report-page">
      <div className="page-header">
        <button className="back-button" onClick={onBack}>
          ‹
        </button>
        <h2 className="page-title">דווח על משתמש</h2>
        <button className="page-close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="page-content">
        <div className="report-info">
          <p>
            אתה מדווח על: <strong>{reportedUserName || "משתמש לא ידוע"}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label htmlFor="report-reason">סיבת הדיווח *</label>
            <select
              id="report-reason"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="report-select"
              disabled={isSubmitting}
            >
              <option value="">בחר סיבה...</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="report-description">תיאור *</label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="אנא תאר בפירוט מה קרה..."
              className="report-textarea"
              rows={5}
              disabled={isSubmitting}
            />
          </div>

          {error && <div className="report-error">{error}</div>}

          <div className="report-actions">
            <button
              type="button"
              className="report-button cancel-button"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              ביטול
            </button>
            <button
              type="submit"
              className="report-button submit-button"
              disabled={isSubmitting || !reportType || !description.trim()}
            >
              {isSubmitting ? "שולח..." : "שלח דיווח"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportPage;
