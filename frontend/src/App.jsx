import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import MapContainer from "./components/MapContainer";
import LoadingSpinner from "./components/LoadingSpinner";
import LoginScreen from "./components/LoginScreen";
import UserProfileBar from "./components/UserProfileBar";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [pins, setPins] = useState([]);

  // Check if user is already logged in
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Load user's pin from database if logged in
      if (session?.user) {
        loadUserPinFromDatabase(session.user.id);
      }
    });

    // Listen for auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      // Load pin when user logs in
      if (session?.user) {
        loadUserPinFromDatabase(session.user.id);
      } else {
        setPins([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Function to load user's saved pin from database
  const loadUserPinFromDatabase = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("last_pin_location")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error loading pin:", error);
        return;
      }

      // If user has a saved pin location, load it
      if (data?.last_pin_location) {
        setPins([data.last_pin_location]);
      }
    } catch (error) {
      console.error("Error loading user pin:", error);
    }
  };

  // Function to save pin to database
  const savePinToDatabase = async (userId, pin) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({
          last_pin_location: pin,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        console.error("Error saving pin:", error);
        alert("Failed to save pin location");
      }
    } catch (error) {
      console.error("Error saving pin:", error);
    }
  };

  // Get user's location after login
  useEffect(() => {
    if (user && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to Tel Aviv center if geolocation fails
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

  const handleMapClick = (latlng) => {
    const newPin = {
      id: Date.now(),
      position: [latlng.lat, latlng.lng],
      timestamp: new Date().toISOString(),
    };

    // Update local state
    setPins([newPin]);

    // Save to database
    if (user) {
      savePinToDatabase(user.id, newPin);
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSpinner />;
  }

  // Not logged in - show login screen
  if (!user) {
    return <LoginScreen onGoogleSignIn={handleGoogleSignIn} />;
  }

  // Logged in - show map with user info
  return (
    <div className="app">
      <UserProfileBar user={user} onSignOut={handleSignOut} />
      <MapContainer
        userLocation={userLocation}
        pins={pins}
        onMapClick={handleMapClick}
      />
    </div>
  );
}

export default App;
