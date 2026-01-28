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
  Platform,
  Linking,
} from 'react-native';
import { commonStyles } from '../styles/common';
import { colors } from '../styles/colors';
import { formatParkingZone } from '../utils/parkingZoneUtils';

/**
 * Opens the device's default navigation app with directions to the specified coordinates
 * @param {number} lat - Latitude of the destination
 * @param {number} lng - Longitude of the destination
 * @param {string} address - Address label for the destination (optional)
 */
const openNavigation = async (lat, lng, address = '') => {
  const destination = `${lat},${lng}`;
  const label = encodeURIComponent(address || 'Parking Location');
  
  if (Platform.OS === 'ios') {
    // Try Google Maps first, then Apple Maps
    const googleMapsUrl = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
    const appleMapsUrl = `maps://?daddr=${destination}&dirflg=d`;
    
    try {
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsUrl);
        return true;
      }
    } catch (error) {
      console.log('Google Maps not available, trying Apple Maps');
    }
    
    try {
      await Linking.openURL(appleMapsUrl);
      return true;
    } catch (error) {
      console.error('Failed to open Apple Maps:', error);
    }
  } else if (Platform.OS === 'android') {
    // Try Google Maps intent first, then geo URI
    const googleMapsUrl = `google.navigation:q=${destination}`;
    const geoUrl = `geo:${destination}?q=${destination}(${label})`;
    
    try {
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsUrl);
        return true;
      }
    } catch (error) {
      console.log('Google Maps navigation not available, trying geo URI');
    }
    
    try {
      await Linking.openURL(geoUrl);
      return true;
    } catch (error) {
      console.error('Failed to open geo URI:', error);
    }
  }
  
  // Fallback to web Google Maps
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  try {
    await Linking.openURL(webUrl);
    return true;
  } catch (error) {
    console.error('Failed to open Google Maps web:', error);
    return false;
  }
};

const ReservedParkingDetailModal = ({ visible, parking, onClose }) => {
  const [isNavigating, setIsNavigating] = useState(false);

  // Check if we have valid coordinates
  const hasValidCoordinates = parking?.position && 
    Array.isArray(parking.position) && 
    parking.position.length >= 2 &&
    typeof parking.position[0] === 'number' &&
    typeof parking.position[1] === 'number';

  const handleNavigateClick = async () => {
    if (isNavigating || !hasValidCoordinates) return;

    try {
      setIsNavigating(true);
      const [lat, lng] = parking.position;
      const success = await openNavigation(lat, lng, parking.address);
      
      if (!success) {
        Alert.alert(
          'Navigation Error',
          `Could not open navigation app. The parking address is:\n\n${parking.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}`,
          [
            { text: 'OK' }
          ]
        );
      }
    } catch (error) {
      console.error('Error opening navigation:', error);
      Alert.alert(
        'Error',
        'Failed to open navigation. Please try again.'
      );
    } finally {
      setIsNavigating(false);
    }
  };

  if (!parking) return null;

  const userData = parking.user || parking.users || {};
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
              <Text style={styles.address}>{parking.address || 'Reserved Parking Spot'}</Text>
            </View>

            <View style={styles.successBadge}>
              <Text style={styles.successText}>✅ You have reserved this parking spot</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🅿️</Text>
                <Text style={styles.infoText}>{formatParkingZone(parking.parking_zone)}</Text>
              </View>
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

            {parking.timestamp && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reservation Details</Text>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>🕐</Text>
                  <Text style={styles.infoText}>
                    {new Date(parking.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.navigateButton,
                  (!hasValidCoordinates || isNavigating) && styles.navigateButtonDisabled,
                ]}
                onPress={handleNavigateClick}
                disabled={!hasValidCoordinates || isNavigating}
              >
                {isNavigating ? (
                  <ActivityIndicator color={colors.primaryGradientStart} />
                ) : (
                  <View style={styles.navigateButtonContent}>
                    <Text style={styles.navigateIcon}>🧭</Text>
                    <Text style={[
                      styles.navigateButtonText,
                      !hasValidCoordinates && styles.navigateButtonTextDisabled,
                    ]}>
                      {hasValidCoordinates ? 'Navigate to Parking' : 'Location unavailable'}
                    </Text>
                  </View>
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
    marginBottom: 16,
  },
  address: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.darkGray,
    textAlign: 'center',
  },
  successBadge: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#28a745',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
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
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  navigateButton: {
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateButtonDisabled: {
    borderColor: colors.mediumGray,
    backgroundColor: colors.lightGray,
  },
  navigateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navigateIcon: {
    fontSize: 18,
  },
  navigateButtonText: {
    color: colors.primaryGradientStart,
    fontSize: 16,
    fontWeight: '600',
  },
  navigateButtonTextDisabled: {
    color: colors.gray,
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

export default ReservedParkingDetailModal;
