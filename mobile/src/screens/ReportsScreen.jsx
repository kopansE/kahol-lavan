import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../config/supabase";
import { colors } from "../styles/colors";

const ReportsScreen = ({ navigation }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("reports")
        .select(
          `
          id,
          report_type,
          description,
          status,
          created_at,
          reported_user_id,
          resolution_notes,
          action_taken
        `,
        )
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading reports:", error);
        return;
      }

      // Fetch reported user names
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r) => r.reported_user_id))];
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);

        const profileMap = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p.full_name;
        });

        const reportsWithNames = data.map((r) => ({
          ...r,
          reported_user_name: profileMap[r.reported_user_id] || "משתמש לא ידוע",
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

  const getStatusStyle = (status) => {
    switch (status) {
      case "pending":
        return styles.statusPending;
      case "under_review":
        return styles.statusReview;
      case "resolved":
        return styles.statusResolved;
      case "dismissed":
        return styles.statusDismissed;
      default:
        return {};
    }
  };

  const getReportTypeLabel = (type) => {
    const labels = {
      no_show: "לא הופיע",
      wrong_location: "מיקום שגוי",
      harassment: "הטרדה",
      fraud: "הונאה",
      other: "אחר",
    };
    return labels[type] || type;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("he-IL", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderReport = ({ item }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportType}>
          {getReportTypeLabel(item.report_type)}
        </Text>
        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={[styles.statusText, getStatusStyle(item.status)]}>
            {item.status.replace("_", " ")}
          </Text>
        </View>
      </View>
      <Text style={styles.reportUser}>דווח על: {item.reported_user_name}</Text>
      <View style={styles.descriptionBox}>
        <Text style={styles.reportDescription}>{item.description}</Text>
      </View>
      <Text style={styles.reportDate}>{formatDate(item.created_at)}</Text>
      {item.status === "resolved" && item.resolution_notes && (
        <View style={styles.resolutionBox}>
          <Text style={styles.resolutionText}>
            <Text style={styles.resolutionLabel}>פתרון: </Text>
            {item.resolution_notes}
            {item.action_taken && (
              <Text style={styles.actionTaken}>
                {" "}
                ({item.action_taken.replace("_", " ")})
              </Text>
            )}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>הדיווחים שלי</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryGradientStart} />
          <Text style={styles.loadingText}>טוען דיווחים...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>אין דיווחים</Text>
          <Text style={styles.emptyText}>עדיין לא שלחת דיווחים.</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    backgroundColor: colors.primaryGradientStart,
  },
  backButton: {
    fontSize: 28,
    color: "white",
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  listContent: {
    padding: 15,
  },
  reportCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportType: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  statusPending: {
    backgroundColor: "#fff3cd",
    color: "#856404",
  },
  statusReview: {
    backgroundColor: "#cce5ff",
    color: "#004085",
  },
  statusResolved: {
    backgroundColor: "#d4edda",
    color: "#155724",
  },
  statusDismissed: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
  },
  reportUser: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  descriptionBox: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  reportDescription: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  reportDate: {
    fontSize: 12,
    color: "#999",
  },
  resolutionBox: {
    marginTop: 12,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    padding: 10,
  },
  resolutionText: {
    fontSize: 13,
    color: "#2e7d32",
  },
  resolutionLabel: {
    fontWeight: "600",
  },
  actionTaken: {
    fontStyle: "italic",
    color: "#1b5e20",
  },
});

export default ReportsScreen;
