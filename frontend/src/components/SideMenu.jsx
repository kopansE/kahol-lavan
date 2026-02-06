import React, { useState, useEffect } from "react";
import { useStreamChat } from "../contexts/StreamChatContext";
import ChatChannelList from "./ChatChannelList";
import WalletPage from "./WalletPage";
import SettingsPage from "./SettingsPage";
import ReportsPage from "./ReportsPage";
import ScheduleLeavePage from "./ScheduleLeavePage";
import "./SideMenu.css";

const SideMenu = ({ isOpen, onClose, user, onSignOut, userOwnPin, onShowToast }) => {
  const { chatClient, isReady } = useStreamChat();
  const [currentPage, setCurrentPage] = useState("menu"); // 'menu', 'wallet', 'chats', 'settings', 'reports', 'scheduleleave'
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

  // Reset to menu when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage("menu");
    }
  }, [isOpen]);

  const handleBack = () => {
    setCurrentPage("menu");
  };

  const handleMenuItemClick = (page) => {
    setCurrentPage(page);
  };

  if (!isOpen) return null;

  // Render sub-pages
  if (currentPage === "wallet") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <WalletPage user={user} onBack={handleBack} onClose={onClose} />
        </div>
      </>
    );
  }

  if (currentPage === "chats") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <ChatChannelList onClose={onClose} onBack={handleBack} inSideMenu={true} />
        </div>
      </>
    );
  }

  if (currentPage === "settings") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <SettingsPage user={user} onBack={handleBack} onClose={onClose} />
        </div>
      </>
    );
  }

  if (currentPage === "reports") {
    return (
      <>
        <div className="side-menu-overlay" onClick={onClose} />
        <div className={`side-menu ${isOpen ? "open" : ""}`}>
          <ReportsPage user={user} onBack={handleBack} onClose={onClose} />
        </div>
      </>
    );
  }

  if (currentPage === "scheduleleave") {
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

        <div className="side-menu-content">
          <nav className="menu-nav">
            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("wallet")}
            >
              <span className="menu-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 10h20" />
                  <path d="M6 16h4" />
                </svg>
              </span>
              <span className="menu-label">Wallet</span>
              <span className="menu-arrow">›</span>
            </button>

            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("chats")}
            >
              <span className="menu-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <span className="menu-label">Chats</span>
              {unreadCount > 0 && (
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </span>
              <span className="menu-label">Schedule Leave</span>
              <span className="menu-arrow">›</span>
            </button>

            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("reports")}
            >
              <span className="menu-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </span>
              <span className="menu-label">My Reports</span>
              <span className="menu-arrow">›</span>
            </button>

            <button
              className="menu-item"
              onClick={() => handleMenuItemClick("settings")}
            >
              <span className="menu-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <span className="menu-label">Settings</span>
              <span className="menu-arrow">›</span>
            </button>
          </nav>

          <div className="menu-divider"></div>

          <button className="menu-item signout-item" onClick={onSignOut}>
            <span className="menu-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="menu-label">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default SideMenu;
