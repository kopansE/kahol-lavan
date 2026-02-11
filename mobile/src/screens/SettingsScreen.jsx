import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../config/supabase";
import { colors } from "../styles/colors";
import { useToast } from "../contexts/ToastContext";
import { updateUserCarData } from "../utils/edgeFunctions";

const SettingsScreen = ({ navigation, route }) => {
  const { user } = route.params;
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    car_license_plate: "",
    car_make: "",
    car_model: "",
    car_color: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserCarData();
    }
  }, [user]);

  const loadUserCarData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("car_license_plate, car_make, car_model, car_color")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading car data:", error);
      } else if (data) {
        setFormData({
          car_license_plate: data.car_license_plate || "",
          car_make: data.car_make || "",
          car_model: data.car_model || "",
          car_color: data.car_color || "",
        });
      }
    } catch (error) {
      console.error("Error loading car data:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateLicensePlate = (plate) => {
    if (!plate || plate.trim().length === 0) {
      return "מספר רישוי נדרש";
    }
    const plateRegex = /^\d{2,3}-?\d{2}-?\d{3}$/;
    if (!plateRegex.test(plate.trim())) {
      return "פורמט לא תקין. נדרש: XX-XXX-XX או XXX-XX-XXX";
    }
    return null;
  };

  const validateTextField = (value, fieldName, maxLength) => {
    if (!value || value.trim().length === 0) {
      return `${fieldName} נדרש`;
    }
    if (value.trim().length > maxLength) {
      return `${fieldName} חייב להיות ${maxLength} תווים או פחות`;
    }
    const textRegex = /^[a-zA-Z0-9\s\-'.א-ת]+$/;
    if (!textRegex.test(value.trim())) {
      return `${fieldName} מכיל תווים לא חוקיים`;
    }
    return null;
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
    setSaveSuccess(false);
  };

  const validateForm = () => {
    const newErrors = {};

    const plateError = validateLicensePlate(formData.car_license_plate);
    if (plateError) newErrors.car_license_plate = plateError;

    const makeError = validateTextField(formData.car_make, "יצרן", 50);
    if (makeError) newErrors.car_make = makeError;

    const modelError = validateTextField(formData.car_model, "דגם", 50);
    if (modelError) newErrors.car_model = modelError;

    const colorError = validateTextField(formData.car_color, "צבע", 30);
    if (colorError) newErrors.car_color = colorError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSaveSuccess(false);

    try {
      await updateUserCarData(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating car data:", error);
      showToast(`שמירת פרטי הרכב נכשלה: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>הגדרות</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primaryGradientStart} />
          </View>
        ) : (
          <View style={styles.form}>
            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🚗</Text>
              <Text style={styles.sectionTitle}>פרטי רכב</Text>
            </View>
            <Text style={styles.sectionDescription}>
              עזור לאחרים לזהות את הרכב שלך בזמן החלפת חניות
            </Text>

            {/* License Plate */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>מספר רישוי *</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.car_license_plate && styles.inputError,
                ]}
                value={formData.car_license_plate}
                onChangeText={(value) =>
                  handleChange("car_license_plate", value)
                }
                placeholder="לדוגמה: 12-345-67"
                editable={!isSubmitting}
                autoCapitalize="none"
              />
              {errors.car_license_plate && (
                <Text style={styles.errorText}>{errors.car_license_plate}</Text>
              )}
            </View>

            {/* Car Make */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>יצרן *</Text>
              <TextInput
                style={[styles.input, errors.car_make && styles.inputError]}
                value={formData.car_make}
                onChangeText={(value) => handleChange("car_make", value)}
                placeholder="לדוגמה: טויוטה, הונדה, מאזדה"
                editable={!isSubmitting}
              />
              {errors.car_make && (
                <Text style={styles.errorText}>{errors.car_make}</Text>
              )}
            </View>

            {/* Car Model */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>דגם *</Text>
              <TextInput
                style={[styles.input, errors.car_model && styles.inputError]}
                value={formData.car_model}
                onChangeText={(value) => handleChange("car_model", value)}
                placeholder="לדוגמה: קורולה, סיוויק, CX-5"
                editable={!isSubmitting}
              />
              {errors.car_model && (
                <Text style={styles.errorText}>{errors.car_model}</Text>
              )}
            </View>

            {/* Car Color */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>צבע *</Text>
              <TextInput
                style={[styles.input, errors.car_color && styles.inputError]}
                value={formData.car_color}
                onChangeText={(value) => handleChange("car_color", value)}
                placeholder="לדוגמה: לבן, שחור, כסוף"
                editable={!isSubmitting}
              />
              {errors.car_color && (
                <Text style={styles.errorText}>{errors.car_color}</Text>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                saveSuccess && styles.saveButtonSuccess,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {saveSuccess ? "נשמר!" : "שמור שינויים"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryGradientStart,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "300",
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: colors.white,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  form: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sectionIcon: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.darkGray,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 8,
    lineHeight: 20,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.darkGray,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.mediumGray,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: "#f9f9f9",
  },
  inputError: {
    borderColor: colors.red,
  },
  errorText: {
    fontSize: 12,
    color: colors.red,
  },
  saveButton: {
    backgroundColor: colors.primaryGradientStart,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    shadowColor: colors.primaryGradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonSuccess: {
    backgroundColor: colors.cyan,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SettingsScreen;
