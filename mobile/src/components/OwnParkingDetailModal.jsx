import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../styles/colors";
import { useToast } from "../contexts/ToastContext";
import { formatParkingZone } from "../utils/parkingZoneUtils";

/**
 * Opens the device's default navigation app with directions to the specified coordinates
 */
const openNavigation = async (lat, lng, address = "") => {
  const destination = `${lat},${lng}`;
  const label = encodeURIComponent(address || "מיקום חניה");

  if (Platform.OS === "ios") {
    const googleMapsUrl = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
    const appleMapsUrl = `maps://?daddr=${destination}&dirflg=d`;

    try {
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsUrl);
        return true;
      }
    } catch (error) {
      console.log("Google Maps not available, trying Apple Maps");
    }

    try {
      await Linking.openURL(appleMapsUrl);
      return true;
    } catch (error) {
      console.error("Failed to open Apple Maps:", error);
    }
  } else if (Platform.OS === "android") {
    const googleMapsUrl = `google.navigation:q=${destination}`;
    const geoUrl = `geo:${destination}?q=${destination}(${label})`;

    try {
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsUrl);
        return true;
      }
    } catch (error) {
      console.log("Google Maps navigation not available, trying geo URI");
    }

    try {
      await Linking.openURL(geoUrl);
      return true;
    } catch (error) {
      console.error("Failed to open geo URI:", error);
    }
  }

  // Fallback to web Google Maps
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  try {
    await Linking.openURL(webUrl);
    return true;
  } catch (error) {
    console.error("Failed to open Google Maps web:", error);
    return false;
  }
};

/**
 * Format time as HH:MM
 */
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/**
 * Format date as DD.M.YYYY
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Get status display info
 */
const getStatusInfo = (status) => {
  switch (status) {
    case "active":
      return {
        text: "פעיל",
        hebrewText: "פעיל",
        color: "#28a745",
        bgColor: "#d4edda",
      };
    case "waiting":
      return {
        text: "ממתין",
        hebrewText: "בתור להקצאה",
        color: "#856404",
        bgColor: "#fff3cd",
      };
    case "reserved":
      return {
        text: "הוזמנה",
        hebrewText: "שמור",
        color: "#dc3545",
        bgColor: "#f8d7da",
      };
    default:
      return {
        text: "פעיל",
        hebrewText: "פעיל",
        color: "#28a745",
        bgColor: "#d4edda",
      };
  }
};

const OwnParkingDetailModal = ({ visible, parking, onClose }) => {
  const { showToast } = useToast();
  const [isNavigating, setIsNavigating] = useState(false);

  const hasValidCoordinates =
    parking?.position &&
    Array.isArray(parking.position) &&
    parking.position.length >= 2 &&
    typeof parking.position[0] === "number" &&
    typeof parking.position[1] === "number";

  const handleNavigateClick = async () => {
    if (isNavigating || !hasValidCoordinates) return;

    try {
      setIsNavigating(true);
      const [lat, lng] = parking.position;
      const success = await openNavigation(lat, lng, parking.address);

      if (!success) {
        showToast("לא ניתן לפתוח אפליקציית ניווט.");
      }
    } catch (error) {
      console.error("Error opening navigation:", error);
      showToast("פתיחת הניווט נכשלה. אנא נסה שוב.");
    } finally {
      setIsNavigating(false);
    }
  };

  if (!parking) return null;

  const statusInfo = getStatusInfo(parking.status);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              style={styles.header}
            >
              <View style={styles.headerContent}>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitleHebrew}>מקום החניה שלך</Text>
                  <Text style={styles.headerTitleEnglish}>החניה שלך</Text>
                </View>
                <View style={styles.headerIcon}>
                  <View style={styles.iconCircle}>
                    <View style={styles.iconDot} />
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Content */}
            <View style={styles.content}>
              {/* Address Card */}
              <View style={styles.addressCard}>
                <View style={styles.addressMapPreview}>
                  <Text style={styles.mapPinIcon}>📍</Text>
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>כתובת</Text>
                  <Text style={styles.addressText}>
                    {parking.address || "כתובת לא ידועה"}
                  </Text>
                </View>
              </View>

              {/* Status Bar */}
              <View style={styles.statusBar}>
                <View style={styles.zoneBadge}>
                  <Text style={styles.zoneBadgeText}>
                    {formatParkingZone(parking.parking_zone)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusInfo,
                    { backgroundColor: statusInfo.bgColor },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: statusInfo.color }]}
                  >
                    {statusInfo.text}
                  </Text>
                  <Text
                    style={[styles.statusHebrew, { color: statusInfo.color }]}
                  >
                    {statusInfo.hebrewText}
                  </Text>
                  <Text style={styles.statusIcon}>⏱️</Text>
                </View>
              </View>

              {/* Date and Time */}
              <View style={styles.datetimeContainer}>
                <View style={styles.datetimeBox}>
                  <Text style={styles.datetimeLabel}>שעה</Text>
                  <View style={styles.datetimeValue}>
                    <Text style={styles.datetimeText}>
                      {formatTime(parking.timestamp)}
                    </Text>
                    <Text style={styles.datetimeIcon}>🕐</Text>
                  </View>
                </View>
                <View style={styles.datetimeBox}>
                  <Text style={styles.datetimeLabel}>תאריך</Text>
                  <View style={styles.datetimeValue}>
                    <Text style={styles.datetimeText}>
                      {formatDate(parking.timestamp)}
                    </Text>
                    <Text style={styles.datetimeIcon}>📅</Text>
                  </View>
                </View>
              </View>

              {/* Navigate Button */}
              <TouchableOpacity
                style={[
                  styles.navigateButton,
                  (!hasValidCoordinates || isNavigating) &&
                    styles.navigateButtonDisabled,
                ]}
                onPress={handleNavigateClick}
                disabled={!hasValidCoordinates || isNavigating}
              >
                {isNavigating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <View style={styles.navigateButtonContent}>
                    <Text style={styles.navigateIcon}>🧭</Text>
                    <Text style={styles.navigateButtonText}>
                      {hasValidCoordinates ? "נווט" : "מיקום לא זמין"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>סגור</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#f5f7fa",
    borderRadius: 24,
    width: "100%",
    maxWidth: 360,
    maxHeight: "90%",
    overflow: "hidden",
  },
  header: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    alignItems: "flex-end",
  },
  headerTitleHebrew: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 4,
  },
  headerTitleEnglish: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  addressCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  addressMapPreview: {
    width: 100,
    height: 100,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPinIcon: {
    fontSize: 32,
  },
  addressInfo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.darkGray,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 20,
    textAlign: "right",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  zoneBadge: {
    backgroundColor: "#f0f4ff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  zoneBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a5568",
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  statusHebrew: {
    fontSize: 12,
  },
  statusIcon: {
    fontSize: 18,
  },
  datetimeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  datetimeBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  datetimeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray,
    marginBottom: 8,
  },
  datetimeValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  datetimeText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.darkGray,
  },
  datetimeIcon: {
    fontSize: 18,
  },
  navigateButton: {
    backgroundColor: colors.primaryGradientStart,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryGradientStart,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  navigateButtonDisabled: {
    backgroundColor: colors.mediumGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  navigateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  navigateIcon: {
    fontSize: 20,
  },
  navigateButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    backgroundColor: "#e8e8e8",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.gray,
    fontSize: 15,
    fontWeight: "600",
  },
});

export default OwnParkingDetailModal;
