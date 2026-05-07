import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';

export const useNotifications = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [expoPushToken, setExpoPushToken] = useState(null);
  const receivedListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    NotificationService.setupHandler();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    NotificationService.registerForPush(user.id).then(setExpoPushToken);
  }, [user?.id]);

  useEffect(() => {
    receivedListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body } = notification.request.content;
        showToast(body || title || 'New notification');
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);
      }
    );

    return () => {
      receivedListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken };
};
