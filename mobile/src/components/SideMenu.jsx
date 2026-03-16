import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Svg, Path } from "react-native-svg";
import { useStreamChat } from "../contexts/StreamChatContext";
import { useToast } from "../contexts/ToastContext";
import { colors } from "../styles/colors";

const { width } = Dimensions.get("window");

const GUEST_MESSAGES = {
  wallet: "אנא התחברו כדי לצפות בארנק",
  chats: "אנא התחברו כדי לצפות בצ׳אטים",
  reports: "אנא התחברו כדי לצפות בדיווחים",
  settings: "אנא התחברו כדי לצפות בהגדרות",
};

const SideMenu = ({
  visible,
  onClose,
  user,
  onSignOut,
  onSignIn,
  onAppleSignIn,
  onNavigateToWallet,
  onNavigateToChats,
  onNavigateToSettings,
  onNavigateToReports,
}) => {
  const { chatClient, isReady } = useStreamChat();
  const { showToast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const slideAnim = useState(new Animated.Value(-width * 0.85))[0];

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -width * 0.85,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

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

  const handleMenuItemPress = (action, guestKey) => {
    if (!user) {
      showToast(GUEST_MESSAGES[guestKey] || "אנא התחברו כדי להשתמש בתכונה זו");
      return;
    }
    onClose();
    setTimeout(() => {
      action();
    }, 300);
  };

  const handleAuthAction = () => {
    onClose();
    setTimeout(() => {
      if (user) {
        onSignOut();
      } else {
        onSignIn();
      }
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.menu,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            <View style={styles.profileSection}>
              {user ? (
                <>
                  {user.user_metadata?.avatar_url ? (
                    <Image
                      source={{ uri: user.user_metadata.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {user.email?.charAt(0).toUpperCase() || "U"}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.email}>{user.email || ""}</Text>
                </>
              ) : (
                <>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.guestAvatarText}>👤</Text>
                  </View>
                  <Text style={styles.email}>כניסה כאורח/ת</Text>
                </>
              )}
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.content}>
            <View style={styles.menuNav}>
              {/* Wallet */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  handleMenuItemPress(onNavigateToWallet, "wallet")
                }
              >
                <View style={styles.menuIcon}>
                  <WalletIcon />
                </View>
                <Text style={styles.menuLabel}>ארנק</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              {/* Chats */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  handleMenuItemPress(onNavigateToChats, "chats")
                }
              >
                <View style={styles.menuIcon}>
                  <ChatIcon />
                </View>
                <Text style={styles.menuLabel}>צ׳אטים</Text>
                {user && unreadCount > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              {/* Reports */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  handleMenuItemPress(onNavigateToReports, "reports")
                }
              >
                <View style={styles.menuIcon}>
                  <ReportsIcon />
                </View>
                <Text style={styles.menuLabel}>הדיווחים שלי</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  handleMenuItemPress(onNavigateToSettings, "settings")
                }
              >
                <View style={styles.menuIcon}>
                  <SettingsIcon />
                </View>
                <Text style={styles.menuLabel}>הגדרות</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Sign In / Sign Out */}
            {user ? (
              <TouchableOpacity
                style={[styles.menuItem, styles.signoutItem]}
                onPress={handleAuthAction}
              >
                <View style={[styles.menuIcon, styles.signoutIcon]}>
                  <SignOutIcon />
                </View>
                <Text style={[styles.menuLabel, styles.signoutLabel]}>
                  התנתקות
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.googleSigninButton}
                  onPress={() => {
                    onClose();
                    setTimeout(() => onSignIn(), 300);
                  }}
                  activeOpacity={0.85}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </Svg>
                  <Text style={styles.googleSigninText}>המשך עם Google</Text>
                </TouchableOpacity>
                {Platform.OS === "ios" && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={
                      AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    }
                    buttonStyle={
                      AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    cornerRadius={12}
                    style={styles.appleSigninButton}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onAppleSignIn(), 300);
                    }}
                  />
                )}
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Icon Components
const WalletIcon = () => (
  <View style={iconStyles.container}>
    <View style={[iconStyles.rect, { width: 20, height: 14 }]} />
    <View style={[iconStyles.line, { width: 20, top: 6 }]} />
    <View style={[iconStyles.line, { width: 6, top: 10, left: 2 }]} />
  </View>
);

const ChatIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.chatBubble} />
  </View>
);

const SettingsIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.gear} />
  </View>
);

const SignOutIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.signout} />
  </View>
);

const SignInIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.signin} />
  </View>
);

const ReportsIcon = () => (
  <View style={iconStyles.container}>
    <View style={iconStyles.reports} />
    <View style={iconStyles.reportsPlus} />
  </View>
);

const iconStyles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  rect: {
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    borderRadius: 4,
    position: "absolute",
  },
  line: {
    height: 2,
    backgroundColor: colors.primaryGradientStart,
    position: "absolute",
  },
  chatBubble: {
    width: 20,
    height: 16,
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    borderRadius: 4,
    borderBottomLeftRadius: 0,
  },
  gear: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    borderRadius: 9,
  },
  signout: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: colors.red,
    borderRadius: 3,
    borderRightWidth: 0,
  },
  signin: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    borderRadius: 3,
    borderLeftWidth: 0,
  },
  reports: {
    width: 16,
    height: 20,
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    borderRadius: 3,
  },
  reportsPlus: {
    position: "absolute",
    width: 8,
    height: 2,
    backgroundColor: colors.primaryGradientStart,
    top: 12,
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flexDirection: "row",
  },
  overlayTouch: {
    flex: 1,
  },
  menu: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.85,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    backgroundColor: colors.primaryGradientStart,
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "300",
  },
  profileSection: {
    alignItems: "center",
    marginTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "600",
    color: colors.white,
  },
  guestAvatarText: {
    fontSize: 36,
  },
  email: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  menuNav: {
    gap: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: colors.darkGray,
  },
  menuBadge: {
    backgroundColor: "#ff4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  menuBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  menuArrow: {
    fontSize: 20,
    color: colors.gray,
    fontWeight: "300",
  },
  divider: {
    height: 1,
    backgroundColor: colors.mediumGray,
    marginVertical: 20,
  },
  signoutItem: {
    marginTop: "auto",
  },
  signoutIcon: {
    color: colors.red,
  },
  signoutLabel: {
    color: colors.red,
  },
  googleSigninButton: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "#dadce0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  googleSigninText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3c4043",
  },
  appleSigninButton: {
    width: "100%",
    height: 48,
    marginTop: 10,
  },
});

export default SideMenu;
