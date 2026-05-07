/**
 * In-app notification service — zero third-party push providers.
 * Notifications are written to Supabase and delivered via realtime subscriptions.
 * The ActivityCenter bell handles display. No Expo push tokens, no APNs, no FCM.
 */
import { supabase } from './supabase';

export const NotificationService = {
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
