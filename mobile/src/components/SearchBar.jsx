import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
} from "react-native";
import { colors } from "../styles/colors";
import {
  placesAutocomplete,
  geocodeAddress,
  getStreetGeometry,
} from "../utils/edgeFunctions";

// Generate a unique session token for billing optimization
const generateSessionToken = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const SearchBar = ({ onSearchResult, onClearSearch }) => {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [sessionToken, setSessionToken] = useState(generateSessionToken);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced search function
  const fetchPredictions = useCallback(
    async (searchQuery) => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setPredictions([]);
        return;
      }

      try {
        setIsLoading(true);
        const result = await placesAutocomplete(searchQuery, sessionToken);
        setPredictions(result.predictions || []);
      } catch (error) {
        console.error("Error fetching predictions:", error);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionToken],
  );

  // Handle input change with debounce
  const handleInputChange = (value) => {
    setQuery(value);
    setShowPredictions(true);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the API call
    debounceRef.current = setTimeout(() => {
      fetchPredictions(value);
    }, 300);
  };

  // Handle prediction selection
  const handlePredictionPress = async (prediction) => {
    Keyboard.dismiss();
    setQuery(prediction.description);
    setShowPredictions(false);
    setPredictions([]);

    try {
      setIsLoading(true);

      // Geocode the place
      const geocodeResult = await geocodeAddress(
        prediction.placeId,
        sessionToken,
      );
      const { result } = geocodeResult;

      // If it's a street, fetch the geometry for highlighting
      let streetGeometry = null;
      if (result.isStreet && result.viewport) {
        try {
          const geometryResult = await getStreetGeometry(
            prediction.mainText || prediction.description,
            result.lat,
            result.lng,
            result.viewport,
          );
          streetGeometry = geometryResult.geometry;
        } catch (error) {
          console.error("Error fetching street geometry:", error);
        }
      }

      // Call the parent callback with the search result
      onSearchResult({
        lat: result.lat,
        lng: result.lng,
        formattedAddress: result.formattedAddress,
        name: result.name,
        isStreet: result.isStreet,
        viewport: result.viewport,
        streetGeometry: streetGeometry,
      });

      // Generate a new session token for the next search
      setSessionToken(generateSessionToken());
    } catch (error) {
      console.error("Error processing selection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clear button
  const handleClear = () => {
    setQuery("");
    setPredictions([]);
    setShowPredictions(false);
    setSessionToken(generateSessionToken());
    if (onClearSearch) {
      onClearSearch();
    }
    inputRef.current?.focus();
  };

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const renderPrediction = ({ item }) => (
    <TouchableOpacity
      style={styles.predictionItem}
      onPress={() => handlePredictionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.predictionIcon}>
        <Text style={styles.predictionIconText}>
          {item.types?.includes("route") ? "🛣️" : "📍"}
        </Text>
      </View>
      <View style={styles.predictionText}>
        <Text style={styles.predictionMain} numberOfLines={1}>
          {item.mainText}
        </Text>
        <Text style={styles.predictionSecondary} numberOfLines={1}>
          {item.secondaryText}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Predictions list (above search bar) */}
      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <FlatList
            data={predictions}
            renderItem={renderPrediction}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Search bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchIcon}>
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primaryGradientStart}
            />
          ) : (
            <Text style={styles.searchIconText}>🔍</Text>
          )}
        </View>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="לאן?"
          placeholderTextColor="#999"
          value={query}
          onChangeText={handleInputChange}
          onFocus={() => query.length >= 2 && setShowPredictions(true)}
          returnKeyType="search"
        />

        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  searchIcon: {
    marginRight: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  searchIconText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.darkGray,
    paddingVertical: 0,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: "600",
  },
  predictionsContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 8,
    maxHeight: 250,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  predictionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  predictionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f2ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  predictionIconText: {
    fontSize: 16,
  },
  predictionText: {
    flex: 1,
  },
  predictionMain: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.darkGray,
    marginBottom: 2,
  },
  predictionSecondary: {
    fontSize: 13,
    color: colors.gray,
  },
});

export default SearchBar;
