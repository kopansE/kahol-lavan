import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useStreamChat } from '../contexts/StreamChatContext';
import { colors } from '../styles/colors';

const { width } = Dimensions.get('window');

const SideMenu = ({
  visible,
  onClose,
  user,
  onSignOut,
  onNavigateToWallet,
  onNavigateToChats,
  onNavigateToSettings,
}) => {
  const { chatClient, isReady } = useStreamChat();
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

    chatClient.on('message.new', updateUnreadCount);
    chatClient.on('notification.mark_read', updateUnreadCount);

    return () => {
      chatClient.off('message.new', updateUnreadCount);
      chatClient.off('notification.mark_read', updateUnreadCount);
    };
  }, [chatClient, isReady]);

  const handleMenuItemPress = (action) => {
    onClose();
    setTimeout(() => {
      action();
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
              {user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: user.user_metadata.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <Text style={styles.email}>{user?.email || ''}</Text>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.content}>
            <View style={styles.menuNav}>
              {/* Wallet */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuItemPress(onNavigateToWallet)}
              >
                <View style={styles.menuIcon}>
                  <WalletIcon />
                </View>
                <Text style={styles.menuLabel}>Wallet</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              {/* Chats */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuItemPress(onNavigateToChats)}
              >
                <View style={styles.menuIcon}>
                  <ChatIcon />
                </View>
                <Text style={styles.menuLabel}>Chats</Text>
                {unreadCount > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuItemPress(onNavigateToSettings)}
              >
                <View style={styles.menuIcon}>
                  <SettingsIcon />
                </View>
                <Text style={styles.menuLabel}>Settings</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Sign Out */}
            <TouchableOpacity
              style={[styles.menuItem, styles.signoutItem]}
              onPress={onSignOut}
            >
              <View style={[styles.menuIcon, styles.signoutIcon]}>
                <SignOutIcon />
              </View>
              <Text style={[styles.menuLabel, styles.signoutLabel]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// SVG-like Icon Components
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

const iconStyles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rect: {
    borderWidth: 2,
    borderColor: colors.primaryGradientStart,
    borderRadius: 4,
    position: 'absolute',
  },
  line: {
    height: 2,
    backgroundColor: colors.primaryGradientStart,
    position: 'absolute',
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
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
  },
  overlayTouch: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
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
    position: 'absolute',
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '300',
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.white,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  menuNav: {
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.darkGray,
  },
  menuBadge: {
    backgroundColor: '#ff4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  menuBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  menuArrow: {
    fontSize: 20,
    color: colors.gray,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: colors.mediumGray,
    marginVertical: 20,
  },
  signoutItem: {
    marginTop: 'auto',
  },
  signoutIcon: {
    color: colors.red,
  },
  signoutLabel: {
    color: colors.red,
  },
});

export default SideMenu;
