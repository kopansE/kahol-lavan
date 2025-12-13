import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./PaymentSideMenu.css";

const PaymentSideMenu = ({ isOpen, onClose, user, onSignOut }) => {
  const [paymentSetupCompleted, setPaymentSetupCompleted] = useState(false);
  const [walletAmount, setWalletAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadUserPaymentData();
    }
  }, [isOpen, user]);

  const loadUserPaymentData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Fetch payment identifiers from users table (source of truth)
      const { data, error } = await supabase
        .from("users")
        .select("rapyd_customer_id, rapyd_wallet_id")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading user payment data:", error);
        setPaymentSetupCompleted(false);
      } else {
        const hasRapydSetup = Boolean(
          data?.rapyd_customer_id && data?.rapyd_wallet_id
        );
        setPaymentSetupCompleted(hasRapydSetup);
      }
    } catch (error) {
      console.error("Error loading user payment data:", error);
      setPaymentSetupCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaymentDetails = async () => {
    if (!user) return;

    try {
      setIsUpdatingPayment(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw new Error("Authentication error. Please log in again.");
      }

      const token = sessionData?.session?.access_token;
      if (!token) {
        throw new Error("No session token found. Please log in again.");
      }

      const url = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/setup-payment-method`;

      console.log("Sending redirect_base_url:", window.location.origin);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          redirect_base_url: window.location.origin,
        }),
      });

      const resultText = await response.text();
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (e) {
        throw new Error(
          `Unexpected server response (${response.status}): ${resultText}`
        );
      }

      if (!response.ok || !result?.success || !result?.hosted_page_url) {
        const message =
          result?.error || result?.message || "Failed to start payment setup";
        throw new Error(message);
      }

      // Redirect to Rapyd hosted page for card tokenization
      window.location.href = result.hosted_page_url;
    } catch (err) {
      console.error("Failed to update payment details:", err);
      alert(err.message || "Failed to update payment details");
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleWithdrawToBank = () => {
    alert("Withdraw to bank account button clicked! (Coming soon)");
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="payment-side-menu-overlay" onClick={onClose} />
      <div className={`payment-side-menu ${isOpen ? "open" : ""}`}>
        <div className="payment-side-menu-header">
          <div className="header-top">
            <h2>Payment Settings</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="user-profile-section">
            <div className="menu-avatar">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name || user.email}
                />
              ) : (
                <div className="menu-avatar-placeholder">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
            </div>
            <div className="menu-user-email">{user?.email || ""}</div>
          </div>
        </div>

        <div className="payment-side-menu-content">
          <button
            className="payment-menu-button update-button"
            onClick={handleUpdatePaymentDetails}
            disabled={isUpdatingPayment}
          >
            {isUpdatingPayment ? "Redirecting..." : "Update Payment Details"}
          </button>

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : paymentSetupCompleted ? (
            <div className="payment-setup-section">
              <div className="wallet-balance-section">
                <h3>Wallet Balance</h3>
                {walletAmount !== null ? (
                  <div className="wallet-amount">
                    ${walletAmount.toFixed(2)}
                  </div>
                ) : (
                  <div className="wallet-amount loading">$0.00</div>
                )}
              </div>

              <button
                className="payment-menu-button withdraw-button"
                onClick={handleWithdrawToBank}
              >
                Withdraw to Bank Account
              </button>
            </div>
          ) : (
            <div className="payment-not-setup">
              <p>
                Complete payment setup to view wallet balance and withdraw
                funds.
              </p>
            </div>
          )}

          <div className="payment-menu-divider"></div>

          <button
            className="payment-menu-button signout-button"
            onClick={onSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
};

export default PaymentSideMenu;
