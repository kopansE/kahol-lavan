import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../contexts/ToastContext";
import "./WalletPage.css";

const WalletPage = ({ user, onBack, onClose }) => {
  const { showToast } = useToast();
  const [paymentSetupCompleted, setPaymentSetupCompleted] = useState(false);
  const [walletAmount, setWalletAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserPaymentData();
    }
  }, [user]);

  // Auto-refresh wallet balance every 5 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("users")
        .select("rapyd_wallet_id, payment_setup_completed")
        .eq("id", user.id)
        .single();

      if (data?.payment_setup_completed && data?.rapyd_wallet_id) {
        await fetchWalletBalance(data.rapyd_wallet_id);
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
          await fetchWalletBalance(data.rapyd_wallet_id);
        }
      }
    } catch (error) {
      console.error("Error loading user payment data:", error);
      setPaymentSetupCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletBalance = async (walletId) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.error("No access token found");
        return;
      }

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/get-wallet-balance`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setWalletAmount(result.balance);
      } else {
        console.error("Failed to fetch wallet balance:", result.error);
        setWalletAmount(0);
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      setWalletAmount(0);
    }
  };

  const handleUpdatePaymentDetails = async () => {
    if (!user) return;

    try {
      setIsUpdatingPayment(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw new Error("שגיאת אימות. אנא התחבר מחדש.");
      }

      const token = sessionData?.session?.access_token;
      if (!token) {
        throw new Error("לא נמצא טוקן. אנא התחבר מחדש.");
      }

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/setup-payment-method`;

      const redirectBaseUrl =
        import.meta.env.VITE_NGROK_URL || window.location.origin;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          redirect_base_url: redirectBaseUrl,
        }),
      });

      const resultText = await response.text();
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (e) {
        throw new Error(
          `Unexpected server response (${response.status}): ${resultText}`,
        );
      }

      if (!response.ok || !result?.success || !result?.hosted_page_url) {
        const message =
          result?.error || result?.message || "הגדרת התשלום נכשלה";
        throw new Error(message);
      }

      window.location.href = result.hosted_page_url;
    } catch (err) {
      console.error("Failed to update payment details:", err);
      showToast(err.message || "עדכון פרטי התשלום נכשל");
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleWithdrawToBank = () => {
    showToast("משיכה לחשבון בנק - בקרוב!");
  };

  return (
    <div className="wallet-page">
      <div className="page-header">
        <button className="back-button" onClick={onBack}>
          ‹
        </button>
        <h2 className="page-title">ארנק</h2>
        <button className="page-close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="page-content">
        <button
          className="wallet-button update-button"
          onClick={handleUpdatePaymentDetails}
          disabled={isUpdatingPayment}
        >
          {isUpdatingPayment ? "מפנה..." : "עדכון פרטי תשלום"}
        </button>

        {loading ? (
          <div className="loading-state">טוען...</div>
        ) : paymentSetupCompleted ? (
          <div className="wallet-setup-section">
            <div className="wallet-balance-card">
              <div className="balance-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 10h20" />
                  <path d="M6 16h4" />
                </svg>
              </div>
              <div className="balance-label">יתרת ארנק</div>
              {walletAmount !== null ? (
                <div className="balance-amount">₪{walletAmount.toFixed(2)}</div>
              ) : (
                <div className="balance-amount loading">₪0.00</div>
              )}
            </div>

            <button
              className="wallet-button withdraw-button"
              onClick={handleWithdrawToBank}
            >
              משיכה לחשבון בנק
            </button>
          </div>
        ) : (
          <div className="wallet-not-setup">
            <div className="not-setup-icon">💳</div>
            <p>השלם את הגדרת התשלום כדי לצפות ביתרה ולמשוך כספים.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
