import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../styles/colors";
import * as Location from "expo-location";

const MapContainer = ({
  userLocation,
  otherUsersPins,
  userOwnPin,
  userReservedPins,
  publishedPins,
  onMapPress,
  onPinClick,
  onOwnPinClick,
  onPublishedPinClick,
  searchResult,
}) => {
  const mapRef = useRef(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Handle search result navigation
  useEffect(() => {
    if (searchResult && mapRef.current) {
      if (searchResult.isStreet && searchResult.viewport) {
        // For streets, fit to viewport bounds
        const { northeast, southwest } = searchResult.viewport;
        mapRef.current.fitToCoordinates(
          [
            { latitude: northeast.lat, longitude: northeast.lng },
            { latitude: southwest.lat, longitude: southwest.lng },
          ],
          {
            edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
            animated: true,
          },
        );
      } else {
        // For specific addresses, zoom in close
        mapRef.current.animateToRegion(
          {
            latitude: searchResult.lat,
            longitude: searchResult.lng,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          800,
        );
      }
    }
  }, [searchResult]);

  const handleGpsClick = useCallback(async () => {
    try {
      setIsGpsLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("שגיאה", "הגישה למיקום נדחתה");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (mapRef.current && location) {
        mapRef.current.animateToRegion(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          800,
        );
      }
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setIsGpsLoading(false);
    }
  }, []);

  const handleMapPress = (e) => {
    if (onMapPress && e.nativeEvent.coordinate) {
      onMapPress(e.nativeEvent.coordinate);
    }
  };

  if (!userLocation) {
    return (
      <LinearGradient
        colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
        style={styles.loadingContainer}
      >
        <Text style={styles.loadingText}>טוען מפה...</Text>
      </LinearGradient>
    );
  }

  const initialRegion = {
    latitude: userLocation[0],
    longitude: userLocation[1],
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* User location marker (cyan) */}
        <Marker
          coordinate={{
            latitude: userLocation[0],
            longitude: userLocation[1],
          }}
          pinColor={colors.cyan}
          title="המיקום שלך"
        />

        {/* User's own pin (red) */}
        {userOwnPin && (
          <Marker
            coordinate={{
              latitude: userOwnPin.position[0],
              longitude: userOwnPin.position[1],
            }}
            pinColor={colors.red}
            onPress={() => {
              if (onOwnPinClick) {
                onOwnPinClick(userOwnPin);
              }
            }}
          />
        )}

        {/* Other users' pins (blue) */}
        {otherUsersPins &&
          otherUsersPins.map((pin) => (
            <Marker
              key={`other-${pin.id}`}
              coordinate={{
                latitude: pin.position[0],
                longitude: pin.position[1],
              }}
              pinColor={colors.blue}
              onPress={() => {
                if (onPinClick) {
                  onPinClick(pin);
                }
              }}
            />
          ))}

        {/* User's reserved pins (orange) */}
        {userReservedPins &&
          userReservedPins.map((pin) => (
            <Marker
              key={`reserved-${pin.id}`}
              coordinate={{
                latitude: pin.position[0],
                longitude: pin.position[1],
              }}
              pinColor={colors.orange}
              title="החניה שהזמנת"
              description="לחץ לצפייה בפרטים"
              onPress={() => {
                if (onPinClick) {
                  onPinClick(pin, "reserved");
                }
              }}
            />
          ))}

        {/* Published pins (green) - scheduled leaves visible to other users */}
        {publishedPins &&
          publishedPins.map((pin) => (
            <Marker
              key={`published-${pin.id}`}
              coordinate={{
                latitude: pin.position[0],
                longitude: pin.position[1],
              }}
              pinColor="#34A853"
              title="חניה עתידית"
              description="לחץ לתזמון"
              onPress={() => {
                if (onPublishedPinClick) {
                  onPublishedPinClick(pin);
                }
              }}
            />
          ))}

        {/* Search result marker (red pin) */}
        {searchResult && (
          <Marker
            coordinate={{
              latitude: searchResult.lat,
              longitude: searchResult.lng,
            }}
            pinColor="#EA4335"
            title={searchResult.name || "תוצאת חיפוש"}
            description={searchResult.formattedAddress}
          />
        )}

        {/* Street highlight polylines (multiple segments) */}
        {searchResult?.isStreet &&
          searchResult?.streetGeometry?.segments &&
          searchResult.streetGeometry.segments.map((segment, index) => (
            <Polyline
              key={`street-segment-${index}`}
              coordinates={segment.map(([lat, lng]) => ({
                latitude: lat,
                longitude: lng,
              }))}
              strokeColor="#4285F4"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          ))}
      </MapView>

      {/* GPS button overlay */}
      <TouchableOpacity
        style={styles.gpsButton}
        onPress={handleGpsClick}
        disabled={isGpsLoading}
      >
        {isGpsLoading ? (
          <ActivityIndicator color={colors.darkGray} size="small" />
        ) : (
          <Text style={styles.gpsIcon}>📍</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.white,
    fontSize: 18,
  },
  gpsButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gpsIcon: {
    fontSize: 22,
  },
});

export default MapContainer;
