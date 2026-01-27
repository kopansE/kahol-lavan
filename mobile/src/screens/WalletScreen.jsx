import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../config/supabase';
import { colors } from '../styles/colors';
import { getWalletBalance, setupPaymentMethod } from '../utils/edgeFunctions';
import { NGROK_URL } from '@env';

const WalletScreen = ({ navigation, route }) => {
  const { user } = route.params;
  const [paymentSetupCompleted, setPaymentSetupCompleted] = useState(false);
  const [walletAmount, setWalletAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserPaymentData();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('users')
        .select('rapyd_wallet_id, payment_setup_completed')
        .eq('id', user.id)
        .single();

      if (data?.payment_setup_completed && data?.rapyd_wallet_id) {
        await fetchWalletBalance();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  const loadUserPaymentData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select(
          'rapyd_customer_id, rapyd_payment_method_id, payment_setup_completed, rapyd_wallet_id'
        )
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading user payment data:', error);
        setPaymentSetupCompleted(false);
      } else {
        const isSetupCompleted = Boolean(data?.payment_setup_completed);
        setPaymentSetupCompleted(isSetupCompleted);

        if (isSetupCompleted && data?.rapyd_wallet_id) {
          await fetchWalletBalance();
        }
      }
    } catch (error) {
      console.error('Error loading user payment data:', error);
      setPaymentSetupCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const result = await getWalletBalance();
      setWalletAmount(result.balance);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      setWalletAmount(0);
    }
  };

  const handleUpdatePaymentDetails = async () => {
    if (!user) return;

    try {
      setIsUpdatingPayment(true);

      const redirectBaseUrl = NGROK_URL || 'kahollavan://';
      const result = await setupPaymentMethod(redirectBaseUrl);

      if (result.hosted_page_url) {
        await WebBrowser.openBrowserAsync(result.hosted_page_url);
      }
    } catch (error) {
      console.error('Failed to update payment details:', error);
      Alert.alert('Error', error.message || 'Failed to update payment details');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleWithdrawToBank = () => {
    Alert.alert('Coming Soon', 'Withdraw to bank account feature is coming soon!');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdatePaymentDetails}
          disabled={isUpdatingPayment}
        >
          {isUpdatingPayment ? (
            <ActivityIndicator color={colors.darkGray} />
          ) : (
            <Text style={styles.updateButtonText}>Update Payment Details</Text>
          )}
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primaryGradientStart} />
          </View>
        ) : paymentSetupCompleted ? (
          <View style={styles.setupSection}>
            {/* Wallet Balance Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletIconContainer}>
                <Text style={styles.walletIcon}>💳</Text>
              </View>
              <Text style={styles.balanceLabel}>Wallet Balance</Text>
              {walletAmount !== null ? (
                <Text style={styles.balanceAmount}>₪{walletAmount.toFixed(2)}</Text>
              ) : (
                <Text style={[styles.balanceAmount, styles.loading]}>₪0.00</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={handleWithdrawToBank}
            >
              <Text style={styles.withdrawButtonText}>Withdraw to Bank Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.notSetupSection}>
            <Text style={styles.notSetupIcon}>💳</Text>
            <Text style={styles.notSetupText}>
              Complete payment setup to view wallet balance and withdraw funds.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryGradientStart,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  updateButton: {
    backgroundColor: colors.lightGray,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  updateButtonText: {
    color: colors.darkGray,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  setupSection: {
    gap: 16,
  },
  walletCard: {
    backgroundColor: colors.primaryGradientStart,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.primaryGradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  walletIconContainer: {
    marginBottom: 12,
  },
  walletIcon: {
    fontSize: 48,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.white,
  },
  loading: {
    opacity: 0.6,
  },
  withdrawButton: {
    backgroundColor: colors.cyan,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  notSetupSection: {
    backgroundColor: '#fff3cd',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  notSetupIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  notSetupText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default WalletScreen;
