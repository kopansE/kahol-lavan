import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const ChatTimer = ({ startedAt, expiresAt, initialMinutes = 20, onExpire }) => {
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
      if (onExpire) onExpire();
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
      <Text style={styles.timeDisplay}>{formatTime(timeRemaining)}</Text>
      <Text style={styles.label}>נותר</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  timeDisplay: {
    fontSize: 48,
    fontWeight: "700",
    color: "white",
    letterSpacing: 2,
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    letterSpacing: 3,
    opacity: 0.95,
  },
});

export default ChatTimer;
