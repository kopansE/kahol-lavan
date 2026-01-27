import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { commonStyles } from '../styles/common';
import { colors } from '../styles/colors';
import { formatParkingZone } from '../utils/parkingZoneUtils';

const PinConfirmationModal = ({ visible, address, parkingZone, isLoading, onConfirm, onCancel }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={commonStyles.modalOverlay}>
        <View style={commonStyles.modalContent}>
          <Text style={commonStyles.modalIcon}>📍</Text>
          <Text style={commonStyles.modalTitle}>Pin Location</Text>
          <Text style={commonStyles.modalMessage}>You dropped a pin at:</Text>

          <View style={styles.addressContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primaryGradientStart} />
                <Text style={styles.loadingText}>Finding address...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.address}>{address}</Text>
                <Text style={styles.parkingZone}>
                  🅿️ {formatParkingZone(parkingZone)}
                </Text>
              </>
            )}
          </View>

          <Text style={[commonStyles.modalMessage, styles.question]}>
            Did you park here? 🙂
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              <Text style={styles.confirmButtonText}>Yes, I did!</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  addressContainer: {
    width: '100%',
    minHeight: 50,
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.gray,
    fontSize: 14,
  },
  address: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGray,
    textAlign: 'center',
  },
  parkingZone: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  question: {
    marginTop: 8,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: colors.primaryGradientStart,
  },
  confirmButtonText: {
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

export default PinConfirmationModal;
