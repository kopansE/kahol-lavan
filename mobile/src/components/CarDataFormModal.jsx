import React, { useState } from "react";
import {
  Modal,
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
import { commonStyles } from "../styles/common";
import { colors } from "../styles/colors";
import { useToast } from "../contexts/ToastContext";
import { updateUserCarData } from "../utils/edgeFunctions";

const CarDataFormModal = ({ visible, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    car_license_plate: "",
    car_make: "",
    car_model: "",
    car_color: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    try {
      await updateUserCarData(formData);
      showToast("פרטי הרכב נשמרו בהצלחה!");
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error("Error updating car data:", error);
      showToast(`שמירת פרטי הרכב נכשלה: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <View style={commonStyles.modalOverlay}>
          <View style={[commonStyles.modalContent, styles.modalContent]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={commonStyles.modalIcon}>🚗</Text>
              <Text style={commonStyles.modalTitle}>הזן את פרטי הרכב שלך</Text>
              <Text style={commonStyles.modalMessage}>
                עזור לאחרים לזהות את הרכב שלך בזמן החלפת חניות
              </Text>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>מספר רישוי *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_license_plate && commonStyles.inputError,
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
                  <Text style={commonStyles.errorText}>
                    {errors.car_license_plate}
                  </Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>יצרן *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_make && commonStyles.inputError,
                  ]}
                  value={formData.car_make}
                  onChangeText={(value) => handleChange("car_make", value)}
                  placeholder="לדוגמה: טויוטה, הונדה, מאזדה"
                  editable={!isSubmitting}
                />
                {errors.car_make && (
                  <Text style={commonStyles.errorText}>{errors.car_make}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>דגם *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_model && commonStyles.inputError,
                  ]}
                  value={formData.car_model}
                  onChangeText={(value) => handleChange("car_model", value)}
                  placeholder="לדוגמה: קורולה, סיוויק, CX-5"
                  editable={!isSubmitting}
                />
                {errors.car_model && (
                  <Text style={commonStyles.errorText}>{errors.car_model}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>צבע *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_color && commonStyles.inputError,
                  ]}
                  value={formData.car_color}
                  onChangeText={(value) => handleChange("car_color", value)}
                  placeholder="לדוגמה: לבן, שחור, כסוף"
                  editable={!isSubmitting}
                />
                {errors.car_color && (
                  <Text style={commonStyles.errorText}>{errors.car_color}</Text>
                )}
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.submitButton]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.submitButtonText}>שמור פרטי רכב</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>ביטול</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  modalContent: {
    maxHeight: "90%",
  },
  formGroup: {
    width: "100%",
    marginBottom: 16,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: colors.primaryGradientStart,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
  },
  cancelButtonText: {
    color: colors.gray,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CarDataFormModal;
