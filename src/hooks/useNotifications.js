import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';

export const useNotifications = ({ onNavigate } = {}) => {
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const [expoPushToken, setExpoPushToken] = useState(null);
  const receivedListener = useRef(null);
  const responseListener = useRef(null);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => { onNavigateRef.current = onNavigate; }, [onNavigate]);

  useEffect(() => {
    NotificationService.setupHandler();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    NotificationService.registerForPush(user.id).then(setExpoPushToken);
    return NotificationService.watchTokenRefresh(user.id);
  }, [user?.id]);

  useEffect(() => {
    try {
      receivedListener.current = Notifications.addNotificationReceivedListener(
        (notification) => {
          const { title, body } = notification.request.content;
          showToast(body || title || 'New notification');
        }
      );

      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data || {};
          const nav = onNavigateRef.current;
          if (!nav) return;

          if (data.event_id) {
            nav('event', { event_id: data.event_id });
          } else if (data.type === 'message' || data.dm_conversation_id) {
            nav('chats', data);
          } else if (data.type === 'follow' || data.type === 'vibe' || data.type === 'echo') {
            nav('notifications', data);
          } else {
            nav('notifications', data);
          }
        }
      );
    } catch {
      // expo-notifications not available on web
    }

    return () => {
      try {
        receivedListener.current?.remove();
        responseListener.current?.remove();
      } catch {}
    };
  }, []);

  return { expoPushToken };
};
