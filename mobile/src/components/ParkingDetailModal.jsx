import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { commonStyles } from '../styles/common';
import { colors } from '../styles/colors';
import { reserveParking } from '../utils/edgeFunctions';

const ParkingDetailModal = ({ visible, parking, onClose, userReservedPins }) => {
  const [isReserving, setIsReserving] = useState(false);
  const hasExistingReservation = userReservedPins && userReservedPins.length > 0;

  const handleReserveClick = async () => {
    if (isReserving) return;

    if (hasExistingReservation) {
      Alert.alert(
        'Already Reserved',
        'You already have an active reservation. Please cancel it before reserving another spot.'
      );
      return;
    }

    try {
      setIsReserving(true);

      const result = await reserveParking(parking.id);

      Alert.alert(
        'Success',
        `${result.message}\nAmount paid: ₪${result.amount_paid}`
      );
      onClose();
    } catch (error) {
      console.error('Error reserving parking:', error);
      Alert.alert('Error', `Failed to reserve parking: ${error.message}`);
    } finally {
      setIsReserving(false);
    }
  };

  if (!parking) return null;

  const userData = parking.user || parking.users || parking;
  const ownerName = userData?.full_name || 'Unknown Owner';
  const carMake = userData?.car_make;
  const carModel = userData?.car_model;
  const carColor = userData?.car_color;
  const licensePlate = userData?.car_license_plate;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={commonStyles.modalOverlay}>
        <View style={[commonStyles.modalContent, styles.modalContent]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.address}>{parking.address}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Owner</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>👤</Text>
                <Text style={styles.infoText}>{ownerName}</Text>
              </View>
            </View>

            {(carMake || carModel || carColor || licensePlate) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vehicle Details</Text>
                {(carMake || carModel) && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🚗</Text>
                    <Text style={styles.infoText}>
                      {carMake} {carModel}
                    </Text>
                  </View>
                )}
                {carColor && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🎨</Text>
                    <Text style={styles.infoText}>{carColor}</Text>
                  </View>
                )}
                {licensePlate && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoIcon}>🔢</Text>
                    <Text style={[styles.infoText, styles.licensePlate]}>
                      {licensePlate}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {hasExistingReservation && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  ⚠️ You already have an active reservation. Cancel it first to
                  reserve another spot.
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.reserveButton,
                  (isReserving || hasExistingReservation) && styles.reserveButtonDisabled,
                ]}
                onPress={handleReserveClick}
                disabled={isReserving || hasExistingReservation}
              >
                {isReserving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.reserveButtonText}>
                      {hasExistingReservation
                        ? 'Already Reserved'
                        : 'Reserve parking'}
                    </Text>
                    <Text style={styles.reserveButtonPrice}>50 ₪</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    maxHeight: '80%',
  },
  header: {
    marginBottom: 24,
  },
  address: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.darkGray,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    fontSize: 16,
    color: colors.darkGray,
  },
  licensePlate: {
    fontWeight: '600',
    letterSpacing: 2,
  },
  warningContainer: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  reserveButton: {
    backgroundColor: colors.primaryGradientStart,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  reserveButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  reserveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  reserveButtonPrice: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: colors.lightGray,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.gray,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ParkingDetailModal;
