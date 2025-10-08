import React, { useState, useEffect } from "react";
import MapContainer from "./components/MapContainer";

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [pins, setPins] = useState([]);
  // Removed UI panels; keep only essential state

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Fallback to a default location (Tel Aviv, Israel)
          setUserLocation([32.0853, 34.7818]);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    } else {
      // Fallback to a default location
      setUserLocation([32.0853, 34.7818]);
    }
  }, []);

  const handleMapClick = (latlng) => {
    const newPin = {
      id: Date.now(),
      position: [latlng.lat, latlng.lng],
      timestamp: new Date().toISOString(),
    };
    // Limit to a single pin: replace any existing pin with the new one
    setPins([newPin]);
  };

  return (
    <div className="App">
      <MapContainer
        userLocation={userLocation}
        pins={pins}
        onMapClick={handleMapClick}
      />
    </div>
  );
}

export default App;
