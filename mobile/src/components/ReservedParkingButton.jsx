import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../styles/colors";

const ReservedParkingButton = ({ reservedPin, reservedByName }) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.orange, colors.orangeDark]}
        style={styles.gradient}
      >
        <Text style={styles.icon}>🔒</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>חניה הוזמנה</Text>
          <Text style={styles.subtitle}>
            {reservedByName ? `הוזמנה ע״י ${reservedByName}` : "הוזמנה"}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 20,
    right: 20,
    borderRadius: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 14,
    minWidth: 220,
  },
  icon: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
  },
});

export default ReservedParkingButton;
