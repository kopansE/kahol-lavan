import React, { useState } from "react";
import {
  Chat,
  Channel,
  Window,
  MessageList,
  MessageInput,
} from "stream-chat-react";
import { useStreamChat } from "../contexts/StreamChatContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../supabaseClient";
import ChatTimer from "./ChatTimer";
import ChatActionButtons from "./ChatActionButtons";
import ReportPage from "./ReportPage";
import "stream-chat-react/dist/css/v2/index.css";
import "./ChatThread.css";

const ChatThread = ({
  channel,
  otherUser,
  channelData,
  onClose,
  onBack,
  inSideMenu = false,
}) => {
  const { chatClient } = useStreamChat();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [expiresAt, setExpiresAt] = useState(channelData?.expires_at || null);
  const [showReportPage, setShowReportPage] = useState(false);
  const [approvalState, setApprovalState] = useState({
    userApproved: false,
    otherUserApproved: false,
    bothApproved: false,
  });

  if (!chatClient || !channel) {
    return null;
  }

  if (!channelData?.id) {
    console.warn("ChatThread: No session id available in channelData");
  }

  // Check if chat session is active
  const isActive = channelData?.status === "active";
  const isFutureReservation =
    channelData?.type === "future_reservation" &&
    channelData?.status === "future_reservation";
  const chatStatus = channelData?.status || "unknown";

  const handleTimerExpire = () => {};

  const handleReportUser = () => {
    setShowReportPage(true);
  };

  const handleReportBack = () => {
    setShowReportPage(false);
  };

  const handleReportClose = () => {
    setShowReportPage(false);
  };

  const handleExtension = async () => {
    if (isProcessing) return;

    if (!channelData?.id) {
      showToast("נתוני הצ׳אט חסרים. אנא נסה שוב.");
      return;
    }

    try {
      setIsProcessing(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showToast("שגיאת אימות. אנא התחבר מחדש.");
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extend-in-chat`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: channelData.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to extend timer");
      }

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

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showToast("שגיאת אימות. אנא התחבר מחדש.");
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/approve-in-chat`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: channelData.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to approve");
      }

      setApprovalState({
        userApproved: result.user_approved,
        otherUserApproved: result.other_user_approved,
        bothApproved: result.both_approved,
      });

      if (result.both_approved && result.reservation_completed) {
        showToast("שני המשתמשים אישרו! מקום החניה הוחלף בהצלחה.");
        if (onClose) onClose();
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

    if (!confirm("האם אתה בטוח שברצונך לבטל את ההזמנה? הכספים יוחזרו.")) {
      return;
    }

    try {
      setIsProcessing(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showToast("שגיאת אימות. אנא התחבר מחדש.");
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-in-chat`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: channelData.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to cancel");
      }

      showToast("ההזמנה בוטלה בהצלחה.");
      if (onClose) onClose();
    } catch (error) {
      console.error("Error cancelling in chat:", error);
      showToast(`הביטול נכשל: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelFutureReservation = async () => {
    if (isProcessing) return;

    if (!channelData?.future_reservation_id) {
      showToast("נתוני ההזמנה העתידית חסרים. אנא נסה שוב.");
      return;
    }

    if (!confirm("האם אתה בטוח שברצונך לבטל את ההזמנה העתידית?")) {
      return;
    }

    try {
      setIsProcessing(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        showToast("שגיאת אימות. אנא התחבר מחדש.");
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-future-reservation`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          future_reservation_id: channelData.future_reservation_id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to cancel future reservation");
      }

      showToast("ההזמנה העתידית בוטלה בהצלחה.");
      if (onClose) onClose();
    } catch (error) {
      console.error("Error cancelling future reservation:", error);
      showToast(`הביטול נכשל: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render inside side menu (no overlay, fill container)
  if (inSideMenu) {
    // Show report page if requested
    if (showReportPage) {
      return (
        <div className="chat-thread-side-menu">
          <ReportPage
            onBack={handleReportBack}
            onClose={handleReportClose}
            reportedUserId={otherUser?.id}
            reportedUserName={otherUser?.full_name}
            transferRequestId={channelData?.transfer_request_id}
          />
        </div>
      );
    }

    return (
      <div className="chat-thread-side-menu">
        {!isFutureReservation && (
          <ChatTimer
            startedAt={channelData?.started_at}
            expiresAt={expiresAt}
            initialMinutes={20}
            onExpire={handleTimerExpire}
          />
        )}

        {isFutureReservation && channelData?.scheduled_for && (
          <div
            className="chat-future-reservation-banner"
            style={{
              background: "#34A853",
              color: "white",
              padding: "8px 16px",
              textAlign: "center",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            הזמנה עתידית - מופעלת{" "}
            {new Date(channelData.scheduled_for).toLocaleString("he-IL")}
          </div>
        )}

        <div className="chat-thread-header-side-menu">
          <button
            type="button"
            className="chat-thread-back-button-side-menu"
            onClick={onBack}
          >
            ←
          </button>
          <div className="chat-thread-user-info">
            <h3 className="chat-thread-user-name">
              {otherUser?.full_name || "משתמש"}
            </h3>
            {otherUser && (
              <div className="chat-thread-user-details">
                {otherUser.car_make && otherUser.car_model && (
                  <>
                    {otherUser.car_make} {otherUser.car_model}
                    {otherUser.car_color && ` • ${otherUser.car_color}`}
                    {otherUser.car_license_plate &&
                      ` • ${otherUser.car_license_plate}`}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <Chat client={chatClient} theme="str-chat__theme-light">
          <Channel channel={channel}>
            <Window>
              <MessageList />
              {isActive || isFutureReservation ? (
                <MessageInput />
              ) : (
                <div className="chat-inactive-area">
                  <div className="chat-inactive-message">
                    הצ׳אט {chatStatus}. לא ניתן לשלוח הודעות חדשות.
                  </div>
                  <button
                    className="report-user-button"
                    onClick={handleReportUser}
                  >
                    דווח על משתמש
                  </button>
                </div>
              )}
            </Window>
          </Channel>
        </Chat>

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
          <div style={{ padding: "12px 16px" }}>
            <button
              onClick={handleCancelFutureReservation}
              disabled={isProcessing}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "2px solid #dc3545",
                background: "white",
                color: "#dc3545",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isProcessing ? "מבטל..." : "בטל הזמנה עתידית"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show report page if requested (overlay version)
  if (showReportPage) {
    return (
      <div className="chat-thread-overlay" onClick={onClose}>
        <div
          className="chat-thread-container"
          onClick={(e) => e.stopPropagation()}
        >
          <ReportPage
            onBack={handleReportBack}
            onClose={handleReportClose}
            reportedUserId={otherUser?.id}
            reportedUserName={otherUser?.full_name}
            transferRequestId={channelData?.transfer_request_id}
          />
        </div>
      </div>
    );
  }

  // Render as overlay (original behavior)
  return (
    <div className="chat-thread-overlay" onClick={onClose}>
      <div
        className="chat-thread-container"
        onClick={(e) => e.stopPropagation()}
      >
        {!isFutureReservation && (
          <ChatTimer
            startedAt={channelData?.started_at}
            expiresAt={expiresAt}
            initialMinutes={20}
            onExpire={handleTimerExpire}
          />
        )}

        {isFutureReservation && channelData?.scheduled_for && (
          <div
            style={{
              background: "#34A853",
              color: "white",
              padding: "8px 16px",
              textAlign: "center",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            הזמנה עתידית - מופעלת{" "}
            {new Date(channelData.scheduled_for).toLocaleString("he-IL")}
          </div>
        )}

        <div className="chat-thread-header">
          <button
            type="button"
            className="chat-thread-back-button"
            onClick={onBack}
          >
            ←
          </button>
          <div className="chat-thread-user-info">
            <h3 className="chat-thread-user-name">
              {otherUser?.full_name || "משתמש"}
            </h3>
            {otherUser && (
              <div className="chat-thread-user-details">
                {otherUser.car_make && otherUser.car_model && (
                  <>
                    {otherUser.car_make} {otherUser.car_model}
                    {otherUser.car_color && ` • ${otherUser.car_color}`}
                    {otherUser.car_license_plate &&
                      ` • ${otherUser.car_license_plate}`}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <Chat client={chatClient} theme="str-chat__theme-light">
          <Channel channel={channel}>
            <Window>
              <MessageList />
              {isActive || isFutureReservation ? (
                <MessageInput />
              ) : (
                <div className="chat-inactive-area">
                  <div className="chat-inactive-message">
                    הצ׳אט {chatStatus}. לא ניתן לשלוח הודעות חדשות.
                  </div>
                  <button
                    className="report-user-button"
                    onClick={handleReportUser}
                  >
                    דווח על משתמש
                  </button>
                </div>
              )}
            </Window>
          </Channel>
        </Chat>

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
          <div style={{ padding: "12px 16px" }}>
            <button
              onClick={handleCancelFutureReservation}
              disabled={isProcessing}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "2px solid #dc3545",
                background: "white",
                color: "#dc3545",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isProcessing ? "מבטל..." : "בטל הזמנה עתידית"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatThread;
