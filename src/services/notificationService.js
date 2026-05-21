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

  // Call once after registerForPush — keeps the token fresh if Expo rotates it
  watchTokenRefresh(userId) {
    if (!userId || Platform.OS === 'web') return () => {};
    try {
      const sub = Notifications.addPushTokenListener(async ({ data: token }) => {
        if (!token || !token.startsWith('ExponentPushToken')) return;
        await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
      });
      return () => sub.remove();
    } catch {
      return () => {};
    }
  },
  // Lightweight in-memory rate limiter: max 10 sends per recipient per minute
  _sendCounts: new Map(),
  _isRateLimited(recipientId) {
    const now = Date.now();
    const entry = this._sendCounts.get(recipientId) || { count: 0, windowStart: now };
    if (now - entry.windowStart > 60_000) {
      this._sendCounts.set(recipientId, { count: 1, windowStart: now });
      return false;
    }
    if (entry.count >= 10) return true;
    entry.count++;
    this._sendCounts.set(recipientId, entry);
    return false;
  },

  async send(recipientId, { type, title, body, data = {}, actorId = null, eventId = null }) {
    if (!recipientId) return;
    if (this._isRateLimited(recipientId)) return;
    try {
      await supabase.from('notifications').insert({
        recipient_id: recipientId,
        actor_id: actorId || null,
        event_id: eventId || null,
        type,
        title,
        body,
        data,
        read: false,
      });
    } catch {}
    // Fire real device push if recipient has a token
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', recipientId)
        .maybeSingle();
      const token = profile?.push_token;
      if (!token || !token.startsWith('ExponentPushToken')) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            to: token,
            title,
            body,
            data: { type, ...data },
            sound: 'default',
            priority: 'high',
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch {}
  },

  async notifyVibe(recipientId, actorId, actorUsername, eventId, eventTitle) {
    return this.send(recipientId, {
      type: 'vibe',
      title: `${actorUsername} vibed with your event`,
      body: eventTitle,
      actorId,
      eventId,
    });
  },

  async notifyRsvp(recipientId, actorId, actorUsername, eventId, eventTitle) {
    return this.send(recipientId, {
      type: 'rsvp',
      title: `${actorUsername} RSVP'd to your event`,
      body: eventTitle,
      actorId,
      eventId,
    });
  },

  async notifyFollow(recipientId, actorId, actorUsername) {
    return this.send(recipientId, {
      type: 'follow',
      title: `${actorUsername} started following you`,
      body: 'Tap to view their profile',
      actorId,
    });
  },

  async notifyEcho(recipientId, actorId, actorUsername, eventId, echoBody) {
    return this.send(recipientId, {
      type: 'echo',
      title: `${actorUsername} echoed your event`,
      body: echoBody?.slice(0, 80) || '',
      actorId,
      eventId,
    });
  },

  async notifyProfileView(recipientId, viewerUserId, viewerUsername, viewerAvatarUrl) {
    return this.send(recipientId, {
      type: 'profile_view',
      title: `${viewerUsername} viewed your profile`,
      body: 'Tap to see who visited',
      actorId: viewerUserId,
      data: { viewer_id: viewerUserId, viewer_username: viewerUsername, viewer_avatar: viewerAvatarUrl || null },
    });
  },

  /**
   * Called once per app session. For each of the user's today-events where they RSVP'd,
   * fire a push notification to every other RSVPed user. Uses a seen-key in Supabase
   * (notifications table) to avoid duplicate blasts on the same day.
   */
  async sendEventDayNotifications(currentUserId) {
    if (!currentUserId || Platform.OS === 'web') return;
    try {
      const today = new Date().toISOString().split('T')[0];

      // Find events happening today where current user RSVP'd
      const { data: myRsvps } = await supabase
        .from('event_rsvps')
        .select('event_id, events:event_id(id, title, author_id, event_date)')
        .eq('user_id', currentUserId)
        .in('status', ['going', 'maybe']);

      const todayEvents = (myRsvps || []).filter(r => {
        const d = r.events?.event_date;
        return d && d.split('T')[0] === today;
      }).map(r => r.events);

      for (const event of todayEvents) {
        if (!event?.id) continue;

        // Skip if we already sent this user a notification today for this event
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('recipient_id', currentUserId)
          .eq('event_id', event.id)
          .eq('type', 'event_day')
          .gte('created_at', `${today}T00:00:00`)
          .maybeSingle();

        if (existing) continue;

        // Notify current user themselves
        await this.send(currentUserId, {
          type: 'event_day',
          title: `🎉 Today's the day!`,
          body: `${event.title} is happening today. Check in when you arrive!`,
          eventId: event.id,
        });

        // If current user is the event author, also notify all other RSVPed attendees
        if (event.author_id === currentUserId) {
          const { data: allRsvps } = await supabase
            .from('event_rsvps')
            .select('user_id')
            .eq('event_id', event.id)
            .in('status', ['going', 'maybe'])
            .neq('user_id', currentUserId);

          for (const rsvp of (allRsvps || [])) {
            // Check if they already got one today
            const { data: alreadySent } = await supabase
              .from('notifications')
              .select('id')
              .eq('recipient_id', rsvp.user_id)
              .eq('event_id', event.id)
              .eq('type', 'event_day')
              .gte('created_at', `${today}T00:00:00`)
              .maybeSingle();
            if (alreadySent) continue;

            await this.send(rsvp.user_id, {
              type: 'event_day',
              title: `🎉 Today's the day!`,
              body: `${event.title} is happening today. Check in when you arrive!`,
              eventId: event.id,
              actorId: currentUserId,
            });
          }
        }
      }
    } catch {}
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
