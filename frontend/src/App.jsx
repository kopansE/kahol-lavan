import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import MapContainer from "./components/MapContainer";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [pins, setPins] = useState([]);

  // Check if user is already logged in (automatically persists)
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Load user's pins if logged in
      if (session?.user) {
        const savedPins = localStorage.getItem(`pins_${session.user.id}`);
        if (savedPins) {
          setPins(JSON.parse(savedPins));
        }
      }
    });

    // Listen for auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      // Load pins when user logs in
      if (session?.user) {
        const savedPins = localStorage.getItem(`pins_${session.user.id}`);
        if (savedPins) {
          setPins(JSON.parse(savedPins));
        }
      } else {
        setPins([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Save pins whenever they change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`pins_${user.id}`, JSON.stringify(pins));
    }
  }, [pins, user]);

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
    setPins([newPin]);
  };

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontSize: "18px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            className="loading-spinner"
            style={{
              margin: "0 auto 20px",
              width: "40px",
              height: "40px",
              border: "4px solid rgba(255,255,255,0.3)",
              borderTop: "4px solid white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          Loading...
        </div>
      </div>
    );
  }

  // Not logged in - show login screen
  if (!user) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "20px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "400px",
          }}
        >
          <h1
            style={{
              marginBottom: "16px",
              fontSize: "36px",
              fontWeight: "700",
            }}
          >
            📍 Map Pins
          </h1>
          <p
            style={{
              marginBottom: "40px",
              fontSize: "16px",
              opacity: 0.9,
              lineHeight: "1.5",
            }}
          >
            Pin your favorite locations on the map and access them anytime,
            anywhere
          </p>
          <button
            onClick={handleGoogleSignIn}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "white",
              color: "#333",
              border: "none",
              padding: "14px 28px",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              transition: "all 0.2s ease",
              margin: "0 auto",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.25)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
          <p
            style={{
              marginTop: "24px",
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>
    );
  }

  // Logged in - show map with user info
  return (
    <div className="App">
      {/* User profile bar */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 1000,
          background: "white",
          padding: "10px 16px",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {user.user_metadata?.avatar_url && (
          <img
            src={user.user_metadata.avatar_url}
            alt={user.user_metadata.full_name || user.email}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "2px solid #f0f0f0",
            }}
          />
        )}
        <div style={{ fontSize: "14px", flex: 1 }}>
          <div style={{ fontWeight: "600", color: "#333" }}>
            {user.user_metadata?.full_name || "User"}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>{user.email}</div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            background: "#f5f5f5",
            border: "none",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            color: "#666",
            transition: "background 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#e8e8e8")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#f5f5f5")}
        >
          Sign Out
        </button>
      </div>

      <MapContainer
        userLocation={userLocation}
        pins={pins}
        onMapClick={handleMapClick}
      />
    </div>
  );
}

export default App;
