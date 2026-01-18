import { StyleSheet, Platform } from 'react-native';
import { colors } from './colors';

export const commonStyles = StyleSheet.create({
  // Shadows
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  shadowLarge: {
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  
  // Buttons
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  
  modalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: 8,
    textAlign: 'center',
  },
  
  modalMessage: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 16,
    textAlign: 'center',
  },
  
  // Form inputs
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.white,
  },
  
  inputError: {
    borderColor: colors.red,
  },
  
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: 8,
  },
  
  errorText: {
    fontSize: 12,
    color: colors.red,
    marginTop: 4,
  },
});
