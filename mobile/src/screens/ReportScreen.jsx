import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors } from '../styles/colors';

const REPORT_REASONS = [
  { value: 'no_show', label: 'No Show - User didn\'t show up' },
  { value: 'wrong_location', label: 'Wrong Location - Parking spot was incorrect' },
  { value: 'harassment', label: 'Harassment - Inappropriate behavior' },
  { value: 'fraud', label: 'Fraud - Deceptive or fraudulent activity' },
  { value: 'other', label: 'Other' },
];

const ReportScreen = ({ route, navigation }) => {
  const { reportedUserId, reportedUserName, transferRequestId } = route.params;
  const [reportType, setReportType] = useState('');
  const [reportTypeLabel, setReportTypeLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleSelectReason = (reason) => {
    setReportType(reason.value);
    setReportTypeLabel(reason.label);
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    if (!reportType) {
      Alert.alert('Error', 'Please select a reason for your report');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description of the issue');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('Error', 'Please provide a more detailed description (at least 10 characters)');
      return;
    }

    try {
      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'Authentication error. Please log in again.');
        return;
      }

      // Determine severity based on report type
      let severity = 'medium';
      if (reportType === 'fraud' || reportType === 'harassment') {
        severity = 'high';
      } else if (reportType === 'other') {
        severity = 'low';
      }

      const { error: insertError } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          transfer_request_id: transferRequestId,
          report_type: reportType,
          description: description.trim(),
          severity: severity,
          status: 'pending',
        });

      if (insertError) {
        console.error('Error submitting report:', insertError);
        Alert.alert('Error', 'Failed to submit report. Please try again.');
        return;
      }

      Alert.alert(
        'Report Submitted',
        'Your report has been submitted successfully. We will review it shortly.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      console.error('Error submitting report:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const renderReasonItem = ({ item }) => (
    <TouchableOpacity
      style={styles.reasonItem}
      onPress={() => handleSelectReason(item)}
    >
      <Text style={styles.reasonItemText}>{item.label}</Text>
      {reportType === item.value && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report User</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            You are reporting: <Text style={styles.infoName}>{reportedUserName || 'Unknown User'}</Text>
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Reason for Report *</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowPicker(true)}
            disabled={isSubmitting}
          >
            <Text style={[styles.selectButtonText, !reportType && styles.placeholderText]}>
              {reportTypeLabel || 'Select a reason...'}
            </Text>
            <Text style={styles.selectArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Please describe what happened in detail..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.submitButton,
              (!reportType || !description.trim() || isSubmitting) && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={!reportType || !description.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reason Picker Modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Reason</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={REPORT_REASONS}
              renderItem={renderReasonItem}
              keyExtractor={(item) => item.value}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: colors.primaryGradientStart,
  },
  backButton: {
    fontSize: 28,
    color: 'white',
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  infoBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  infoName: {
    fontWeight: '600',
    color: '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  selectButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  selectArrow: {
    fontSize: 10,
    color: '#666',
    marginLeft: 8,
  },
  textArea: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: colors.primaryGradientStart,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#666',
    lineHeight: 28,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  reasonItemText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    color: colors.primaryGradientStart,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
});

export default ReportScreen;
