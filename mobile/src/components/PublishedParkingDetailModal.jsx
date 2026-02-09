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
import { reserveParking, cancelFutureReservation } from '../utils/edgeFunctions';
import { formatParkingZone } from '../utils/parkingZoneUtils';

const formatScheduledTime = (isoString) => {
  if (!isoString) return 'Unknown time';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (diffMs < 0) return `${dateStr} at ${timeStr} (past due)`;
  if (diffHours > 0) {
    return `${dateStr} at ${timeStr} (in ${diffHours}h ${diffMinutes}m)`;
  }
  return `${dateStr} at ${timeStr} (in ${diffMinutes}m)`;
};

const PublishedParkingDetailModal = ({ visible, parking, onClose, userReservedPins, currentUserId }) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const hasExistingReservation = userReservedPins && userReservedPins.length > 0;

  // Determine reservation status from data passed by get-active-pins (no RLS issues)
  const futureReservedBy = parking?.future_reserved_by || null;
  const futureReservationId = parking?.future_reservation_id || null;
  const isScheduledByMe = futureReservedBy && futureReservedBy === currentUserId;
  const isScheduledByOther = futureReservedBy && futureReservedBy !== currentUserId;
  const alreadyScheduled = isScheduledByMe || isScheduledByOther;

  const handleScheduleClick = async () => {
    if (isScheduling) return;

    if (hasExistingReservation) {
      Alert.alert(
        'Already Reserved',
        'You already have an active reservation. Please cancel it before scheduling another spot.'
      );
      return;
    }

    try {
      setIsScheduling(true);

      const result = await reserveParking(parking.id);

      Alert.alert('Success', result.message);
      onClose();
    } catch (error) {
      console.error('Error scheduling parking:', error);
      Alert.alert('Error', `Failed to schedule parking: ${error.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelFutureReservation = async () => {
    if (isCancelling || !futureReservationId) return;

    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel your scheduled reservation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsCancelling(true);
              const result = await cancelFutureReservation(futureReservationId);
              Alert.alert('Cancelled', result.message);
              onClose();
            } catch (error) {
              console.error('Error cancelling future reservation:', error);
              Alert.alert('Error', `Failed to cancel reservation: ${error.message}`);
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
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

            {/* Scheduled Departure Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Scheduled Departure</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🕐</Text>
                <Text style={[styles.infoText, { fontWeight: '600', color: '#34A853' }]}>
                  {formatScheduledTime(parking.scheduled_for)}
                </Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🅿️</Text>
                <Text style={styles.infoText}>{formatParkingZone(parking.parking_zone)}</Text>
              </View>
            </View>

            {/* Owner */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Owner</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>👤</Text>
                <Text style={styles.infoText}>{ownerName}</Text>
              </View>
            </View>

            {/* Vehicle Details */}
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

            {hasExistingReservation && !isScheduledByMe && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  You already have an active reservation. Cancel it first to
                  schedule another spot.
                </Text>
              </View>
            )}

            {isScheduledByMe && (
              <View style={[styles.warningContainer, styles.successContainer]}>
                <Text style={[styles.warningText, styles.successText]}>
                  You have scheduled this spot. It will activate at the scheduled time.
                </Text>
              </View>
            )}

            {isScheduledByOther && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  This parking spot is already scheduled by another user.
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              {isScheduledByMe ? (
                <TouchableOpacity
                  style={[styles.scheduleButton, styles.cancelButton]}
                  onPress={handleCancelFutureReservation}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.scheduleButtonText}>Cancel My Reservation</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.scheduleButton,
                    (isScheduling || hasExistingReservation || isScheduledByOther) && styles.scheduleButtonDisabled,
                  ]}
                  onPress={handleScheduleClick}
                  disabled={isScheduling || hasExistingReservation || isScheduledByOther}
                >
                  {isScheduling ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Text style={styles.scheduleButtonText}>
                        {isScheduledByOther
                          ? 'Already Scheduled'
                          : hasExistingReservation
                          ? 'Already Reserved'
                          : 'Schedule This Spot'}
                      </Text>
                      {!isScheduledByOther && <Text style={styles.scheduleButtonPrice}>Free</Text>}
                    </>
                  )}
                </TouchableOpacity>
              )}

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
  successContainer: {
    backgroundColor: '#e8f5e9',
    borderColor: '#34A853',
    borderWidth: 1,
  },
  successText: {
    color: '#2e7d32',
  },
  cancelButton: {
    backgroundColor: '#dc3545',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  scheduleButton: {
    backgroundColor: '#34A853',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  scheduleButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  scheduleButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleButtonPrice: {
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

export default PublishedParkingDetailModal;
