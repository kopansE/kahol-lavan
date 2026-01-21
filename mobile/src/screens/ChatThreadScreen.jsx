import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Chat, Channel, MessageList, MessageInput } from 'stream-chat-expo';
import { useStreamChat } from '../contexts/StreamChatContext';
import { colors } from '../styles/colors';

const ChatThreadScreen = ({ route, navigation }) => {
  const { channel, channelData } = route.params;
  const { chatClient } = useStreamChat();
  const otherUser = channelData.other_user;

  if (!chatClient || !channel) {
    return null;
  }

  return (
    <View style={styles.container}>
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

      <Chat client={chatClient}>
        <Channel channel={channel}>
          <View style={styles.chatContainer}>
            <MessageList />
            <MessageInput />
          </View>
        </Channel>
      </Chat>
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
    padding: 15,
    backgroundColor: colors.primary,
  },
  backButton: {
    fontSize: 28,
    color: 'white',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  userDetails: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  chatContainer: {
    flex: 1,
  },
});

export default ChatThreadScreen;
