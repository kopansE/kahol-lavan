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
import { commonStyles } from "../styles/common";
import { colors } from "../styles/colors";
import { useToast } from "../contexts/ToastContext";
import { reserveParking } from "../utils/edgeFunctions";
import { formatParkingZone } from "../utils/parkingZoneUtils";

/**
 * Opens the device's default navigation app with directions to the specified coordinates
 * @param {number} lat - Latitude of the destination
 * @param {number} lng - Longitude of the destination
 * @param {string} address - Address label for the destination (optional)
 */
const openNavigation = async (lat, lng, address = "") => {
  const destination = `${lat},${lng}`;
  const label = encodeURIComponent(address || "מיקום חניה");

  if (Platform.OS === "ios") {
    // Try Google Maps first, then Apple Maps
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
    // Try Google Maps intent first, then geo URI
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

const ParkingDetailModal = ({
  visible,
  parking,
  onClose,
  userReservedPins,
}) => {
  const { showToast } = useToast();
  const [isReserving, setIsReserving] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const hasExistingReservation =
    userReservedPins && userReservedPins.length > 0;

  // Check if we have valid coordinates
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

  const handleReserveClick = async () => {
    if (isReserving) return;

    if (hasExistingReservation) {
      showToast("כבר יש לך הזמנה פעילה. אנא בטל אותה לפני הזמנת מקום נוסף.");
      return;
    }

    try {
      setIsReserving(true);

      const result = await reserveParking(parking.id);

      showToast(`החניה הוזמנה בהצלחה! סכום ששולם: ₪${result.amount_paid}`);
      onClose();
    } catch (error) {
      console.error("Error reserving parking:", error);
      showToast(`הזמנת החניה נכשלה: ${error.message}`);
    } finally {
      setIsReserving(false);
    }
  };

  if (!parking) return null;

  const userData = parking.user || parking.users || parking;
  const ownerName = userData?.full_name || "בעלים לא ידוע";
  const carMake = userData?.car_make;
  const carModel = userData?.car_model;
  const carColor = userData?.car_color;
  const licensePlate = userData?.car_license_plate;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={commonStyles.modalOverlay}>
        <View style={[commonStyles.modalContent, styles.modalContent]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.address}>{parking.address}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>מיקום</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🅿️</Text>
                <Text style={styles.infoText}>
                  {formatParkingZone(parking.parking_zone)}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>בעלים</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>👤</Text>
                <Text style={styles.infoText}>{ownerName}</Text>
              </View>
            </View>

            {(carMake || carModel || carColor || licensePlate) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>פרטי רכב</Text>
                {(carMake || carModel) && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🚗</Text>
                    <Text style={styles.infoText}>
                      {carMake} {carModel}
                    </Text>
                  </View>
                )}
                {carColor && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🎨</Text>
                    <Text style={styles.infoText}>{carColor}</Text>
                  </View>
                )}
                {licensePlate && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🔢</Text>
                    <Text style={[styles.infoText, styles.licensePlate]}>
                      {licensePlate}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {hasExistingReservation && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  ⚠️ כבר יש לך הזמנה פעילה. בטל אותה קודם כדי להזמין מקום אחר.
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.reserveButton,
                  (isReserving || hasExistingReservation) &&
                    styles.reserveButtonDisabled,
                ]}
                onPress={handleReserveClick}
                disabled={isReserving || hasExistingReservation}
              >
                {isReserving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.reserveButtonText}>
                      {hasExistingReservation ? "כבר הוזמנה" : "הזמן חניה"}
                    </Text>
                    <Text style={styles.reserveButtonPrice}>50 ₪</Text>
                  </>
                )}
              </TouchableOpacity>
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
                  <ActivityIndicator color={colors.primaryGradientStart} />
                ) : (
                  <View style={styles.navigateButtonContent}>
                    <Text style={styles.navigateIcon}>🧭</Text>
                    <Text
                      style={[
                        styles.navigateButtonText,
                        !hasValidCoordinates &&
                          styles.navigateButtonTextDisabled,
                      ]}
                    >
                      {hasValidCoordinates ? "נווט לחניה" : "מיקום לא זמין"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
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
  modalContent: {
    maxHeight: "80%",
  },
  header: {
    marginBottom: 24,
  },
  address: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.darkGray,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.darkGray,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    fontSize: 16,
    color: colors.darkGray,
  },
  licensePlate: {
    fontWeight: "600",
    letterSpacing: 2,
  },
  warningContainer: {
    backgroundColor: "#FFF3CD",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: "#856404",
    textAlign: "center",
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  reserveButton: {
    backgroundColor: colors.primaryGradientStart,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  reserveButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  reserveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  reserveButtonPrice: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "700",
  },
  navigateButton: {
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    alignItems: "center",
    justifyContent: "center",
  },
  navigateButtonDisabled: {
    borderColor: colors.mediumGray,
    backgroundColor: colors.lightGray,
  },
  navigateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navigateIcon: {
    fontSize: 18,
  },
  navigateButtonText: {
    color: colors.primaryGradientStart,
    fontSize: 16,
    fontWeight: "600",
  },
  navigateButtonTextDisabled: {
    color: colors.gray,
  },
  closeButton: {
    backgroundColor: colors.lightGray,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.gray,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ParkingDetailModal;
