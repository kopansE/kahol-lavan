import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { supabase } from "../config/supabase";
import { colors } from "../styles/colors";
import { useToast } from "../contexts/ToastContext";

const REPORT_REASONS = [
  { value: "no_show", label: "לא הופיע - המשתמש לא הגיע" },
  { value: "wrong_location", label: "מיקום שגוי - מקום החניה לא היה נכון" },
  { value: "harassment", label: "הטרדה - התנהגות לא ראויה" },
  { value: "fraud", label: "הונאה - פעילות מרמה" },
  { value: "other", label: "אחר" },
];

const ReportScreen = ({ route, navigation }) => {
  const { reportedUserId, reportedUserName, transferRequestId } = route.params;
  const { showToast } = useToast();
  const [reportType, setReportType] = useState("");
  const [reportTypeLabel, setReportTypeLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleSelectReason = (reason) => {
    setReportType(reason.value);
    setReportTypeLabel(reason.label);
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    if (!reportType) {
      showToast("אנא בחר סיבה לדיווח");
      return;
    }

    if (!description.trim()) {
      showToast("אנא ספק תיאור של הבעיה");
      return;
    }

    if (description.trim().length < 10) {
      showToast("אנא ספק תיאור מפורט יותר (לפחות 10 תווים)");
      return;
    }

    try {
      setIsSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showToast("שגיאת אימות. אנא התחבר מחדש.");
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
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        transfer_request_id: transferRequestId,
        report_type: reportType,
        description: description.trim(),
        severity: severity,
        status: "pending",
      });

      if (insertError) {
        console.error("Error submitting report:", insertError);
        showToast("שליחת הדיווח נכשלה. אנא נסה שוב.");
        return;
      }

      showToast("הדיווח נשלח בהצלחה. נבדוק אותו בהקדם.");
      navigation.goBack();
    } catch (err) {
      console.error("Error submitting report:", err);
      showToast("אירעה שגיאה בלתי צפויה. אנא נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const renderReasonItem = ({ item }) => (
    <TouchableOpacity
      style={styles.reasonItem}
      onPress={() => handleSelectReason(item)}
    >
      <Text style={styles.reasonItemText}>{item.label}</Text>
      {reportType === item.value && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>דווח על משתמש</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            אתה מדווח על:{" "}
            <Text style={styles.infoName}>
              {reportedUserName || "משתמש לא ידוע"}
            </Text>
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>סיבת הדיווח *</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowPicker(true)}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.selectButtonText,
                !reportType && styles.placeholderText,
              ]}
            >
              {reportTypeLabel || "בחר סיבה..."}
            </Text>
            <Text style={styles.selectArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>תיאור *</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="אנא תאר בפירוט מה קרה..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>ביטול</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.submitButton,
              (!reportType || !description.trim() || isSubmitting) &&
                styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={!reportType || !description.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.submitButtonText}>שלח דיווח</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reason Picker Modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>בחר סיבה</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={REPORT_REASONS}
              renderItem={renderReasonItem}
              keyExtractor={(item) => item.value}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  infoBox: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
  },
  infoName: {
    fontWeight: "600",
    color: "#333",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  selectButton: {
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectButtonText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  placeholderText: {
    color: "#999",
  },
  selectArrow: {
    fontSize: 10,
    color: "#666",
    marginLeft: 8,
  },
  textArea: {
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    color: "#333",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  submitButton: {
    backgroundColor: colors.primaryGradientStart,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalClose: {
    fontSize: 28,
    color: "#666",
    lineHeight: 28,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  reasonItemText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    color: colors.primaryGradientStart,
    fontWeight: "600",
  },
  separator: {
    height: 1,
    backgroundColor: "#eee",
  },
});

export default ReportScreen;
