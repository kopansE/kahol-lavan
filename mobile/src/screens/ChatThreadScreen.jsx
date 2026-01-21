import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Chat, Channel, MessageList, MessageInput, OverlayProvider } from 'stream-chat-expo';
import { useStreamChat } from '../contexts/StreamChatContext';
import ChatTimer from '../components/ChatTimer';
import ChatActionButtons from '../components/ChatActionButtons';
import { customChatTheme } from '../styles/chatTheme';

const ChatThreadScreen = ({ route, navigation }) => {
  const { channel, channelData } = route.params;
  const { chatClient } = useStreamChat();
  const otherUser = channelData.other_user;

  if (!chatClient || !channel) {
    return null;
  }

  const handleTimerExpire = () => {
    Alert.alert('Time Expired', 'The reservation time has expired.');
  };

  return (
    <View style={styles.container}>
      <ChatTimer initialMinutes={20} onExpire={handleTimerExpire} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{otherUser?.full_name || 'User'}</Text>
          {otherUser && (
            <Text style={styles.userDetails}>
              {otherUser.car_make && otherUser.car_model && (
                <>
                  {otherUser.car_make} {otherUser.car_model}
                  {otherUser.car_color && ` • ${otherUser.car_color}`}
                  {otherUser.car_license_plate &&
                    ` • ${otherUser.car_license_plate}`}
                </>
              )}
            </Text>
          )}
        </View>
      </View>

      <OverlayProvider>
        <Chat client={chatClient} style={customChatTheme}>
          <Channel channel={channel}>
            <View style={styles.chatContainer}>
              <MessageList />
              <MessageInput />
            </View>
          </Channel>
        </Chat>
      </OverlayProvider>

      <ChatActionButtons />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 28,
    color: '#333',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userDetails: {
    fontSize: 12,
    color: '#666',
  },
  chatContainer: {
    flex: 1,
  },
});

export default ChatThreadScreen;
