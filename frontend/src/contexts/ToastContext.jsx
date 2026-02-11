import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toastMessage, setToastMessage] = useState(null);
  const [toastKey, setToastKey] = useState(0);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setToastKey((prev) => prev + 1);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastMessage && (
        <div className="toast-notification" key={toastKey}>
          {toastMessage}
        </div>
      )}
    </ToastContext.Provider>
  );
};
