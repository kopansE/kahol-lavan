import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import MapContainer from "./components/MapContainer";
import LoadingSpinner from "./components/LoadingSpinner";
import LoginScreen from "./components/LoginScreen";
import PinConfirmationModal from "./components/PinConfirmationModal";
import LeavingParkingButton from "./components/LeavingParkingButton";
import NotLeavingParkingButton from "./components/NotLeavingParkingButton";
import ReservedParkingButton from "./components/ReservedParkingButton";
import CancelReservationModal from "./components/CancelReservationModal";
import SideMenu from "./components/SideMenu";
import ParkingDetailModal from "./components/ParkingDetailModal";
import ReservedParkingDetailModal from "./components/ReservedParkingDetailModal";
import OwnParkingDetailModal from "./components/OwnParkingDetailModal";
import CarDataBanner from "./components/CarDataBanner";
import CarDataFormModal from "./components/CarDataFormModal";
import SearchBar from "./components/SearchBar";
import { StreamChatProvider } from "./contexts/StreamChatContext";
import { getParkingZone } from "./utils/parkingZoneUtils";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelUserType, setCancelUserType] = useState(null); // 'reserving' or 'owner'
  const [pinToCancel, setPinToCancel] = useState(null);
  const [reservedByName, setReservedByName] = useState(null);
  const [userDataComplete, setUserDataComplete] = useState(true); // Assume true initially
  const [showCarDataModal, setShowCarDataModal] = useState(false);
  const [searchResult, setSearchResult] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        loadUserOwnPin(session.user.id);
        loadOtherUsersPins(session.user.id);
        loadUserProfile();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserOwnPin(session.user.id);
        loadOtherUsersPins(session.user.id);
        loadUserProfile();
      } else {
        setOtherUsersPins([]);
        setUserOwnPin(null);
        setUserReservedPins([]);
        setUserDataComplete(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle payment setup completion callback
  useEffect(() => {
    const handlePaymentSetupCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentSetup = urlParams.get("payment_setup");

      if (paymentSetup === "complete" && user) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (!token) {
            throw new Error("No session token");
          }

          const url = `${
            import.meta.env.VITE_SUPABASE_URL
          }/functions/v1/complete-payment-setup`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const result = await response.json();

          if (response.ok && result.success) {
            alert(
              `Payment method added successfully! Last 4 digits: ${result.payment_method.last4}`
            );
          } else {
            console.error("❌ Failed to complete payment setup:", result.error);
            alert(
              result.error || "Failed to save payment method. Please try again."
            );
          }
        } catch (error) {
          console.error("❌ Error completing payment setup:", error);
          alert("Failed to save payment method. Please try again.");
        } finally {
          // Clean up URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      } else if (paymentSetup === "cancelled") {
        alert("Payment setup was cancelled.");
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      } else if (paymentSetup === "error") {
        console.error("❌ Payment setup error");
        alert("An error occurred during payment setup.");
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    };

    if (user) {
      handlePaymentSetupCallback();
    }
  }, [user]);

  const loadUserOwnPin = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("pins")
        .select("id, position, parking_zone, status, created_at, reserved_by, address")
        .eq("user_id", userId)
        .in("status", ["waiting", "active", "reserved"])
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

        // If pin is reserved, fetch the reserved user's name
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
        setReservedByName("Unknown User");
        return;
      }

      if (data) {
        setReservedByName(data.full_name || "Unknown User");
        // Store the full user data for display
        if (userOwnPin) {
          setUserOwnPin(prev => ({
            ...prev,
            reserved_by_user: data
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching reserved user name:", error);
      setReservedByName("Unknown User");
    }
  };

  const loadOtherUsersPins = async (userId) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.error("No access token found");
        return;
      }

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/get-active-pins`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Error loading other users' pins:", result.error);
        return;
      }

      if (result.pins && result.pins.length > 0) {
        // Separate active pins and reserved pins that the user reserved
        const activePins = [];
        const reservedByUser = [];

        result.pins.forEach((pin) => {
          if (pin.status === "reserved" && pin.reserved_by === userId) {
            // Pin reserved by the current user
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
            // Active pin from other users
            activePins.push({
              id: pin.id,
              position: pin.position,
              parking_zone: pin.parking_zone,
              timestamp: pin.created_at,
              user: pin.user,
              address: pin.address,
            });
          }
        });

        setOtherUsersPins(activePins);
        setUserReservedPins(reservedByUser);
      } else {
        setOtherUsersPins([]);
        setUserReservedPins([]);
      }
    } catch (error) {
      console.error("Error loading other users' pins:", error);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "he,en",
          },
        }
      );
      const data = await response.json();

      if (data.address) {
        const { road, house_number, suburb, city } = data.address;
        let addressParts = [];

        if (road) {
          addressParts.push(road);
        }
        if (house_number) {
          addressParts.push(house_number);
        }
        if (suburb && suburb !== city) {
          addressParts.push(suburb);
        }
        if (city) {
          addressParts.push(city);
        }

        return addressParts.join(", ") || data.display_name;
      }

      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const savePinToDatabase = async (userId, pin, address) => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error("❌ Session error:", sessionError);
        alert("Authentication error. Please log in again.");
        return false;
      }

      const token = sessionData?.session?.access_token;

      if (!token) {
        console.error("❌ No access token found");
        alert("Authentication error. Please log in again.");
        return false;
      }

      // Calculate parking zone from position
      const [lat, lng] = pin.position;
      const parkingZoneInfo = getParkingZone(lat, lng);
      const parkingZoneNumber = parkingZoneInfo ? parkingZoneInfo.zone : null;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-pin`;
      const payload = {
        position: pin.position,
        parking_zone: parkingZoneNumber,
        address: address,
      };
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Failed to parse response as JSON:", e);
        throw new Error(`Server error (${response.status}): ${responseText}`);
      }
      if (!response.ok || !result.success) {
        console.error("❌ Save failed:", result);
        throw new Error(result.error || result.details || "Failed to save pin");
      }
      return true;
    } catch (error) {
      console.error("❌ Error saving pin:", error);
      alert(`Failed to save pin location: ${error.message}`);
      return false;
    }
  };

  const activateWaitingPin = async () => {
    if (!userOwnPin || !user) return false;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        alert("Authentication error. Please log in again.");
        return false;
      }

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/activate-pin`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin_id: userOwnPin.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to activate pin");
      }
      await loadUserOwnPin(user.id);
      await loadOtherUsersPins(user.id);

      return true;
    } catch (error) {
      console.error("Error activating pin:", error);
      alert(`Failed to activate pin: ${error.message}`);
      return false;
    }
  };

  const deactivateActivePin = async () => {
    if (!userOwnPin || !user) return false;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        alert("Authentication error. Please log in again.");
        return false;
      }

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/deactivate-pin`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin_id: userOwnPin.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to deactivate pin");
      }
      await loadUserOwnPin(user.id);
      await loadOtherUsersPins(user.id);

      return true;
    } catch (error) {
      console.error("Error deactivating pin:", error);
      alert(`Failed to deactivate pin: ${error.message}`);
      return false;
    }
  };

  useEffect(() => {
    if (user && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
          setUserLocation([32.0853, 34.7818]);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }
  }, [user]);

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error signing in:", error.message);
      alert("Failed to sign in with Google");
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUserLocation(null);
      setOtherUsersPins([]);
      setUserOwnPin(null);
      setUserReservedPins([]);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleMapClick = async (latlng) => {
    // Calculate parking zone
    const parkingZoneInfo = getParkingZone(latlng.lat, latlng.lng);
    
    const newPin = {
      id: Date.now(),
      position: [latlng.lat, latlng.lng],
      timestamp: new Date().toISOString(),
      parking_zone: parkingZoneInfo ? parkingZoneInfo.zone : null,
    };

    setPendingPin(newPin);
    setShowConfirmModal(true);
    setIsLoadingAddress(true);
    setPinAddress("");

    const address = await reverseGeocode(latlng.lat, latlng.lng);
    setPinAddress(address);
    setIsLoadingAddress(false);
  };

  const handleConfirmPin = async () => {
    if (!pendingPin || !user) return;

    const success = await savePinToDatabase(user.id, pendingPin, pinAddress);

    if (success) {
      await loadUserOwnPin(user.id);
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

  const handlePinClick = async (pin, pinType) => {
    // Add address if not already present
    if (!pin.address && pin.position) {
      const address = await reverseGeocode(pin.position[0], pin.position[1]);
      pin.address = address;
    }
    
    if (pinType === 'reserved') {
      setSelectedReservedParking(pin);
    } else {
      setSelectedParking(pin);
    }
  };

  const handleCloseParkingDetail = () => {
    setSelectedParking(null);
  };

  const handleCloseReservedParkingDetail = () => {
    setSelectedReservedParking(null);
  };

  const handleOwnPinClick = (pin) => {
    setSelectedOwnParking(pin);
  };

  const handleCloseOwnParkingDetail = () => {
    setSelectedOwnParking(null);
  };

  const handleCancelReservationClick = (pin, userType) => {
    setPinToCancel(pin);
    setCancelUserType(userType);
    setShowCancelModal(true);
  };

  const handleConfirmCancelReservation = async () => {
    if (!pinToCancel || !user) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        alert("Authentication error. Please log in again.");
        setShowCancelModal(false);
        return;
      }

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/cancel-reservation`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin_id: pinToCancel.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to cancel reservation");
      }

      alert(`✅ ${result.message}\nRefund amount: ₪${result.refund_amount}`);

      // Reload data
      await loadUserOwnPin(user.id);
      await loadOtherUsersPins(user.id);

      setShowCancelModal(false);
      setPinToCancel(null);
      setCancelUserType(null);
    } catch (error) {
      console.error("Error canceling reservation:", error);
      alert(`Failed to cancel reservation: ${error.message}`);
    }
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setPinToCancel(null);
    setCancelUserType(null);
  };

  const loadUserProfile = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) return;

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/get-user-profile`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUserDataComplete(result.profile?.user_data_complete ?? true);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <LoginScreen onGoogleSignIn={handleGoogleSignIn} />;
  }
  return (
    <StreamChatProvider user={user}>
      <div className={`app ${!userDataComplete ? "app-with-banner" : ""}`}>
        {!userDataComplete && (
          <CarDataBanner onClickBanner={handleCarDataBannerClick} />
        )}
        <button
          className="menu-toggle-button"
          onClick={() => setIsPaymentMenuOpen(true)}
          title="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <MapContainer
          userLocation={userLocation}
          otherUsersPins={otherUsersPins}
          userOwnPin={userOwnPin}
          userReservedPins={userReservedPins}
          onMapClick={handleMapClick}
          onPinClick={handlePinClick}
          onOwnPinClick={handleOwnPinClick}
          searchResult={searchResult}
        />
        <SearchBar
          onSearchResult={handleSearchResult}
          onClearSearch={handleClearSearch}
        />
        {userOwnPin && userOwnPin.status === "waiting" && (
          <LeavingParkingButton
            waitingPin={userOwnPin}
            onActivate={activateWaitingPin}
          />
        )}
        {userOwnPin && userOwnPin.status === "active" && (
          <NotLeavingParkingButton
            activePin={userOwnPin}
            onDeactivate={deactivateActivePin}
          />
        )}
        {userOwnPin && userOwnPin.status === "reserved" && (
          <ReservedParkingButton
            reservedPin={userOwnPin}
            reservedByName={reservedByName}
            onCancelReservation={(pin) =>
              handleCancelReservationClick(pin, "owner")
            }
          />
        )}
        {showConfirmModal && (
          <PinConfirmationModal
            address={pinAddress}
            parkingZone={pendingPin?.parking_zone}
            isLoading={isLoadingAddress}
            onConfirm={handleConfirmPin}
            onCancel={handleCancelPin}
          />
        )}
        <SideMenu
          isOpen={isPaymentMenuOpen}
          onClose={() => setIsPaymentMenuOpen(false)}
          user={user}
          onSignOut={handleSignOut}
        />
        {selectedParking && (
          <ParkingDetailModal
            parking={selectedParking}
            onClose={handleCloseParkingDetail}
            userReservedPins={userReservedPins}
          />
        )}
        {selectedReservedParking && (
          <ReservedParkingDetailModal
            parking={selectedReservedParking}
            onClose={handleCloseReservedParkingDetail}
          />
        )}
        {selectedOwnParking && (
          <OwnParkingDetailModal
            parking={selectedOwnParking}
            onClose={handleCloseOwnParkingDetail}
          />
        )}
        {showCancelModal && (
          <CancelReservationModal
            onConfirm={handleConfirmCancelReservation}
            onClose={handleCloseCancelModal}
            userType={cancelUserType}
          />
        )}
        {showCarDataModal && (
          <CarDataFormModal
            onClose={handleCarDataModalClose}
            onSuccess={handleCarDataSuccess}
          />
        )}
      </div>
    </StreamChatProvider>
  );
}

export default App;
