import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const ChatTimer = ({ startedAt, expiresAt, initialMinutes = 20, onExpire }) => {
  const hasExpiredRef = useRef(false);
  const calculateTimeRemaining = () => {
    // If expiresAt is provided, use it directly (for extensions)
    if (expiresAt) {
      const now = new Date();
      const expires = new Date(expiresAt);
      const remaining = Math.floor((expires - now) / 1000);
      return Math.max(0, remaining);
    }

    // Fallback to startedAt + initialMinutes calculation
    if (!startedAt) {
      return initialMinutes * 60;
    }

    const now = new Date();
    const started = new Date(startedAt);
    const elapsedSeconds = Math.floor((now - started) / 1000);
    const totalSeconds = initialMinutes * 60;
    const remaining = totalSeconds - elapsedSeconds;

    return Math.max(0, remaining);
  };

  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining());

  useEffect(() => {
    // Recalculate when startedAt or expiresAt changes
    setTimeRemaining(calculateTimeRemaining());
  }, [startedAt, expiresAt]);

  useEffect(() => {
    if (timeRemaining <= 0) {
      if (onExpire && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpire();
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, onExpire]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Text style={styles.label}>נותר</Text>
      <Text style={styles.timeDisplay}>{formatTime(timeRemaining)}</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeDisplay: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    letterSpacing: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    letterSpacing: 2,
    opacity: 0.95,
  },
});

export default ChatTimer;
