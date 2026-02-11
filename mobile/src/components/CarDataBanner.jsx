import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { colors } from "../styles/colors";

const CarDataBanner = ({ onClickBanner }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onClickBanner}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>🚗</Text>
        <Text style={styles.text}>אנא הזן את פרטי הרכב שלך 😀</Text>
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFE066",
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  icon: {
    fontSize: 20,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.darkGray,
    flex: 1,
  },
  arrow: {
    fontSize: 20,
    color: colors.darkGray,
  },
});

export default CarDataBanner;
