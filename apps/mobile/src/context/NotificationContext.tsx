import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, ReactNode } from 'react';

import { logger } from '../utils/logger';

interface Notification {
  id: string;
  title: string;
  body: string;
  data?: any;
  createdAt: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  lastNotification: Notifications.Notification | null;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [lastNotification, setLastNotification] = React.useState<Notifications.Notification | null>(null);

  React.useEffect(() => {
    const subscription1 = Notifications.addNotificationReceivedListener((notification) => {
      setLastNotification(notification);
    });

    const subscription2 = Notifications.addNotificationResponseReceivedListener((response) => {
      logger.log('Notification response:', response);
    });

    return () => {
      subscription1.remove();
      subscription2.remove();
    };
  }, []);

  const addNotification = (notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const value = {
    notifications,
    lastNotification,
    addNotification,
    removeNotification,
    clearNotifications,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
