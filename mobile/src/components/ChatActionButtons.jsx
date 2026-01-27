import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ChatActionButtons = ({ onCancel, onApprove, onExtension, isProcessing = false, approvalState = {} }) => {
  const { userApproved, otherUserApproved, bothApproved } = approvalState;

  console.log('ChatActionButtons rendered with:', { 
    hasOnApprove: !!onApprove, 
    hasOnCancel: !!onCancel, 
    isProcessing, 
    approvalState 
  });

  const handleCancel = () => {
    console.log('ChatActionButtons: Cancel button pressed');
    if (onCancel && !isProcessing && !bothApproved) {
      console.log('ChatActionButtons: Calling onCancel handler');
      onCancel();
    } else {
      console.log('ChatActionButtons: Cancel blocked -', { hasOnCancel: !!onCancel, isProcessing, bothApproved });
    }
  };

  const handleApprove = () => {
    console.log('ChatActionButtons: Approve button pressed');
    if (onApprove && !isProcessing && !bothApproved) {
      console.log('ChatActionButtons: Calling onApprove handler');
      onApprove();
    } else {
      console.log('ChatActionButtons: Approve blocked -', { hasOnApprove: !!onApprove, isProcessing, bothApproved });
    }
  };

  const handleExtension = () => {
    if (onExtension && !isProcessing) {
      onExtension();
    }
  };

  // Determine button states and text
  const approveButtonDisabled = isProcessing || bothApproved;
  const cancelButtonDisabled = isProcessing || bothApproved;
  
  const getApproveButtonText = () => {
    if (bothApproved) return 'COMPLETED';
    if (isProcessing) return 'PROCESSING...';
    if (userApproved && !otherUserApproved) return 'WAITING...';
    return 'APPROVE';
  };

  const getCancelButtonText = () => {
    if (bothApproved) return 'COMPLETED';
    if (isProcessing) return 'PROCESSING...';
    return 'CANCEL';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, cancelButtonDisabled && styles.buttonDisabled]}
        onPress={handleCancel}
        activeOpacity={cancelButtonDisabled ? 1 : 0.8}
        disabled={cancelButtonDisabled}
      >
        <LinearGradient
          colors={cancelButtonDisabled ? ['#d0d0d0', '#b0b0b0'] : ['#ff6b6b', '#ee5a6f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.icon}>✕</Text>
              <Text style={styles.label}>{getCancelButtonText()}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, approveButtonDisabled && styles.buttonDisabled]}
        onPress={handleApprove}
        activeOpacity={approveButtonDisabled ? 1 : 0.8}
        disabled={approveButtonDisabled}
      >
        <LinearGradient
          colors={
            bothApproved
              ? ['#4dabf7', '#339af0']
              : approveButtonDisabled
              ? ['#d0d0d0', '#b0b0b0']
              : ['#51cf66', '#37b24d']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.icon}>
                {bothApproved ? '✓✓' : userApproved && !otherUserApproved ? '⏳' : '✓'}
              </Text>
              <Text style={[styles.label, (userApproved && !otherUserApproved) && styles.smallLabel]}>
                {getApproveButtonText()}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleExtension}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#ffd43b', '#fab005']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={[styles.icon, styles.darkIcon]}>+</Text>
          <Text style={[styles.label, styles.darkLabel]}>EXTENSION</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 15,
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'white',
  },
  smallLabel: {
    fontSize: 13,
  },
  darkIcon: {
    color: '#333',
  },
  darkLabel: {
    color: '#333',
  },
});

export default ChatActionButtons;
