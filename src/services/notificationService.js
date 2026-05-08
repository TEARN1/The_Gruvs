/**
 * In-app notification service — zero third-party push providers.
 * Notifications are written to Supabase and delivered via realtime subscriptions.
 * The ActivityCenter bell handles display. No Expo push tokens, no APNs, no FCM.
 */
import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const NotificationService = {

  // Called once on app mount — configures how notifications display when app is foregrounded
  setupHandler() {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {
      // expo-notifications not available on web — safe to ignore
    }
  },

  // Registers device for push and stores token in profiles table
  async registerForPush(userId) {
    if (!userId || Platform.OS === 'web') return null;
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return null;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);
      return token;
    } catch {
      return null;
    }
  },
  async send(recipientId, { type, title, body, data = {} }) {
    if (!recipientId) return;
    try {
      await supabase.from('notifications').insert({
        recipient_id: recipientId,
        type,
        title,
        body,
        data,
        read: false,
      });
    } catch {}
  },

  async notifyVibe(recipientId, actorUsername, eventTitle) {
    return this.send(recipientId, {
      type: 'vibe',
      title: `${actorUsername} vibed with your event`,
      body: eventTitle,
    });
  },

  async notifyRsvp(recipientId, actorUsername, eventTitle) {
    return this.send(recipientId, {
      type: 'rsvp',
      title: `${actorUsername} RSVP'd to your event`,
      body: eventTitle,
    });
  },

  async notifyFollow(recipientId, actorUsername) {
    return this.send(recipientId, {
      type: 'follow',
      title: `${actorUsername} started following you`,
      body: 'Tap to view their profile',
    });
  },

  async notifyEcho(recipientId, actorUsername, echoBody) {
    return this.send(recipientId, {
      type: 'echo',
      title: `${actorUsername} echoed your event`,
      body: echoBody?.slice(0, 80) || '',
    });
  },

  async notifyProfileView(recipientId, viewerUsername, viewerAvatarUrl, viewerUserId) {
    return this.send(recipientId, {
      type: 'profile_view',
      title: `${viewerUsername} viewed your profile`,
      body: 'Tap to see who visited',
      data: { viewer_id: viewerUserId, viewer_username: viewerUsername, viewer_avatar: viewerAvatarUrl || null },
    });
  },

  async markAllRead(userId) {
    if (!userId) return;
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', userId)
        .eq('read', false);
    } catch {}
  },

  async getUnreadCount(userId) {
    if (!userId) return 0;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false);
      return count || 0;
    } catch {
      return 0;
    }
  },
};
