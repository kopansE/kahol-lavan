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

      // Get channels from our database with automatic token refresh
      // First ensure session is valid, then refresh if needed
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        // Token might be expired, try to refresh
        console.log('Token validation failed, refreshing session...');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Session expired. Please log in again.');
        }
      }

      const { data, error } = await supabase.functions.invoke('get-user-channels');

      if (error || !data || !data.channels) {
        console.error('Failed to load channels, retrying in 2 seconds...');
        setTimeout(() => {
          loadChannels();
        }, 2000);
        throw new Error(error?.message || 'Failed to load channels');
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
            console.error('Retrying to load channels in 2 seconds...');
            setTimeout(() => {
              loadChannels();
            }, 2000);
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

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

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

  // Separate channels into active, future reservations, and history
  const activeChannels = channels.filter((c) => c.status === 'active');
  const futureReservationChannels = channels.filter(
    (c) => c.type === 'future_reservation' && c.status === 'future_reservation'
  );
  const historyChannels = channels.filter(
    (c) => c.status !== 'active' && !(c.type === 'future_reservation' && c.status === 'future_reservation')
  );

  // Build sections
  const sections = [
    { title: 'Active', data: activeChannels, isEmpty: activeChannels.length === 0 },
  ];

  if (futureReservationChannels.length > 0) {
    sections.push({
      title: 'Future Reservations',
      data: futureReservationChannels,
      isEmpty: false,
      headerColor: '#34A853',
    });
  }

  sections.push({
    title: 'History',
    data: historyChannels,
    isEmpty: historyChannels.length === 0,
  });

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
          data={sections.flatMap((section) => [
            { isHeader: true, title: section.title, headerColor: section.headerColor },
            ...(section.isEmpty
              ? [{ isEmpty: true, sectionTitle: section.title }]
              : section.data),
          ])}
          renderItem={({ item }) =>
            item.isHeader ? (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionHeaderText, item.headerColor && { color: item.headerColor }]}>{item.title}</Text>
              </View>
            ) : item.isEmpty ? (
              <View style={styles.sectionEmpty}>
                <Text style={styles.sectionEmptyText}>
                  {item.sectionTitle === 'Active' ? 'No active chats' : 'No chat history'}
                </Text>
              </View>
            ) : (
              renderChannel({ item })
            )
          }
          keyExtractor={(item, index) =>
            item.isHeader
              ? `header-${item.title}`
              : item.isEmpty
              ? `empty-${item.sectionTitle}`
              : item.id
          }
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
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 5,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionEmpty: {
    paddingVertical: 20,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  sectionEmptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
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
