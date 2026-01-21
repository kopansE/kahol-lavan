import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useStreamChat } from '../contexts/StreamChatContext';
import { supabase } from '../config/supabase';
import { colors } from '../styles/colors';

const ChatChannelListScreen = ({ navigation }) => {
  const { chatClient, isReady } = useStreamChat();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;

    loadChannels();
  }, [isReady]);

  const loadChannels = async () => {
    try {
      setLoading(true);

      // Get channels from our database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('No authentication token');
      }

      const { data, error } = await supabase.functions.invoke('get-user-channels');

      if (error || !data || !data.channels) {
        throw new Error('Failed to load channels');
      }

      // Get Stream channels with their state
      const streamChannels = await Promise.all(
        data.channels.map(async (channelData) => {
          try {
            const channel = chatClient.channel(
              channelData.stream_channel_type,
              channelData.stream_channel_id
            );
            await channel.watch();
            return {
              ...channelData,
              streamChannel: channel,
            };
          } catch (err) {
            console.error(`Failed to load channel ${channelData.stream_channel_id}:`, err);
            return null;
          }
        })
      );

      setChannels(streamChannels.filter((c) => c !== null));
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderChannel = ({ item: channelData }) => {
    const channel = channelData.streamChannel;
    const otherUser = channelData.other_user;
    const unreadCount = channel.countUnread();
    const lastMessage =
      channel.state.messages[channel.state.messages.length - 1];

    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() =>
          navigation.navigate('ChatThread', {
            channel: channel,
            channelData: channelData,
          })
        }
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(otherUser.full_name)}</Text>
        </View>
        <View style={styles.channelInfo}>
          <View style={styles.channelHeader}>
            <Text style={styles.channelName}>
              {otherUser.full_name}
              {otherUser.car_license_plate && ` • ${otherUser.car_license_plate}`}
            </Text>
            <Text style={styles.channelTime}>
              {formatTime(lastMessage?.created_at || channelData.created_at)}
            </Text>
          </View>
          <View style={styles.channelFooter}>
            <Text style={styles.channelPreview} numberOfLines={1}>
              {lastMessage?.text || 'No messages yet'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {channels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Reserve a parking spot to start chatting with other users!
          </Text>
        </View>
      ) : (
        <FlatList
          data={channels}
          renderItem={renderChannel}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: colors.primary,
  },
  backButton: {
    fontSize: 28,
    color: 'white',
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listContent: {
    padding: 10,
  },
  channelItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  channelInfo: {
    flex: 1,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  channelTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  channelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelPreview: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ChatChannelListScreen;
