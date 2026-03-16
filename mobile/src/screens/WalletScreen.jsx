import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../config/supabase";
import { colors } from "../styles/colors";
import { useToast } from "../contexts/ToastContext";
import { getWalletBalance, setupPaymentMethod, completePaymentSetup } from "../utils/edgeFunctions";

const WalletScreen = ({ navigation, route }) => {
  const { user } = route.params;
  const { showToast } = useToast();
  const [paymentSetupCompleted, setPaymentSetupCompleted] = useState(false);
  const [walletAmount, setWalletAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");

  useEffect(() => {
    if (user) {
      loadUserPaymentData();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

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
  }, [user]);

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

  const openPaymentSetup = async (nameOverride) => {
    const redirectBaseUrl = "kahollavan://";
    const setupResult = await setupPaymentMethod(redirectBaseUrl, nameOverride);
    if (!setupResult.hosted_page_url) return;

    console.log("[Payment] Full setup result:", JSON.stringify(setupResult));
    console.log("[Payment] Redirect URLs registered with Rapyd:", {
      complete: setupResult._debug_complete_url,
      cancel: setupResult._debug_cancel_url,
      error: setupResult._debug_error_url,
    });
    const sessionResult = await WebBrowser.openAuthSessionAsync(
      setupResult.hosted_page_url,
      "kahollavan://",
      { preferEphemeralSession: true }
    );
    console.log("[Payment] Session result:", JSON.stringify(sessionResult));

    if (sessionResult.type === "success") {
      const parsed = Linking.parse(sessionResult.url);
      console.log("[Payment] Parsed URL:", JSON.stringify(parsed));
      const paymentStatus = parsed.queryParams?.payment_setup;

      if (paymentStatus === "complete") {
        try {
          const result = await completePaymentSetup();
          if (result.success) {
            showToast(`אמצעי תשלום נוסף בהצלחה! 4 ספרות אחרונות: ${result.payment_method.last4}`);
          }
        } catch (e) {
          showToast("שמירת אמצעי התשלום נכשלה. אנא נסה שוב.");
        }
      } else if (paymentStatus === "cancelled") {
        showToast("הגדרת התשלום בוטלה.");
      } else if (paymentStatus === "error") {
        showToast("אירעה שגיאה בהגדרת התשלום.");
      }
    }

    await loadUserPaymentData();
  };

  const handleUpdatePaymentDetails = async () => {
    if (!user) return;

    try {
      setIsUpdatingPayment(true);
      await openPaymentSetup();
    } catch (error) {
      console.error("Failed to update payment details:", error);
      if (error.message?.includes("NAME_REQUIRED")) {
        setNameModalVisible(true);
      } else {
        showToast(error.message || "עדכון פרטי התשלום נכשל");
      }
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleNameSubmit = async () => {
    const trimmedFirst = firstNameInput.trim();
    if (!trimmedFirst) {
      showToast("יש להזין שם פרטי");
      return;
    }

    setNameModalVisible(false);

    try {
      setIsUpdatingPayment(true);
      await openPaymentSetup({
        firstName: trimmedFirst,
        lastName: lastNameInput.trim(),
      });
    } catch (error) {
      console.error("Failed to update payment details after name input:", error);
      showToast(error.message || "עדכון פרטי התשלום נכשל");
    } finally {
      setIsUpdatingPayment(false);
      setFirstNameInput("");
      setLastNameInput("");
    }
  };

  const handleWithdrawToBank = () => {
    showToast("משיכה לחשבון בנק - בקרוב!");
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
        <Text style={styles.headerTitle}>ארנק</Text>
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
            <Text style={styles.updateButtonText}>עדכון פרטי תשלום</Text>
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
              <Text style={styles.balanceLabel}>יתרת ארנק</Text>
              {walletAmount !== null ? (
                <Text style={styles.balanceAmount}>
                  ₪{walletAmount.toFixed(2)}
                </Text>
              ) : (
                <Text style={[styles.balanceAmount, styles.loading]}>
                  ₪0.00
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={handleWithdrawToBank}
            >
              <Text style={styles.withdrawButtonText}>משיכה לחשבון בנק</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.notSetupSection}>
            <Text style={styles.notSetupIcon}>💳</Text>
            <Text style={styles.notSetupText}>
              השלם את הגדרת התשלום כדי לצפות ביתרה ולמשוך כספים.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>פרטי שם</Text>
            <Text style={styles.modalSubtitle}>
              נא להזין את שמך כדי להמשיך בהגדרת התשלום
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="שם פרטי"
              placeholderTextColor="#999"
              value={firstNameInput}
              onChangeText={setFirstNameInput}
              autoFocus
              textAlign="right"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="שם משפחה"
              placeholderTextColor="#999"
              value={lastNameInput}
              onChangeText={setLastNameInput}
              textAlign="right"
            />

            <TouchableOpacity
              style={styles.modalSubmitButton}
              onPress={handleNameSubmit}
            >
              <Text style={styles.modalSubmitText}>המשך</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setNameModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryGradientStart,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "300",
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: colors.white,
    textAlign: "center",
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
    alignItems: "center",
    marginBottom: 20,
  },
  updateButtonText: {
    color: colors.darkGray,
    fontSize: 16,
    fontWeight: "600",
  },
  loadingState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  setupSection: {
    gap: 16,
  },
  walletCard: {
    backgroundColor: colors.primaryGradientStart,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
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
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.9)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: "700",
    color: colors.white,
  },
  loading: {
    opacity: 0.6,
  },
  withdrawButton: {
    backgroundColor: colors.cyan,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  notSetupSection: {
    backgroundColor: "#fff3cd",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
  },
  notSetupIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  notSetupText: {
    fontSize: 14,
    color: "#856404",
    textAlign: "center",
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.darkGray,
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.darkGray,
    marginBottom: 12,
  },
  modalSubmitButton: {
    backgroundColor: colors.primaryGradientStart,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  modalSubmitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  modalCancelButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  modalCancelText: {
    color: "#999",
    fontSize: 14,
  },
});

export default WalletScreen;
