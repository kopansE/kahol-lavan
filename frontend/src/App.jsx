import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import MapContainer from "./components/MapContainer";
import LoadingSpinner from "./components/LoadingSpinner";
import LoginScreen from "./components/LoginScreen";
import UserProfileBar from "./components/UserProfileBar";
import PinConfirmationModal from "./components/PinConfirmationModal";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [pins, setPins] = useState([]);
  const [pendingPin, setPendingPin] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pinAddress, setPinAddress] = useState("");
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        loadUserPinFromDatabase(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserPinFromDatabase(session.user.id);
      } else {
        setPins([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserPinFromDatabase = async (userId) => {
    try {
      console.log("🔍 Loading user's active pin...");

      // Query the pins table directly for the user's active pin
      const { data, error } = await supabase
        .from("pins")
        .select("id, position, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("❌ Error loading pin:", error);
        return;
      }

      console.log("Pin data:", data);

      if (data) {
        // Convert to the format expected by the map
        const pin = {
          id: data.id,
          position: data.position,
          timestamp: data.created_at,
        };
        console.log("✅ Loaded pin:", pin);
        setPins([pin]);
      } else {
        console.log("ℹ️ No active pins found");
        setPins([]);
      }
    } catch (error) {
      console.error("❌ Error loading user pin:", error);
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
      console.log("🔍 Starting pin save process...");
      console.log("User ID:", userId);
      console.log("Pin:", pin);
      console.log("Address:", address);

      // Get the session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      console.log("Session data:", sessionData);
      console.log("Session error:", sessionError);

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

      console.log("✅ Token found:", token.substring(0, 20) + "...");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-pin`;
      console.log("📍 Calling URL:", url);

      const payload = {
        position: pin.position,
        parking_zone: null,
        address: address,
      };
      console.log("📦 Payload:", payload);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 Response status:", response.status);
      console.log("📥 Response ok:", response.ok);

      const result = await response.json();
      console.log("📥 Response body:", result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save pin");
      }

      console.log("✅ Pin saved successfully!");
      return true;
    } catch (error) {
      console.error("❌ Error saving pin:", error);
      alert(`Failed to save pin location: ${error.message}`);
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
      setPins([]);
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
      setPins([pendingPin]);
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <LoginScreen onGoogleSignIn={handleGoogleSignIn} />;
  }

  return (
    <div className="app">
      <UserProfileBar user={user} onSignOut={handleSignOut} />
      <MapContainer
        userLocation={userLocation}
        pins={pins}
        onMapClick={handleMapClick}
      />
      {showConfirmModal && (
        <PinConfirmationModal
          address={pinAddress}
          isLoading={isLoadingAddress}
          onConfirm={handleConfirmPin}
          onCancel={handleCancelPin}
        />
      )}
    </div>
  );
}

export default App;
