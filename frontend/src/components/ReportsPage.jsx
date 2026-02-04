import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./ReportsPage.css";

const ReportsPage = ({ user, onBack, onClose }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("reports")
        .select(`
          id,
          report_type,
          description,
          status,
          created_at,
          reported_user_id,
          resolution_notes,
          action_taken
        `)
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading reports:", error);
        return;
      }

      // Fetch reported user names
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.reported_user_id))];
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);

        const profileMap = {};
        profiles?.forEach(p => {
          profileMap[p.id] = p.full_name;
        });

        const reportsWithNames = data.map(r => ({
          ...r,
          reported_user_name: profileMap[r.reported_user_id] || "Unknown User"
        }));

        setReports(reportsWithNames);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "pending":
        return "status-pending";
      case "under_review":
        return "status-review";
      case "resolved":
        return "status-resolved";
      case "dismissed":
        return "status-dismissed";
      default:
        return "";
    }
  };

  const getReportTypeLabel = (type) => {
    const labels = {
      no_show: "No Show",
      wrong_location: "Wrong Location",
      harassment: "Harassment",
      fraud: "Fraud",
      other: "Other"
    };
    return labels[type] || type;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <button className="back-button" onClick={onBack}>
          ‹
        </button>
        <h2 className="page-title">My Reports</h2>
        <button className="page-close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="loading-state">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No Reports</h3>
            <p>You haven't submitted any reports yet.</p>
          </div>
        ) : (
          <div className="reports-list">
            {reports.map((report) => (
              <div key={report.id} className="report-card">
                <div className="report-header">
                  <span className="report-type">
                    {getReportTypeLabel(report.report_type)}
                  </span>
                  <span className={`report-status ${getStatusBadgeClass(report.status)}`}>
                    {report.status.replace("_", " ")}
                  </span>
                </div>
                <div className="report-user">
                  Reported: {report.reported_user_name}
                </div>
                <div className="report-description">
                  {report.description}
                </div>
                <div className="report-date">
                  {formatDate(report.created_at)}
                </div>
                {report.status === "resolved" && report.resolution_notes && (
                  <div className="report-resolution">
                    <strong>Resolution:</strong> {report.resolution_notes}
                    {report.action_taken && (
                      <span className="action-taken"> ({report.action_taken.replace("_", " ")})</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
