import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ChatActionButtons = ({ onCancel, onApprove, onExtension }) => {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      Alert.alert('Cancel', 'Cancel clicked');
    }
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove();
    } else {
      Alert.alert('Approve', 'Approve clicked');
    }
  };

  const handleExtension = () => {
    if (onExtension) {
      onExtension();
    } else {
      Alert.alert('Extension', 'Extension clicked');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleCancel}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#ff6b6b', '#ee5a6f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={styles.icon}>✕</Text>
          <Text style={styles.label}>CANCEL</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleApprove}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#51cf66', '#37b24d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={styles.icon}>✓</Text>
          <Text style={styles.label}>APPROVE</Text>
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
  darkIcon: {
    color: '#333',
  },
  darkLabel: {
    color: '#333',
  },
});

export default ChatActionButtons;
