import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./PaymentSideMenu.css";

const PaymentSideMenu = ({ isOpen, onClose, user, onSignOut }) => {
  const [paymentSetupCompleted, setPaymentSetupCompleted] = useState(false);
  const [walletAmount, setWalletAmount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      loadUserPaymentData();
    }
  }, [isOpen, user]);

  const loadUserPaymentData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Fetch user profile data from the profiles table
      const { data, error } = await supabase
        .from("profiles")
        .select("payment_setup_completed")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading user payment data:", error);
        setPaymentSetupCompleted(false);
      } else {
        setPaymentSetupCompleted(data?.payment_setup_completed || false);
      }
    } catch (error) {
      console.error("Error loading user payment data:", error);
      setPaymentSetupCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaymentDetails = () => {
    alert("Update payment details button clicked! (Coming soon)");
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
          >
            Update Payment Details
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
