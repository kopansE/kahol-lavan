import React, { useState, useEffect } from "react";
import { useStreamChat } from "../contexts/StreamChatContext";
import ChatChannelList from "./ChatChannelList";
import WalletPage from "./WalletPage";
import SettingsPage from "./SettingsPage";
import ReportsPage from "./ReportsPage";
import ScheduleLeavePage from "./ScheduleLeavePage";
import "./SideMenu.css";

const GUEST_MESSAGES = {
  wallet: "אנא התחברו כדי לצפות בארנק",
  chats: "אנא התחברו כדי לצפות בצ׳אטים",
  scheduleleave: "אנא התחברו כדי לתזמן יציאה",
  reports: "אנא התחברו כדי לצפות בדיווחים",
  settings: "אנא התחברו כדי לצפות בהגדרות",
};

const SideMenu = ({
  isOpen,
  onClose,
  user,
  onSignOut,
  onSignIn,
  onAppleSignIn,
  userOwnPin,
  onShowToast,
}) => {
  const { chatClient, isReady } = useStreamChat();
  const [currentPage, setCurrentPage] = useState("menu");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!chatClient || !isReady) return;

    const updateUnreadCount = () => {
      const count = chatClient.user?.total_unread_count || 0;
      setUnreadCount(count);
    };

    updateUnreadCount();

    chatClient.on("message.new", updateUnreadCount);
    chatClient.on("notification.mark_read", updateUnreadCount);

    return () => {
      chatClient.off("message.new", updateUnreadCount);
      chatClient.off("notification.mark_read", updateUnreadCount);
    };
  }, [chatClient, isReady]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPage("menu");
    }
  }, [isOpen]);

  const handleBack = () => {
    setCurrentPage("menu");
  };

  const handleMenuItemClick = (page) => {
    if (!user) {
      onShowToast(GUEST_MESSAGES[page] || "אנא התחברו כדי להשתמש בתכונה זו");
      return;
    }
    setCurrentPage(page);
  };

  if (!isOpen) return null;

  // Sub-pages (only reachable when authenticated)
  if (user && currentPage === "wallet") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <WalletPage user={user} onBack={handleBack} onClose={onClose} />
        </div>
      </>
    );
  }

  if (user && currentPage === "chats") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <ChatChannelList
            onClose={onClose}
            onBack={handleBack}
            inSideMenu={true}
          />
        </div>
      </>
    );
  }

  if (user && currentPage === "settings") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <SettingsPage user={user} onBack={handleBack} onClose={onClose} />
        </div>
      </>
    );
  }

  if (user && currentPage === "reports") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <ReportsPage user={user} onBack={handleBack} onClose={onClose} />
        </div>
      </>
    );
  }

  if (user && currentPage === "scheduleleave") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <ScheduleLeavePage
            user={user}
            userOwnPin={userOwnPin}
            onBack={handleBack}
            onClose={onClose}
            onScheduleSuccess={onShowToast}
          />
        </div>
      </>
    );
  }

  // Main menu
  return (
    <>
      <div className="side-menu-overlay" onClick={onClose} />
      <div className={`side-menu ${isOpen ? "open" : ""}`}>
        <div className="side-menu-header">
          <button className="close-button" onClick={onClose}>
            ×
          </button>
          <div className="user-profile-section">
            {user ? (
              <>
                <div className="menu-avatar">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={user.user_metadata.full_name || user.email}
                    />
                  ) : (
                    <div className="menu-avatar-placeholder">
                      {user.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="menu-user-email">{user.email || ""}</div>
              </>
            ) : (
              <>
                <div className="menu-avatar">
                  <div className="menu-avatar-placeholder">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                </div>
                <div className="menu-user-email">כניסה כאורח/ת</div>
              </>
            )}
          </div>
        </div>

        <div className="side-menu-content">
          <nav className="menu-nav">
            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("wallet")}
            >
              <span className="menu-icon">
                <svg
                  width="24"
                  height="24"
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
              </span>
              <span className="menu-label">ארנק</span>
              <span className="menu-arrow">›</span>
            </button>

            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("chats")}
            >
              <span className="menu-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <span className="menu-label">צ׳אטים</span>
              {user && unreadCount > 0 && (
                <span className="menu-badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="menu-arrow">›</span>
            </button>

            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("scheduleleave")}
            >
              <span className="menu-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </span>
              <span className="menu-label">תזמון יציאה</span>
              <span className="menu-arrow">›</span>
            </button>

            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("reports")}
            >
              <span className="menu-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </span>
              <span className="menu-label">הדיווחים שלי</span>
              <span className="menu-arrow">›</span>
            </button>

            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("settings")}
            >
              <span className="menu-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <span className="menu-label">הגדרות</span>
              <span className="menu-arrow">›</span>
            </button>
          </nav>

          <div className="menu-divider"></div>

          {user ? (
            <button className="menu-item signout-item" onClick={onSignOut}>
              <span className="menu-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="menu-label">התנתקות</span>
            </button>
          ) : (
            <>
              <button className="menu-item signin-item" onClick={onSignIn}>
                <span className="menu-icon">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10,17 15,12 10,7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </span>
                <span className="menu-label">המשך עם Google</span>
              </button>
              <button className="menu-item apple-signin-item" onClick={onAppleSignIn}>
                <span className="menu-icon">
                  <svg width="20" height="24" viewBox="0 0 814 1000" fill="currentColor">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.3-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.5-317.3 79.5 0 145.6 52.7 195.2 52.7 47.4 0 121.6-55.8 211.8-55.8 16.2.1 128.3 1.7 198.2 107.4zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
                  </svg>
                </span>
                <span className="menu-label">המשך עם Apple</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SideMenu;
