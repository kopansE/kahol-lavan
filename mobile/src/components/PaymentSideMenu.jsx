import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../config/supabase";
import ReservationNotification from "./ReservationNotification";
import { colors } from "../styles/colors";
import { useToast } from "../contexts/ToastContext";
import { getWalletBalance, setupPaymentMethod } from "../utils/edgeFunctions";
import { NGROK_URL } from "@env";

const PaymentSideMenu = ({
  visible,
  onClose,
  user,
  onSignOut,
  pendingNotifications = [],
  onAcceptReservation,
  onDeclineReservation,
}) => {
  const { showToast } = useToast();
  const [paymentSetupCompleted, setPaymentSetupCompleted] = useState(false);
  const [walletAmount, setWalletAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadUserPaymentData();
    }
  }, [visible, user]);

  useEffect(() => {
    if (!visible || !user) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("users")
        .select("rapyd_wallet_id, payment_setup_completed")
        .eq("id", user.id)
        .single();

      if (data?.payment_setup_completed && data?.rapyd_wallet_id) {
        await fetchWalletBalance();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [visible, user]);

  const loadUserPaymentData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select(
          "rapyd_customer_id, rapyd_payment_method_id, payment_setup_completed, rapyd_wallet_id",
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading user payment data:", error);
        setPaymentSetupCompleted(false);
      } else {
        const isSetupCompleted = Boolean(data?.payment_setup_completed);
        setPaymentSetupCompleted(isSetupCompleted);

        if (isSetupCompleted && data?.rapyd_wallet_id) {
          await fetchWalletBalance();
        }
      }
    } catch (error) {
      console.error("Error loading user payment data:", error);
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
      console.error("Error fetching wallet balance:", error);
      setWalletAmount(0);
    }
  };

  const handleUpdatePaymentDetails = async () => {
    if (!user) return;

    try {
      setIsUpdatingPayment(true);

      const redirectBaseUrl = NGROK_URL || "kahollavan://";
      const result = await setupPaymentMethod(redirectBaseUrl);

      if (result.hosted_page_url) {
        await WebBrowser.openBrowserAsync(result.hosted_page_url);
      }
    } catch (error) {
      console.error("Failed to update payment details:", error);
      showToast(error.message || "עדכון פרטי התשלום נכשל");
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleWithdrawToBank = () => {
    showToast("משיכה לחשבון בנק - בקרוב!");
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.menu}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>הגדרות תשלום</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.profileSection}>
              {user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: user.user_metadata.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
              )}
              <Text style={styles.email}>{user?.email || ""}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdatePaymentDetails}
              disabled={isUpdatingPayment}
            >
              {isUpdatingPayment ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.updateButtonText}>עדכון פרטי תשלום</Text>
              )}
            </TouchableOpacity>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primaryGradientStart} />
              </View>
            ) : paymentSetupCompleted ? (
              <View style={styles.setupSection}>
                <View style={styles.walletSection}>
                  <Text style={styles.walletTitle}>יתרת ארנק</Text>
                  {walletAmount !== null ? (
                    <Text style={styles.walletAmount}>
                      ₪{walletAmount.toFixed(2)}
                    </Text>
                  ) : (
                    <Text style={[styles.walletAmount, styles.loading]}>
                      ₪0.00
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.withdrawButton}
                  onPress={handleWithdrawToBank}
                >
                  <Text style={styles.withdrawButtonText}>
                    משיכה לחשבון בנק
                  </Text>
                </TouchableOpacity>

                {pendingNotifications.length > 0 && (
                  <View style={styles.notificationsSection}>
                    {pendingNotifications.map((notification) => (
                      <ReservationNotification
                        key={notification.id}
                        notification={notification}
                        onAccept={onAcceptReservation}
                        onDecline={onDeclineReservation}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.notSetupSection}>
                <Text style={styles.notSetupText}>
                  השלם את הגדרת התשלום כדי לצפות ביתרה ולמשוך כספים.
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <TouchableOpacity style={styles.signoutButton} onPress={onSignOut}>
              <Text style={styles.signoutButtonText}>התנתקות</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: "flex-end",
  },
  menu: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.darkGray,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.gray,
  },
  profileSection: {
    alignItems: "center",
    marginTop: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryGradientStart,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.white,
  },
  email: {
    fontSize: 14,
    color: colors.gray,
  },
  content: {
    padding: 20,
  },
  updateButton: {
    backgroundColor: colors.primaryGradientStart,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  updateButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  setupSection: {
    marginBottom: 16,
  },
  walletSection: {
    backgroundColor: colors.lightGray,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.darkGray,
    marginBottom: 8,
  },
  walletAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primaryGradientStart,
  },
  loading: {
    opacity: 0.5,
  },
  withdrawButton: {
    backgroundColor: colors.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  withdrawButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  notificationsSection: {
    marginTop: 8,
  },
  notSetupSection: {
    paddingVertical: 20,
    alignItems: "center",
  },
  notSetupText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.mediumGray,
    marginVertical: 16,
  },
  signoutButton: {
    backgroundColor: colors.red,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  signoutButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PaymentSideMenu;
