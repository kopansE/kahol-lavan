import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import MapContainer from "./components/MapContainer";
import LoadingSpinner from "./components/LoadingSpinner";
import LoginScreen from "./components/LoginScreen";
import PinConfirmationModal from "./components/PinConfirmationModal";
import LeavingParkingButton from "./components/LeavingParkingButton";
import NotLeavingParkingButton from "./components/NotLeavingParkingButton";
import PaymentSideMenu from "./components/PaymentSideMenu";
import ParkingDetailModal from "./components/ParkingDetailModal";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        loadUserOwnPin(session.user.id);
        loadOtherUsersPins(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserOwnPin(session.user.id);
        loadOtherUsersPins(session.user.id);
      } else {
        setOtherUsersPins([]);
        setUserOwnPin(null);
        setUserReservedPins([]);
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
        console.log("🔄 Payment setup completed, fetching payment method...");

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
            console.log("✅ Payment method saved:", result.payment_method);
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
        console.log("⚠️ Payment setup cancelled");
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
        .select("id, position, status, created_at, reserved_by")
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
          status: data.status,
          timestamp: data.created_at,
          reserved_by: data.reserved_by,
        };
        setUserOwnPin(pin);
      } else {
        setUserOwnPin(null);
      }
    } catch (error) {
      console.error("Error loading user own pin:", error);
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
              timestamp: pin.created_at,
              status: pin.status,
              reserved_by: pin.reserved_by,
            });
          } else if (pin.status === "active") {
            // Active pin from other users
            activePins.push({
              id: pin.id,
              position: pin.position,
              timestamp: pin.created_at,
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

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-pin`;
      const payload = {
        position: pin.position,
        parking_zone: null,
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
    const newPin = {
      id: Date.now(),
      position: [latlng.lat, latlng.lng],
      timestamp: new Date().toISOString(),
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

  const handlePinClick = async (pin) => {
    // Add address if not already present
    if (!pin.address && pin.position) {
      const address = await reverseGeocode(pin.position[0], pin.position[1]);
      pin.address = address;
    }
    setSelectedParking(pin);
  };

  const handleCloseParkingDetail = () => {
    setSelectedParking(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <LoginScreen onGoogleSignIn={handleGoogleSignIn} />;
  }
  return (
    <div className="app">
      <button
        className="payment-menu-toggle-button"
        onClick={() => setIsPaymentMenuOpen(true)}
        title="Payment Settings"
      >
        💳
      </button>
      <MapContainer
        userLocation={userLocation}
        otherUsersPins={otherUsersPins}
        userOwnPin={userOwnPin}
        userReservedPins={userReservedPins}
        onMapClick={handleMapClick}
        onPinClick={handlePinClick}
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
      {showConfirmModal && (
        <PinConfirmationModal
          address={pinAddress}
          isLoading={isLoadingAddress}
          onConfirm={handleConfirmPin}
          onCancel={handleCancelPin}
        />
      )}
      <PaymentSideMenu
        isOpen={isPaymentMenuOpen}
        onClose={() => setIsPaymentMenuOpen(false)}
        user={user}
        onSignOut={handleSignOut}
      />
      {selectedParking && (
        <ParkingDetailModal
          parking={selectedParking}
          onClose={handleCloseParkingDetail}
        />
      )}
    </div>
  );
}

export default App;
