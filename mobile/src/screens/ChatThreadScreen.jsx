import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../contexts/ToastContext";
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  OverlayProvider,
} from "stream-chat-expo";
import { useStreamChat } from "../contexts/StreamChatContext";
import ChatTimer from "../components/ChatTimer";
import ChatActionButtons from "../components/ChatActionButtons";
import { customChatTheme } from "../styles/chatTheme";
import {
  approveInChat,
  cancelInChat,
  extendInChat,
  cancelFutureReservation,
} from "../utils/edgeFunctions";

const ChatThreadScreen = ({ route, navigation }) => {
  const { channelType, channelId, channelData } = route.params;
  const { chatClient } = useStreamChat();
  const { showToast } = useToast();
  const otherUser = channelData.other_user;
  const [channel, setChannel] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expiresAt, setExpiresAt] = useState(channelData?.expires_at || null);
  const [approvalState, setApprovalState] = useState({
    userApproved: false,
    otherUserApproved: false,
    bothApproved: false,
  });

  const handleTimerExpire = useCallback(() => {
    showToast("הזמן פג. זמן ההזמנה הסתיים.");
  }, [showToast]);

  useEffect(() => {
    if (!chatClient || !channelId || !channelType) return;
    const streamChannel = chatClient.channel(channelType, channelId);
    streamChannel
      .watch()
      .then(() => setChannel(streamChannel))
      .catch((err) => console.error("Failed to watch channel:", err));
  }, [chatClient, channelId, channelType]);

  if (!chatClient || !channel) {
    return null;
  }

  // Safety check for session id
  if (!channelData?.id) {
    console.warn("ChatThreadScreen: No session id available in channelData");
  }

  // Check if chat session is active
  const isActive = channelData?.status === "active";
  const isFutureReservation =
    channelData?.type === "future_reservation" &&
    channelData?.status === "future_reservation";
  const chatStatus = channelData?.status || "unknown";

  const handleExtension = async () => {
    if (isProcessing) return;

    if (!channelData?.id) {
      showToast("נתוני הצ׳אט חסרים. אנא נסה שוב.");
      return;
    }

    try {
      setIsProcessing(true);
      const result = await extendInChat(channelData.id);

      // Update the expiresAt state to trigger timer recalculation
      setExpiresAt(result.new_expires_at);
      showToast("הטיימר הוארך ב-10 דקות!");
    } catch (error) {
      console.error("Error extending timer:", error);
      showToast(`הארכת הטיימר נכשלה: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (isProcessing) return;

    if (!channelData?.id) {
      showToast("נתוני הצ׳אט חסרים. אנא נסה שוב.");
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
        showToast("שני המשתמשים אישרו! מקום החניה הוחלף בהצלחה.");
        navigation.goBack();
      } else if (result.user_approved && !result.other_user_approved) {
        showToast("אושר! ממתין לאישור המשתמש השני.");
      } else if (result.already_approved) {
        showToast("כבר אושר בעבר.");
      }
    } catch (error) {
      console.error("Error approving in chat:", error);
      showToast(`האישור נכשל: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (isProcessing) return;

    if (!channelData?.id) {
      showToast("נתוני הצ׳אט חסרים. אנא נסה שוב.");
      return;
    }

    Alert.alert(
      "ביטול הזמנה",
      "האם אתה בטוח שברצונך לבטל את ההזמנה? הכספים יוחזרו.",
      [
        {
          text: "לא",
          style: "cancel",
        },
        {
          text: "כן, בטל",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessing(true);
              const result = await cancelInChat(channelData.id);
              showToast("ההזמנה בוטלה בהצלחה.");
              navigation.goBack();
            } catch (error) {
              console.error("Error cancelling in chat:", error);
              showToast(`הביטול נכשל: ${error.message}`);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelFutureReservation = () => {
    if (isProcessing) return;

    if (!channelData?.future_reservation_id) {
      showToast("נתוני ההזמנה העתידית חסרים. אנא נסה שוב.");
      return;
    }

    Alert.alert(
      "ביטול הזמנה עתידית",
      "האם אתה בטוח שברצונך לבטל את ההזמנה העתידית?",
      [
        { text: "לא", style: "cancel" },
        {
          text: "כן, בטל",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessing(true);
              const result = await cancelFutureReservation(
                channelData.future_reservation_id,
              );
              showToast("ההזמנה העתידית בוטלה בהצלחה.");
              navigation.goBack();
            } catch (error) {
              console.error("Error cancelling future reservation:", error);
              showToast(`הביטול נכשל: ${error.message}`);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {isActive && (
          <ChatTimer
            startedAt={channelData?.started_at}
            expiresAt={expiresAt}
            initialMinutes={20}
            onExpire={handleTimerExpire}
          />
        )}

        {isFutureReservation && channelData?.scheduled_for && (
          <View style={styles.futureReservationBanner}>
            <Text style={styles.futureReservationBannerText}>
              הזמנה עתידית - מופעלת{" "}
              {new Date(channelData.scheduled_for).toLocaleString("he-IL")}
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {otherUser?.full_name || "משתמש"}
            </Text>
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

        <View style={styles.streamChatWrapper}>
          <OverlayProvider>
            <Chat client={chatClient} style={customChatTheme}>
              <Channel channel={channel} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : undefined}>
                <View style={styles.chatContainer}>
                <View style={styles.messageListWrapper}>
                  <MessageList />
                </View>
                {isActive || isFutureReservation ? (
                  <MessageInput />
                ) : (
                  <View style={styles.inactiveMessageBar}>
                    <Text style={styles.inactiveMessageText}>
                      הצ׳אט {chatStatus}. לא ניתן לשלוח הודעות חדשות.
                    </Text>
                    <TouchableOpacity
                      style={styles.reportUserButton}
                      onPress={() =>
                        navigation.navigate("Report", {
                          reportedUserId: otherUser?.id,
                          reportedUserName: otherUser?.full_name,
                          transferRequestId: channelData?.transfer_request_id,
                        })
                      }
                    >
                      <Text style={styles.reportUserButtonText}>
                        דווח על משתמש
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {isActive && (
                  <ChatActionButtons
                    onApprove={handleApprove}
                    onCancel={handleCancel}
                    onExtension={handleExtension}
                    isProcessing={isProcessing}
                    approvalState={approvalState}
                  />
                )}
                {isFutureReservation && (
                  <View style={styles.futureReservationActions}>
                    <TouchableOpacity
                      style={styles.cancelFutureButton}
                      onPress={handleCancelFutureReservation}
                      disabled={isProcessing}
                    >
                      <Text style={styles.cancelFutureButtonText}>
                        {isProcessing ? "מבטל..." : "בטל הזמנה עתידית"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              </Channel>
            </Chat>
          </OverlayProvider>
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  streamChatWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    fontSize: 28,
    color: "#333",
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  userDetails: {
    fontSize: 12,
    color: "#666",
  },
  chatContainer: {
    flex: 1,
  },
  messageListWrapper: {
    flex: 1,
  },
  inactiveMessageBar: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "center",
    gap: 12,
  },
  inactiveMessageText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  },
  reportUserButton: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  reportUserButtonText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "500",
  },
  futureReservationBanner: {
    backgroundColor: "#34A853",
    padding: 10,
    alignItems: "center",
  },
  futureReservationBannerText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  futureReservationActions: {
    padding: 12,
    paddingHorizontal: 16,
  },
  cancelFutureButton: {
    borderWidth: 2,
    borderColor: "#dc3545",
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelFutureButtonText: {
    color: "#dc3545",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ChatThreadScreen;
