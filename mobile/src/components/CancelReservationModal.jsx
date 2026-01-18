import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { commonStyles } from '../styles/common';
import { colors } from '../styles/colors';

const CancelReservationModal = ({ visible, onConfirm, onClose, userType }) => {
  const getMessage = () => {
    if (userType === 'owner') {
      return 'Are you sure you want to cancel this reservation? The reservation fee will be refunded to the reserver.';
    }
    return 'Are you sure you want to cancel this reservation? You will receive a refund of the reservation fee.';
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={commonStyles.modalOverlay}>
        <View style={commonStyles.modalContent}>
          <Text style={commonStyles.modalIcon}>⚠️</Text>
          <Text style={commonStyles.modalTitle}>Cancel Reservation</Text>
          <Text style={[commonStyles.modalMessage, styles.message]}>
            {getMessage()}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>Yes, Cancel Reservation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Keep Reservation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  message: {
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
    backgroundColor: colors.red,
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

export default CancelReservationModal;
