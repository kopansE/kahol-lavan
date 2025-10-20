import React, { useEffect, useRef } from "react";
import {
  MapContainer as LeafletMap,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom icons
const createCustomIcon = (color = "#ff6b6b", className = "custom-pin") => {
  return L.divIcon({
    className: className,
    html: `<div style="background: ${color}; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const userLocationIcon = createCustomIcon("#4ecdc4", "user-location-pin");
const redPinIcon = createCustomIcon("#ff6b6b", "red-pin"); // User's own pin
const bluePinIcon = createCustomIcon("#4285F4", "blue-pin"); // Other users' pins

// Component to handle map clicks
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Component to handle map reference
function MapRefHandler({ onMapReady }) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  return null;
}

const MapContainer = ({
  userLocation,
  otherUsersPins,
  userOwnPin,
  onMapClick,
}) => {
  const mapRef = useRef();
  const [isGpsLoading, setIsGpsLoading] = React.useState(false);
  const [isMapReady, setIsMapReady] = React.useState(false);

  // Callback to handle when map is ready
  const handleMapReady = React.useCallback((map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  // Center map on user location when it's available, but only initially
  useEffect(() => {
    if (userLocation && mapRef.current && !mapRef.current._initialCentered) {
      mapRef.current.setView(userLocation, 16);
      mapRef.current._initialCentered = true;
    }
  }, [userLocation]);

  const handleGpsClick = () => {
    if (!isMapReady || !mapRef.current) {
      setIsGpsLoading(false);
      return;
    }

    setIsGpsLoading(true);
    proceedWithGps(mapRef.current);
  };

  const proceedWithGps = (map) => {
    const focusOn = (latlng) => {
      // Smoothly fly and zoom into street-level with user centered
      map.flyTo(latlng, 18, {
        animate: true,
        duration: 0.8,
      });
      setIsGpsLoading(false);
    };

    // Always try to get fresh GPS location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          focusOn([latitude, longitude]);
        },
        (error) => {
          // Fallback to existing user location if available
          if (userLocation && userLocation.length === 2) {
            focusOn(userLocation);
          } else {
            setIsGpsLoading(false);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
      );
    } else {
      // Fallback to existing user location if available
      if (userLocation && userLocation.length === 2) {
        focusOn(userLocation);
      } else {
        setIsGpsLoading(false);
      }
    }
  };

  if (!userLocation) {
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
        Loading map...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw" }}>
      <LeafletMap
        center={userLocation}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location marker */}
        <Marker position={userLocation} icon={userLocationIcon}>
          <Popup>
            <div>
              <strong>Your Location</strong>
              <br />
              Lat: {userLocation[0].toFixed(6)}
              <br />
              Lng: {userLocation[1].toFixed(6)}
            </div>
          </Popup>
        </Marker>

        {/* User's own pin (RED) */}
        {userOwnPin && (
          <Marker
            key={`own-${userOwnPin.id}`}
            position={userOwnPin.position}
            icon={redPinIcon}
          >
            <Popup>
              <div>
                <strong>Your Parking Spot</strong>
                <br />
                Status: {userOwnPin.status}
                <br />
                Lat: {userOwnPin.position[0].toFixed(6)}
                <br />
                Lng: {userOwnPin.position[1].toFixed(6)}
                <br />
                <small>
                  Added: {new Date(userOwnPin.timestamp).toLocaleString()}
                </small>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Other users' pins (BLUE) */}
        {otherUsersPins &&
          otherUsersPins.length > 0 &&
          otherUsersPins.map((pin) => (
            <Marker
              key={`other-${pin.id}`}
              position={pin.position}
              icon={bluePinIcon}
            >
              <Popup>
                <div>
                  <strong>Available Parking</strong>
                  <br />
                  Lat: {pin.position[0].toFixed(6)}
                  <br />
                  Lng: {pin.position[1].toFixed(6)}
                  <br />
                  <small>
                    Added: {new Date(pin.timestamp).toLocaleString()}
                  </small>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Handle map reference and clicks */}
        <MapRefHandler onMapReady={handleMapReady} />
        <MapClickHandler onMapClick={onMapClick} />
      </LeafletMap>

      {/* GPS button overlay */}
      <div
        className={`gps-button ${isGpsLoading ? "loading" : ""}`}
        onClick={handleGpsClick}
        role="button"
        title={isGpsLoading ? "Getting location..." : "Focus on my location"}
      >
        {/* GPS/locate icon or loading spinner */}
        {isGpsLoading ? (
          <div className="loading-spinner"></div>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-6a1 1 0 0 1 1 1v2.06a7.94 7.94 0 0 1 6.94 6.94H22a1 1 0 1 1 0 2h-2.06A7.94 7.94 0 0 1 13 18.94V21a1 1 0 1 1-2 0v-2.06A7.94 7.94 0 0 1 3.06 13H1a1 1 0 1 1 0-2h2.06A7.94 7.94 0 0 1 11 5.06V3a1 1 0 0 1 1-1Z"
            />
          </svg>
        )}
      </div>
    </div>
  );
};

export default MapContainer;
