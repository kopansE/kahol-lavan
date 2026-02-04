import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import "./ReportPage.css";

const REPORT_REASONS = [
  { value: "no_show", label: "No Show - User didn't show up" },
  { value: "wrong_location", label: "Wrong Location - Parking spot was incorrect" },
  { value: "harassment", label: "Harassment - Inappropriate behavior" },
  { value: "fraud", label: "Fraud - Deceptive or fraudulent activity" },
  { value: "other", label: "Other" }
];

const ReportPage = ({ 
  onBack, 
  onClose, 
  reportedUserId, 
  reportedUserName, 
  transferRequestId 
}) => {
  const [reportType, setReportType] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reportType) {
      setError("Please select a reason for your report");
      return;
    }
    
    if (!description.trim()) {
      setError("Please provide a description of the issue");
      return;
    }

    if (description.trim().length < 10) {
      setError("Please provide a more detailed description (at least 10 characters)");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        setError("Authentication error. Please log in again.");
        return;
      }

      // Determine severity based on report type
      let severity = "medium";
      if (reportType === "fraud" || reportType === "harassment") {
        severity = "high";
      } else if (reportType === "other") {
        severity = "low";
      }

      const { error: insertError } = await supabase
        .from("reports")
        .insert({
          reporter_id: userId,
          reported_user_id: reportedUserId,
          transfer_request_id: transferRequestId,
          report_type: reportType,
          description: description.trim(),
          severity: severity,
          status: "pending"
        });

      if (insertError) {
        console.error("Error submitting report:", insertError);
        setError("Failed to submit report. Please try again.");
        return;
      }

      alert("Report submitted successfully. We will review it shortly.");
      onClose();
    } catch (err) {
      console.error("Error submitting report:", err);
      setError("An unexpected error occurred. Please try again.");
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
        <h2 className="page-title">Report User</h2>
        <button className="page-close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="page-content">
        <div className="report-info">
          <p>You are reporting: <strong>{reportedUserName || "Unknown User"}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label htmlFor="report-reason">Reason for Report *</label>
            <select
              id="report-reason"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="report-select"
              disabled={isSubmitting}
            >
              <option value="">Select a reason...</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="report-description">Description *</label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe what happened in detail..."
              className="report-textarea"
              rows={5}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="report-error">
              {error}
            </div>
          )}

          <div className="report-actions">
            <button
              type="button"
              className="report-button cancel-button"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="report-button submit-button"
              disabled={isSubmitting || !reportType || !description.trim()}
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportPage;
