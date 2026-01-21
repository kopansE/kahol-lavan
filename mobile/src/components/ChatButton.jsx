import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useStreamChat } from '../contexts/StreamChatContext';
import { colors } from '../styles/colors';

const ChatButton = ({ onPress }) => {
  const { chatClient, isReady } = useStreamChat();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!chatClient || !isReady) return;

    // Listen for unread count changes
    const updateUnreadCount = () => {
      const count = chatClient.user?.total_unread_count || 0;
      setUnreadCount(count);
    };

    updateUnreadCount();

    // Listen for new messages
    chatClient.on('message.new', updateUnreadCount);
    chatClient.on('notification.mark_read', updateUnreadCount);

    return () => {
      chatClient.off('message.new', updateUnreadCount);
      chatClient.off('notification.mark_read', updateUnreadCount);
    };
  }, [chatClient, isReady]);

  if (!isReady) {
    return null; // Don't show button until chat is ready
  }

  return (
    <TouchableOpacity style={styles.chatButton} onPress={onPress}>
      <Text style={styles.chatButtonText}>💬</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chatButton: {
    position: 'absolute',
    top: 20,
    right: 80,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 999,
  },
  chatButtonText: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ChatButton;
