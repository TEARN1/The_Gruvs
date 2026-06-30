import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { MessageManager } from '../services/dataFlow';
import { CheckinSync } from '../services/checkinSync';
import { supabase } from '../services/supabase';

export const useNotifications = ({ onNavigate } = {}) => {
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const [expoPushToken, setExpoPushToken] = useState(null);
  const receivedListener = useRef(null);
  const responseListener = useRef(null);
  const onNavigateRef = useRef(onNavigate);
  // Keep a ref to user so the response listener always reads the current value
  // without needing to be re-registered on every login/logout cycle.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => { onNavigateRef.current = onNavigate; }, [onNavigate]);

  useEffect(() => {
    NotificationService.setupHandler();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    NotificationService.registerForPush(user.id).then(setExpoPushToken);
    // Send event-day notifications once per session, after push is registered
    NotificationService.sendEventDayNotifications(user.id);
    // Replay any Touch Downs that were queued while offline (#248).
    CheckinSync.drain().catch(() => {});
    return NotificationService.watchTokenRefresh(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`realtime_notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const { title, body, data } = payload.new;
          showToast(body || title || 'New notification');
          // On web, also surface a real browser notification (if enabled).
          NotificationService.showBrowserNotification(title, body, data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, showToast]);

  useEffect(() => {
    // Guard: remove any stale listeners before re-registering (handles StrictMode double-mount)
    try { receivedListener.current?.remove(); } catch {}
    try { responseListener.current?.remove(); } catch {}

    try {
      receivedListener.current = Notifications.addNotificationReceivedListener(
        (notification) => {
          const { title, body } = notification.request.content;
          showToast(body || title || 'New notification');
        }
      );

      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const actionIdentifier = response.actionIdentifier;
          const userText = response.userText;
          const data = response.notification.request.content.data || {};
          const nav = onNavigateRef.current;

          if (actionIdentifier === 'reply' && userText) {
            try {
              const partnerId = data.sender_id;
              const currentUser = userRef.current;
              if (partnerId && currentUser?.id) {
                await MessageManager.send(currentUser.id, partnerId, userText);
                showToast('Reply sent! 💬', 'success');
              }
            } catch (e) {
              showToast('Could not send reply: ' + e.message, 'error');
            }
            return;
          }

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
      try { receivedListener.current?.remove(); } catch {}
      try { responseListener.current?.remove(); } catch {}
    };
  }, [showToast]);

  return { expoPushToken };
};
