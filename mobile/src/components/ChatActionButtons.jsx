import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const ChatActionButtons = ({
  onCancel,
  onApprove,
  onExtension,
  isProcessing = false,
  approvalState = {},
}) => {
  const { userApproved, otherUserApproved, bothApproved } = approvalState;

  const handleCancel = () => {
    if (onCancel && !isProcessing && !bothApproved) {
      onCancel();
    }
  };

  const handleApprove = () => {
    if (onApprove && !isProcessing && !bothApproved) {
      onApprove();
    }
  };

  const handleExtension = () => {
    if (onExtension && !isProcessing) {
      onExtension();
    }
  };

  // Determine button states and text
  const approveButtonDisabled = isProcessing || bothApproved;
  const cancelButtonDisabled = isProcessing || bothApproved;

  const getApproveButtonText = () => {
    if (bothApproved) return "הושלם";
    if (isProcessing) return "מעבד...";
    if (userApproved && !otherUserApproved) return "ממתין...";
    return "אשר";
  };

  const getCancelButtonText = () => {
    if (bothApproved) return "הושלם";
    if (isProcessing) return "מעבד...";
    return "בטל";
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, cancelButtonDisabled && styles.buttonDisabled]}
        onPress={handleCancel}
        activeOpacity={cancelButtonDisabled ? 1 : 0.8}
        disabled={cancelButtonDisabled}
      >
        <LinearGradient
          colors={
            cancelButtonDisabled
              ? ["#d0d0d0", "#b0b0b0"]
              : ["#ff6b6b", "#ee5a6f"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.icon}>✕</Text>
              <Text style={styles.label}>{getCancelButtonText()}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, approveButtonDisabled && styles.buttonDisabled]}
        onPress={handleApprove}
        activeOpacity={approveButtonDisabled ? 1 : 0.8}
        disabled={approveButtonDisabled}
      >
        <LinearGradient
          colors={
            bothApproved
              ? ["#4dabf7", "#339af0"]
              : approveButtonDisabled
                ? ["#d0d0d0", "#b0b0b0"]
                : ["#51cf66", "#37b24d"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.icon}>
                {bothApproved
                  ? "✓✓"
                  : userApproved && !otherUserApproved
                    ? "⏳"
                    : "✓"}
              </Text>
              <Text
                style={[
                  styles.label,
                  userApproved && !otherUserApproved && styles.smallLabel,
                ]}
              >
                {getApproveButtonText()}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleExtension}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#ffd43b", "#fab005"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={[styles.icon, styles.darkIcon]}>+</Text>
          <Text style={[styles.label, styles.darkLabel]}>הארכה</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  icon: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "white",
  },
  smallLabel: {
    fontSize: 12,
  },
  darkIcon: {
    color: "#333",
  },
  darkLabel: {
    color: "#333",
  },
});

export default ChatActionButtons;
