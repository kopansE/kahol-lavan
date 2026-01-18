import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { commonStyles } from '../styles/common';
import { colors } from '../styles/colors';
import { updateUserCarData } from '../utils/edgeFunctions';

const CarDataFormModal = ({ visible, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    car_license_plate: '',
    car_make: '',
    car_model: '',
    car_color: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateLicensePlate = (plate) => {
    if (!plate || plate.trim().length === 0) {
      return 'License plate is required';
    }
    const plateRegex = /^\d{2,3}-?\d{2}-?\d{3}$/;
    if (!plateRegex.test(plate.trim())) {
      return 'Invalid format. Expected: XX-XXX-XX or XXX-XX-XXX';
    }
    return null;
  };

  const validateTextField = (value, fieldName, maxLength) => {
    if (!value || value.trim().length === 0) {
      return `${fieldName} is required`;
    }
    if (value.trim().length > maxLength) {
      return `${fieldName} must be ${maxLength} characters or less`;
    }
    const textRegex = /^[a-zA-Z0-9\s\-'.]+$/;
    if (!textRegex.test(value.trim())) {
      return `${fieldName} contains invalid characters`;
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

    const makeError = validateTextField(formData.car_make, 'Car make', 50);
    if (makeError) newErrors.car_make = makeError;

    const modelError = validateTextField(formData.car_model, 'Car model', 50);
    if (modelError) newErrors.car_model = modelError;

    const colorError = validateTextField(formData.car_color, 'Car color', 30);
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
      Alert.alert('Success', 'Car data saved successfully!');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Error updating car data:', error);
      Alert.alert('Error', `Failed to save car data: ${error.message}`);
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={commonStyles.modalOverlay}>
          <View style={[commonStyles.modalContent, styles.modalContent]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={commonStyles.modalIcon}>🚗</Text>
              <Text style={commonStyles.modalTitle}>Enter Your Car Details</Text>
              <Text style={commonStyles.modalMessage}>
                Help others identify your vehicle during parking exchanges
              </Text>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>License Plate *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_license_plate && commonStyles.inputError,
                  ]}
                  value={formData.car_license_plate}
                  onChangeText={(value) => handleChange('car_license_plate', value)}
                  placeholder="e.g., 12-345-67"
                  editable={!isSubmitting}
                  autoCapitalize="none"
                />
                {errors.car_license_plate && (
                  <Text style={commonStyles.errorText}>{errors.car_license_plate}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>Car Make *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_make && commonStyles.inputError,
                  ]}
                  value={formData.car_make}
                  onChangeText={(value) => handleChange('car_make', value)}
                  placeholder="e.g., Toyota, Honda, Mazda"
                  editable={!isSubmitting}
                />
                {errors.car_make && (
                  <Text style={commonStyles.errorText}>{errors.car_make}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>Car Model *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_model && commonStyles.inputError,
                  ]}
                  value={formData.car_model}
                  onChangeText={(value) => handleChange('car_model', value)}
                  placeholder="e.g., Corolla, Civic, CX-5"
                  editable={!isSubmitting}
                />
                {errors.car_model && (
                  <Text style={commonStyles.errorText}>{errors.car_model}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={commonStyles.inputLabel}>Car Color *</Text>
                <TextInput
                  style={[
                    commonStyles.input,
                    errors.car_color && commonStyles.inputError,
                  ]}
                  value={formData.car_color}
                  onChangeText={(value) => handleChange('car_color', value)}
                  placeholder="e.g., White, Black, Silver"
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
                    <Text style={styles.submitButtonText}>Save Car Data</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
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
    maxHeight: '90%',
  },
  formGroup: {
    width: '100%',
    marginBottom: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: colors.primaryGradientStart,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
  },
  cancelButtonText: {
    color: colors.gray,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CarDataFormModal;
