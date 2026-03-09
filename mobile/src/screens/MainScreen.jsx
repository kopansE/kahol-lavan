import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useToast } from "../contexts/ToastContext";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { supabase } from "../config/supabase";
import MapContainer from "../components/MapContainer";
import LoadingSpinner from "../components/LoadingSpinner";
import PinConfirmationModal from "../components/PinConfirmationModal";
import ParkingDetailModal from "../components/ParkingDetailModal";
import PublishedParkingDetailModal from "../components/PublishedParkingDetailModal";
import ReservedParkingDetailModal from "../components/ReservedParkingDetailModal";
import OwnParkingDetailModal from "../components/OwnParkingDetailModal";
import CarDataFormModal from "../components/CarDataFormModal";
import SideMenu from "../components/SideMenu";
import LeavingParkingButton from "../components/LeavingParkingButton";
import NotLeavingParkingButton from "../components/NotLeavingParkingButton";
import ReservedParkingButton from "../components/ReservedParkingButton";
import CarDataBanner from "../components/CarDataBanner";
import SearchBar from "../components/SearchBar";
import { colors } from "../styles/colors";
import { reverseGeocode } from "../utils/geocoding";
import { getParkingZone } from "../utils/parkingZoneUtils";
import {
  savePin,
  activatePin,
  deactivatePin,
  getActivePins,
  getPendingNotifications,
  getUserProfile,
  acceptReservation,
  declineReservation,
  completePaymentSetup,
} from "../utils/edgeFunctions";

const MainScreen = ({ user, onSignOut, navigation }) => {
  const { showToast } = useToast();
  const [userLocation, setUserLocation] = useState(null);
  const [otherUsersPins, setOtherUsersPins] = useState([]);
  const [userOwnPin, setUserOwnPin] = useState(null);
  const [userReservedPins, setUserReservedPins] = useState([]);
  const [pendingPin, setPendingPin] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pinAddress, setPinAddress] = useState("");
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [selectedParking, setSelectedParking] = useState(null);
  const [selectedReservedParking, setSelectedReservedParking] = useState(null);
  const [selectedOwnParking, setSelectedOwnParking] = useState(null);
  const [reservedByName, setReservedByName] = useState(null);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [userDataComplete, setUserDataComplete] = useState(true);
  const [showCarDataModal, setShowCarDataModal] = useState(false);
  const [publishedPins, setPublishedPins] = useState([]);
  const [selectedPublishedParking, setSelectedPublishedParking] =
    useState(null);
  const [searchResult, setSearchResult] = useState(null);

  useEffect(() => {
    if (user) {
      loadUserOwnPin(user.id);
      loadOtherUsersPins(user.id);
      loadPendingNotifications();
      loadUserProfile();
      getUserLocation();
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadUserOwnPin(user.id);
        loadOtherUsersPins(user.id);
        loadPendingNotifications();
      }
    }, [user]),
  );

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      loadPendingNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleDeepLink = async ({ url }) => {
      if (url) {
        const parsedUrl = Linking.parse(url);
        const paymentSetup = parsedUrl.queryParams?.payment_setup;

        if (paymentSetup === "complete" && user) {
          try {
            const result = await completePaymentSetup();
            if (result.success) {
              showToast(
                `אמצעי תשלום נוסף בהצלחה! 4 ספרות אחרונות: ${result.payment_method.last4}`,
              );
            }
          } catch (error) {
            console.error("Error completing payment setup:", error);
            showToast("שמירת אמצעי התשלום נכשלה. אנא נסה שוב.");
          }
        } else if (paymentSetup === "cancelled") {
          showToast("הגדרת התשלום בוטלה.");
        } else if (paymentSetup === "error") {
          showToast("אירעה שגיאה בהגדרת התשלום.");
        }
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setUserLocation([32.0853, 34.7818]); // Default Tel Aviv
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserLocation([location.coords.latitude, location.coords.longitude]);
    } catch (error) {
      console.error("Error getting location:", error);
      setUserLocation([32.0853, 34.7818]); // Default Tel Aviv
    }
  };

  const loadUserOwnPin = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("pins")
        .select(
          "id, position, parking_zone, status, created_at, reserved_by, address",
        )
        .eq("user_id", userId)
        .in("status", ["waiting", "active", "reserved", "published"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading own pin:", error);
        return;
      }

      if (data) {
        const pin = {
          id: data.id,
          position: data.position,
          parking_zone: data.parking_zone,
          status: data.status,
          timestamp: data.created_at,
          reserved_by: data.reserved_by,
          address: data.address,
        };
        setUserOwnPin(pin);

        if (data.status === "reserved" && data.reserved_by) {
          fetchReservedUserName(data.reserved_by);
        } else {
          setReservedByName(null);
        }
      } else {
        setUserOwnPin(null);
        setReservedByName(null);
      }
    } catch (error) {
      console.error("Error loading user own pin:", error);
    }
  };

  const fetchReservedUserName = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("full_name, car_make, car_model, car_color, car_license_plate")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching reserved user name:", error);
        setReservedByName("משתמש לא ידוע");
        return;
      }

      if (data) {
        setReservedByName(data.full_name || "משתמש לא ידוע");
        // Store the full user data for display
        setUserOwnPin((prev) =>
          prev
            ? {
                ...prev,
                reserved_by_user: data,
              }
            : null,
        );
      }
    } catch (error) {
      console.error("Error fetching reserved user name:", error);
      setReservedByName("משתמש לא ידוע");
    }
  };

  const loadOtherUsersPins = async (userId) => {
    try {
      const result = await getActivePins();

      if (result.pins && result.pins.length > 0) {
        const activePins = [];
        const reservedByUser = [];
        const published = [];

        result.pins.forEach((pin) => {
          if (pin.status === "reserved" && pin.reserved_by === userId) {
            reservedByUser.push({
              id: pin.id,
              position: pin.position,
              parking_zone: pin.parking_zone,
              timestamp: pin.created_at,
              status: pin.status,
              reserved_by: pin.reserved_by,
              user: pin.user,
              address: pin.address,
            });
          } else if (pin.status === "active") {
            activePins.push({
              id: pin.id,
              position: pin.position,
              parking_zone: pin.parking_zone,
              timestamp: pin.created_at,
              user: pin.user,
              address: pin.address,
            });
          } else if (pin.status === "published" && pin.user_id !== userId) {
            published.push({
              id: pin.id,
              position: pin.position,
              parking_zone: pin.parking_zone,
              timestamp: pin.created_at,
              user: pin.user,
              address: pin.address,
              scheduled_for: pin.scheduled_for,
              status: pin.status,
              future_reservation_id: pin.future_reservation_id || null,
              future_reserved_by: pin.future_reserved_by || null,
            });
          }
        });

        setOtherUsersPins(activePins);
        setUserReservedPins(reservedByUser);
        setPublishedPins(published);
      } else {
        setOtherUsersPins([]);
        setUserReservedPins([]);
        setPublishedPins([]);
      }
    } catch (error) {
      console.error("Error loading other users pins:", error);
    }
  };

  const handleMapPress = async (coordinate) => {
    // Calculate parking zone
    const parkingZoneInfo = getParkingZone(
      coordinate.latitude,
      coordinate.longitude,
    );

    const newPin = {
      id: Date.now(),
      position: [coordinate.latitude, coordinate.longitude],
      timestamp: new Date().toISOString(),
      parking_zone: parkingZoneInfo ? parkingZoneInfo.zone : null,
    };

    setPendingPin(newPin);
    setShowConfirmModal(true);
    setIsLoadingAddress(true);
    setPinAddress("");

    const address = await reverseGeocode(
      coordinate.latitude,
      coordinate.longitude,
    );
    setPinAddress(address);
    setIsLoadingAddress(false);
  };

  const handleConfirmPin = async () => {
    if (!pendingPin || !user) return;

    try {
      await savePin(pendingPin.position, pinAddress);
      await loadUserOwnPin(user.id);
    } catch (error) {
      console.error("Error saving pin:", error);
      showToast(`שמירת מיקום החניה נכשלה: ${error.message}`);
    }

    setShowConfirmModal(false);
    setPendingPin(null);
    setPinAddress("");
  };

  const handleCancelPin = () => {
    setShowConfirmModal(false);
    setPendingPin(null);
    setPinAddress("");
  };

  const handleActivatePin = async () => {
    if (!userOwnPin || !user) return;

    try {
      await activatePin(userOwnPin.id);
      await loadUserOwnPin(user.id);
      await loadOtherUsersPins(user.id);
    } catch (error) {
      console.error("Error activating pin:", error);
      showToast(`הפעלת הסימון נכשלה: ${error.message}`);
    }
  };

  const handleDeactivatePin = async () => {
    if (!userOwnPin || !user) return;

    try {
      await deactivatePin(userOwnPin.id);
      await loadUserOwnPin(user.id);
      await loadOtherUsersPins(user.id);
    } catch (error) {
      console.error("Error deactivating pin:", error);
      showToast(`ביטול הסימון נכשל: ${error.message}`);
    }
  };

  const handlePinClick = async (pin, pinType) => {
    if (!pin.address && pin.position) {
      const address = await reverseGeocode(pin.position[0], pin.position[1]);
      pin.address = address;
    }

    if (pinType === "reserved") {
      setSelectedReservedParking(pin);
    } else {
      setSelectedParking(pin);
    }
  };

  const handlePublishedPinClick = async (pin) => {
    if (!pin.address && pin.position) {
      const address = await reverseGeocode(pin.position[0], pin.position[1]);
      pin.address = address;
    }
    setSelectedPublishedParking(pin);
  };

  const handleOwnPinClick = (pin) => {
    setSelectedOwnParking(pin);
  };

  const loadPendingNotifications = async () => {
    try {
      const result = await getPendingNotifications();
      setPendingNotifications(result.notifications || []);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const result = await getUserProfile();
      setUserDataComplete(result.profile?.user_data_complete ?? true);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const handleAcceptReservation = async (notificationId) => {
    try {
      const result = await acceptReservation(notificationId);
      showToast(
        `ההזמנה אושרה! סכום שהתקבל: ₪${result.amount_received}, יתרה חדשה: ₪${result.new_balance}`,
      );

      await loadUserOwnPin(user.id);
      await loadOtherUsersPins(user.id);
      await loadPendingNotifications();
    } catch (error) {
      console.error("Error accepting reservation:", error);
      showToast(`אישור ההזמנה נכשל: ${error.message}`);
    }
  };

  const handleDeclineReservation = async (notificationId) => {
    try {
      const result = await declineReservation(notificationId);
      showToast("ההזמנה נדחתה בהצלחה.");

      await loadUserOwnPin(user.id);
      await loadOtherUsersPins(user.id);
      await loadPendingNotifications();
    } catch (error) {
      console.error("Error declining reservation:", error);
      showToast(`דחיית ההזמנה נכשלה: ${error.message}`);
    }
  };

  const handleCarDataBannerClick = () => {
    setShowCarDataModal(true);
  };

  const handleCarDataModalClose = () => {
    setShowCarDataModal(false);
  };

  const handleCarDataSuccess = async () => {
    setUserDataComplete(true);
    await loadUserProfile();
  };

  const handleSearchResult = (result) => {
    setSearchResult(result);
  };

  const handleClearSearch = () => {
    setSearchResult(null);
  };

  if (!userLocation) {
    return <LoadingSpinner />;
  }

  return (
    <View
      style={[
        styles.container,
        !userDataComplete && styles.containerWithBanner,
      ]}
    >
      {!userDataComplete && (
        <CarDataBanner onClickBanner={handleCarDataBannerClick} />
      )}

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setIsPaymentMenuOpen(true)}
      >
        <View style={styles.menuIcon}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </View>
      </TouchableOpacity>

      <MapContainer
        userLocation={userLocation}
        otherUsersPins={otherUsersPins}
        userOwnPin={userOwnPin}
        userReservedPins={userReservedPins}
        publishedPins={publishedPins}
        onMapPress={handleMapPress}
        onPinClick={handlePinClick}
        onOwnPinClick={handleOwnPinClick}
        onPublishedPinClick={handlePublishedPinClick}
        searchResult={searchResult}
      />

      <SearchBar
        onSearchResult={handleSearchResult}
        onClearSearch={handleClearSearch}
      />

      {userOwnPin && userOwnPin.status === "waiting" && (
        <LeavingParkingButton
          waitingPin={userOwnPin}
          onActivate={handleActivatePin}
        />
      )}

      {userOwnPin && userOwnPin.status === "active" && (
        <NotLeavingParkingButton
          activePin={userOwnPin}
          onDeactivate={handleDeactivatePin}
        />
      )}

      {userOwnPin && userOwnPin.status === "reserved" && (
        <ReservedParkingButton
          reservedPin={userOwnPin}
          reservedByName={reservedByName}
        />
      )}

      <PinConfirmationModal
        visible={showConfirmModal}
        address={pinAddress}
        parkingZone={pendingPin?.parking_zone}
        isLoading={isLoadingAddress}
        onConfirm={handleConfirmPin}
        onCancel={handleCancelPin}
      />

      <SideMenu
        visible={isPaymentMenuOpen}
        onClose={() => setIsPaymentMenuOpen(false)}
        user={user}
        onSignOut={onSignOut}
        onNavigateToWallet={() => navigation.navigate("Wallet", { user })}
        onNavigateToChats={() => navigation.navigate("ChatChannelList")}
        onNavigateToSettings={() => navigation.navigate("Settings", { user })}
        onNavigateToReports={() => navigation.navigate("Reports")}
      />

      <ParkingDetailModal
        visible={!!selectedParking}
        parking={selectedParking}
        onClose={() => setSelectedParking(null)}
        userReservedPins={userReservedPins}
      />

      <PublishedParkingDetailModal
        visible={!!selectedPublishedParking}
        parking={selectedPublishedParking}
        onClose={() => setSelectedPublishedParking(null)}
        userReservedPins={userReservedPins}
        currentUserId={user?.id}
      />

      <ReservedParkingDetailModal
        visible={!!selectedReservedParking}
        parking={selectedReservedParking}
        onClose={() => setSelectedReservedParking(null)}
      />

      <OwnParkingDetailModal
        visible={!!selectedOwnParking}
        parking={selectedOwnParking}
        onClose={() => setSelectedOwnParking(null)}
      />

      <CarDataFormModal
        visible={showCarDataModal}
        onClose={handleCarDataModalClose}
        onSuccess={handleCarDataSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerWithBanner: {
    paddingTop: 50,
  },
  menuButton: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primaryGradientStart,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuIcon: {
    width: 24,
    height: 18,
    justifyContent: "space-between",
  },
  menuLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.white,
    borderRadius: 1,
  },
  statusButton: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  statusButtonIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  statusButtonTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  statusButtonSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 2,
  },
});

export default MainScreen;
