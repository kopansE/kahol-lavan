import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Chat, Channel, MessageList, MessageInput, OverlayProvider } from 'stream-chat-expo';
import { useStreamChat } from '../contexts/StreamChatContext';
import ChatTimer from '../components/ChatTimer';
import ChatActionButtons from '../components/ChatActionButtons';
import { customChatTheme } from '../styles/chatTheme';
import { approveInChat, cancelInChat, extendInChat } from '../utils/edgeFunctions';

const ChatThreadScreen = ({ route, navigation }) => {
  const { channel, channelData } = route.params;
  const { chatClient } = useStreamChat();
  const otherUser = channelData.other_user;
  const [isProcessing, setIsProcessing] = useState(false);
  const [expiresAt, setExpiresAt] = useState(channelData?.expires_at || null);
  const [approvalState, setApprovalState] = useState({
    userApproved: false,
    otherUserApproved: false,
    bothApproved: false,
  });

  if (!chatClient || !channel) {
    return null;
  }

  // Safety check for session id
  if (!channelData?.id) {
    console.warn('ChatThreadScreen: No session id available in channelData');
  }

  // Check if chat session is active
  const isActive = channelData?.status === 'active';
  const chatStatus = channelData?.status || 'unknown';

  const handleTimerExpire = () => {
    Alert.alert('Time Expired', 'The reservation time has expired.');
  };

  const handleExtension = async () => {
    if (isProcessing) return;

    if (!channelData?.id) {
      Alert.alert('Error', 'Chat session data is missing. Please try again.');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await extendInChat(channelData.id);

      // Update the expiresAt state to trigger timer recalculation
      setExpiresAt(result.new_expires_at);
      Alert.alert('Extended', result.message || 'Timer extended by 10 minutes!');
    } catch (error) {
      console.error('Error extending timer:', error);
      Alert.alert('Error', `Failed to extend timer: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (isProcessing) return;

    if (!channelData?.id) {
      Alert.alert('Error', 'Chat session data is missing. Please try again.');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await approveInChat(channelData.id);
      
      setApprovalState({
        userApproved: result.user_approved,
        otherUserApproved: result.other_user_approved,
        bothApproved: result.both_approved,
      });

      if (result.both_approved && result.reservation_completed) {
        Alert.alert(
          'Success!',
          'Both users approved! The parking spot has been exchanged.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else if (result.user_approved && !result.other_user_approved) {
        Alert.alert(
          'Approved',
          'Your approval recorded. Waiting for the other user to approve.'
        );
      } else if (result.already_approved) {
        Alert.alert('Already Approved', result.message);
      }
    } catch (error) {
      console.error('Error approving in chat:', error);
      Alert.alert('Error', `Failed to approve: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (isProcessing) return;

    if (!channelData?.id) {
      Alert.alert('Error', 'Chat session data is missing. Please try again.');
      return;
    }

    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel this reservation? The funds will be refunded.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              const result = await cancelInChat(channelData.id);

              Alert.alert(
                'Cancelled',
                result.message || 'Reservation cancelled successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error cancelling in chat:', error);
              Alert.alert('Error', `Failed to cancel: ${error.message}`);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ChatTimer startedAt={channelData?.started_at} expiresAt={expiresAt} initialMinutes={20} onExpire={handleTimerExpire} />

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
              {isActive ? (
                <MessageInput />
              ) : (
                <View style={styles.inactiveMessageBar}>
                  <Text style={styles.inactiveMessageText}>
                    Chat session is {chatStatus}. No new messages can be sent.
                  </Text>
                </View>
              )}
            </View>
          </Channel>
        </Chat>
      </OverlayProvider>

      {isActive && (
        <ChatActionButtons
          onApprove={handleApprove}
          onCancel={handleCancel}
          onExtension={handleExtension}
          isProcessing={isProcessing}
          approvalState={approvalState}
        />
      )}
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
  inactiveMessageBar: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  inactiveMessageText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ChatThreadScreen;
