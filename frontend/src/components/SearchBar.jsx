import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../contexts/ToastContext";
import "./SearchBar.css";

// Generate a unique session token for billing optimization
const generateSessionToken = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const SearchBar = ({ onSearchResult, onClearSearch }) => {
  const { showToast } = useToast();
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
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          console.error("No auth token");
          return;
        }

        const url = `${
          import.meta.env.VITE_SUPABASE_URL
        }/functions/v1/places-autocomplete?input=${encodeURIComponent(
          searchQuery,
        )}&sessionToken=${sessionToken}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setPredictions(result.predictions || []);
        } else {
          console.error("Autocomplete error:", result.error);
          setPredictions([]);
        }
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
  const handleInputChange = (e) => {
    const value = e.target.value;
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
  const handlePredictionClick = async (prediction) => {
    setQuery(prediction.description);
    setShowPredictions(false);
    setPredictions([]);

    try {
      setIsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.error("No auth token");
        return;
      }

      // First, geocode the place
      const geocodeUrl = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/geocode-address?placeId=${encodeURIComponent(
        prediction.placeId,
      )}&sessionToken=${sessionToken}`;

      const geocodeResponse = await fetch(geocodeUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const geocodeResult = await geocodeResponse.json();

      if (!geocodeResponse.ok || !geocodeResult.success) {
        console.error("Geocoding error:", geocodeResult.error);
        showToast("לא ניתן למצוא מיקום עבור כתובת זו");
        return;
      }

      const { result } = geocodeResult;

      // If it's a street, fetch the geometry for highlighting
      let streetGeometry = null;
      if (result.isStreet && result.viewport) {
        try {
          const geometryUrl = `${
            import.meta.env.VITE_SUPABASE_URL
          }/functions/v1/get-street-geometry?streetName=${encodeURIComponent(
            prediction.mainText || prediction.description,
          )}&lat=${result.lat}&lng=${result.lng}&viewport=${encodeURIComponent(
            JSON.stringify(result.viewport),
          )}`;

          const geometryResponse = await fetch(geometryUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          const geometryResult = await geometryResponse.json();

          if (geometryResponse.ok && geometryResult.success) {
            streetGeometry = geometryResult.geometry;
          }
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
      showToast("שגיאה בעיבוד החיפוש. אנא נסה שוב.");
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

  // Close predictions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current &&
        !inputRef.current.closest(".search-bar-container")?.contains(e.target)
      ) {
        setShowPredictions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="search-bar-container">
      <div className="search-bar">
        <div className="search-icon">
          {isLoading ? (
            <div className="search-spinner"></div>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="לאן?"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setShowPredictions(true)}
        />
        {query && (
          <button className="clear-button" onClick={handleClear} type="button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {showPredictions && predictions.length > 0 && (
        <div className="predictions-list">
          {predictions.map((prediction) => (
            <div
              key={prediction.placeId}
              className="prediction-item"
              onClick={() => handlePredictionClick(prediction)}
            >
              <div className="prediction-icon">
                {prediction.types?.includes("route") ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12h18M3 6h18M3 18h18"></path>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                )}
              </div>
              <div className="prediction-text">
                <span className="prediction-main">{prediction.mainText}</span>
                <span className="prediction-secondary">
                  {prediction.secondaryText}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
