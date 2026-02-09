import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./ScheduleLeavePage.css";

const ScheduleLeavePage = ({ user, userOwnPin, onBack, onClose, onScheduleSuccess }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(new Date().getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(Math.ceil(new Date().getMinutes() / 5) * 5 % 60);
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().getHours() >= 12 ? "PM" : "AM");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState(null);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [futureReservation, setFutureReservation] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const periodRef = useRef(null);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  const periods = ["AM", "PM"];

  const ITEM_HEIGHT = 48;

  // Load existing pending schedule
  useEffect(() => {
    if (user && userOwnPin) {
      loadPendingSchedule();
    } else {
      setLoadingSchedule(false);
    }
  }, [user, userOwnPin]);

  const loadPendingSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from("scheduled_leaves")
        .select("id, scheduled_for, status")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading pending schedule:", error);
      } else if (data) {
        setPendingSchedule(data);

        // Check if someone has made a future reservation for this schedule
        try {
          const { data: frData, error: frError } = await supabase
            .from("future_reservations")
            .select("id, reserver_id, status")
            .eq("scheduled_leave_id", data.id)
            .eq("status", "pending")
            .maybeSingle();

          if (!frError && frData) {
            // Fetch the reserver's name
            const { data: userData } = await supabase
              .from("users")
              .select("first_name, last_name")
              .eq("id", frData.reserver_id)
              .single();

            setFutureReservation({
              ...frData,
              reserver_name: userData ? `${userData.first_name} ${userData.last_name}` : "A user",
            });
          }
        } catch (frErr) {
          console.error("Error loading future reservation:", frErr);
        }
      }
    } catch (err) {
      console.error("Error loading pending schedule:", err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Initialize scroll positions
  useEffect(() => {
    if (hourRef.current) {
      const hourIndex = hours.indexOf(selectedHour);
      hourRef.current.scrollTop = hourIndex * ITEM_HEIGHT;
    }
    if (minuteRef.current) {
      const minuteIndex = minutes.indexOf(selectedMinute);
      minuteRef.current.scrollTop = minuteIndex * ITEM_HEIGHT;
    }
    if (periodRef.current) {
      const periodIndex = periods.indexOf(selectedPeriod);
      periodRef.current.scrollTop = periodIndex * ITEM_HEIGHT;
    }
  }, []);

  const handleScroll = (ref, items, setter) => {
    if (!ref.current) return;
    const scrollTop = ref.current.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    setter(items[clampedIndex]);
  };

  const handleScrollEnd = (ref, items, currentValue) => {
    if (!ref.current) return;
    const index = items.indexOf(currentValue);
    ref.current.scrollTo({
      top: index * ITEM_HEIGHT,
      behavior: "smooth"
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const setToday = () => {
    setSelectedDate(new Date());
  };

  const setTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
  };

  const formatDate = (date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  };

  const formatScheduledTime = (isoString) => {
    const date = new Date(isoString);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${timeStr} on ${formatDate(date)}`;
  };

  const getScheduledDateTime = () => {
    const date = new Date(selectedDate);
    let hour24 = selectedHour;
    if (selectedPeriod === "PM" && selectedHour !== 12) {
      hour24 = selectedHour + 12;
    } else if (selectedPeriod === "AM" && selectedHour === 12) {
      hour24 = 0;
    }
    date.setHours(hour24, selectedMinute, 0, 0);
    return date;
  };

  const isValidScheduleTime = () => {
    const scheduledTime = getScheduledDateTime();
    const now = new Date();
    const diffMs = scheduledTime.getTime() - now.getTime();
    return diffMs >= 60000; // At least 1 minute in the future
  };

  const handleSchedule = async () => {
    if (!userOwnPin || (userOwnPin.status !== "waiting" && userOwnPin.status !== "published")) {
      setError("You don't have a parking spot to schedule. Please mark your parking location first.");
      return;
    }

    const scheduledTime = getScheduledDateTime();
    const now = new Date();

    if (scheduledTime <= now) {
      setError("Please select a time in the future.");
      return;
    }

    setIsScheduling(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setError("Authentication error. Please log in again.");
        setIsScheduling(false);
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schedule-leave`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scheduled_for: scheduledTime.toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to schedule leave");
      }

      // Success - show toast and close sidebar
      const successMessage = `Scheduled! Your parking will be visible at ${scheduledTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} on ${formatDate(scheduledTime)}.`;
      
      if (onScheduleSuccess) {
        onScheduleSuccess(successMessage);
      }
      onClose();
    } catch (err) {
      console.error("Error scheduling leave:", err);
      setError(err.message || "Failed to schedule. Please try again.");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!pendingSchedule) return;

    setIsCancelling(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setError("Authentication error. Please log in again.");
        setIsCancelling(false);
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-scheduled-leave`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schedule_id: pendingSchedule.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to cancel scheduled leave");
      }

      // Success - clear pending schedule and show toast
      setPendingSchedule(null);
      
      if (onScheduleSuccess) {
        onScheduleSuccess("Scheduled leave cancelled successfully.");
      }
      onClose();
    } catch (err) {
      console.error("Error cancelling scheduled leave:", err);
      setError(err.message || "Failed to cancel. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const hasWaitingPin = userOwnPin && (userOwnPin.status === "waiting" || userOwnPin.status === "published");

  if (loadingSchedule) {
    return (
      <div className="schedule-leave-page">
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ‹
          </button>
          <h2 className="page-title">Schedule Leave</h2>
          <button className="page-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="page-content">
          <div className="loading-state">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-leave-page">
      <div className="page-header">
        <button className="back-button" onClick={onBack}>
          ‹
        </button>
        <h2 className="page-title">Schedule Leave</h2>
        <button className="page-close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="page-content">
        {!hasWaitingPin ? (
          <div className="no-pin-message">
            <div className="no-pin-icon">📍</div>
            <h3>No Parking Location</h3>
            <p>You need to mark your parking location first before scheduling when to leave.</p>
            <button className="close-btn" onClick={onClose}>
              Go to Map
            </button>
          </div>
        ) : pendingSchedule ? (
          <div className="existing-schedule">
            <div className="existing-schedule-icon">⏰</div>
            <h3>You have a scheduled leave</h3>
            <p className="scheduled-time">
              Your parking will become available at<br />
              <strong>{formatScheduledTime(pendingSchedule.scheduled_for)}</strong>
            </p>

            {futureReservation && (
              <div className="reservation-notification">
                <div className="reservation-notification-icon">📋</div>
                <div className="reservation-notification-text">
                  <strong>{futureReservation.reserver_name}</strong> has reserved your future spot.
                  They will be matched with you when the scheduled time arrives.
                </div>
              </div>
            )}
            
            {error && <div className="error-message">{error}</div>}
            
            <button
              className="cancel-schedule-btn"
              onClick={handleCancelSchedule}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Scheduled Leave"}
            </button>
            
            <p className="cancel-hint">
              You can cancel this and schedule a new time.
              {futureReservation && " This will also cancel the reservation."}
            </p>
          </div>
        ) : (
          <>
            <h3 className="schedule-header">When do you want to leave your parking?</h3>

            {/* Date Selection */}
            <div className="date-selection">
              <button
                className={`date-btn ${isToday(selectedDate) ? "active" : ""}`}
                onClick={setToday}
              >
                Today
              </button>
              <button
                className={`date-btn ${isTomorrow(selectedDate) ? "active" : ""}`}
                onClick={setTomorrow}
              >
                Tomorrow
              </button>
              <input
                type="date"
                className="date-picker"
                value={selectedDate.toISOString().split("T")[0]}
                min={new Date().toISOString().split("T")[0]}
                max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
              />
            </div>

            <div className="selected-date-label">
              {formatDate(selectedDate)}
            </div>

            {/* Time Wheel Picker */}
            <div className="time-picker-container">
              <div className="time-picker-highlight" />
              
              {/* Hours */}
              <div
                ref={hourRef}
                className="wheel-column"
                onScroll={() => handleScroll(hourRef, hours, setSelectedHour)}
                onTouchEnd={() => handleScrollEnd(hourRef, hours, selectedHour)}
                onMouseUp={() => handleScrollEnd(hourRef, hours, selectedHour)}
              >
                <div className="wheel-padding" />
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className={`wheel-item ${selectedHour === hour ? "selected" : ""}`}
                  >
                    {hour}
                  </div>
                ))}
                <div className="wheel-padding" />
              </div>

              <div className="wheel-separator">:</div>

              {/* Minutes */}
              <div
                ref={minuteRef}
                className="wheel-column"
                onScroll={() => handleScroll(minuteRef, minutes, setSelectedMinute)}
                onTouchEnd={() => handleScrollEnd(minuteRef, minutes, selectedMinute)}
                onMouseUp={() => handleScrollEnd(minuteRef, minutes, selectedMinute)}
              >
                <div className="wheel-padding" />
                {minutes.map((minute) => (
                  <div
                    key={minute}
                    className={`wheel-item ${selectedMinute === minute ? "selected" : ""}`}
                  >
                    {minute.toString().padStart(2, "0")}
                  </div>
                ))}
                <div className="wheel-padding" />
              </div>

              {/* AM/PM */}
              <div
                ref={periodRef}
                className="wheel-column period-column"
                onScroll={() => handleScroll(periodRef, periods, setSelectedPeriod)}
                onTouchEnd={() => handleScrollEnd(periodRef, periods, selectedPeriod)}
                onMouseUp={() => handleScrollEnd(periodRef, periods, selectedPeriod)}
              >
                <div className="wheel-padding" />
                {periods.map((period) => (
                  <div
                    key={period}
                    className={`wheel-item ${selectedPeriod === period ? "selected" : ""}`}
                  >
                    {period}
                  </div>
                ))}
                <div className="wheel-padding" />
              </div>
            </div>

            {/* Preview */}
            <div className="schedule-preview">
              Your parking will become visible at{" "}
              <strong>
                {selectedHour}:{selectedMinute.toString().padStart(2, "0")} {selectedPeriod}
              </strong>{" "}
              on <strong>{formatDate(selectedDate)}</strong>
            </div>

            {/* Messages */}
            {error && <div className="error-message">{error}</div>}

            {/* Schedule Button */}
            <button
              className="schedule-btn"
              onClick={handleSchedule}
              disabled={isScheduling || !isValidScheduleTime()}
            >
              {isScheduling ? "Scheduling..." : "Schedule Leave"}
            </button>

            {!isValidScheduleTime() && (
              <p className="validation-hint">
                Please select a time at least 1 minute in the future.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduleLeavePage;
