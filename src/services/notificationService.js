/**
 * In-app notification service — zero third-party push providers.
 * Notifications are written to Supabase and delivered via realtime subscriptions.
 * The ActivityCenter bell handles display. No Expo push tokens, no APNs, no FCM.
 */
import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { shouldInterrupt } from '../utils/notificationPolicy';
import { logError } from '../utils/logError';
import { WEB_PUSH_PUBLIC_KEY, urlBase64ToUint8Array } from '../constants/webPush';

export const NotificationService = {

  // Called once on app mount — configures how notifications display when app is foregrounded
  setupHandler() {
    if (Platform.OS === 'web') return;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Register interactive category for notification quick replies
      Notifications.setNotificationCategoryAsync('message_reply', [
        {
          identifier: 'reply',
          buttonTitle: 'Reply',
          options: {
            opensAppToKeyboard: false,
          },
          textInput: {
            submitButtonTitle: 'Send',
            placeholder: 'Type reply...',
          },
        },
      ]);
    } catch {
      // expo-notifications not available on web — safe to ignore
    }
  },

  // ── Web push ──────────────────────────────────────────────────────────────────
  // Two layers: (1) tab-open browser notifications via the Notification API,
  // (2) REAL closed-tab push — the service worker subscribes with our VAPID key
  // and the subscription is stored in web_push_subscriptions; the push-notify
  // edge function delivers through the browser's push service, so a DM pops on
  // the phone with no Gruvs tab open. Layer 2 is best-effort: if the table /
  // secrets aren't deployed yet, layer 1 still works exactly as before.
  async registerWebPush(userId = null) {
    try {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') return null;
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
      try { window.localStorage.setItem('gruvs_web_push', '1'); } catch {}

      // Layer 2 — closed-tab push subscription (enhancement only, never blocks).
      try {
        if (userId && 'serviceWorker' in navigator && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
          });
          const json = sub.toJSON();
          if (json?.endpoint && json?.keys?.p256dh && json?.keys?.auth) {
            await supabase.from('web_push_subscriptions').upsert({
              user_id: userId,
              endpoint: json.endpoint,
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
              user_agent: (typeof navigator !== 'undefined' && navigator.userAgent || '').slice(0, 180) || null,
              last_seen_at: new Date().toISOString(),
            }, { onConflict: 'endpoint' });
          }
        }
      } catch { /* table/SW/VAPID not live yet — tab-open notifications still work */ }

      return 'web-push-on';
    } catch { return null; }
  },

  // Cross-platform: is push actually ON, and can we still ask?
  // → { granted, canAsk }. Drives the "turn on notifications" nudge.
  async getPermissionState() {
    try {
      if (Platform.OS === 'web') {
        if (typeof Notification === 'undefined') return { granted: false, canAsk: false };
        const p = Notification.permission; // 'granted' | 'denied' | 'default'
        return {
          granted: p === 'granted' && this.isWebPushEnabled(),
          canAsk: p !== 'denied', // once the browser is 'denied' we can't re-prompt
        };
      }
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      return { granted: status === 'granted', canAsk: status !== 'granted' && canAskAgain !== false };
    } catch {
      return { granted: false, canAsk: true };
    }
  },

  isWebPushEnabled() {
    try {
      return Platform.OS === 'web'
        && typeof Notification !== 'undefined'
        && Notification.permission === 'granted'
        && window.localStorage.getItem('gruvs_web_push') === '1';
    } catch { return false; }
  },

  disableWebPush() {
    try { window.localStorage.removeItem('gruvs_web_push'); } catch {}
    // Also tear down the closed-tab subscription (fire-and-forget).
    (async () => {
      try {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager?.getSubscription();
        if (sub) {
          try { await supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch {}
          await sub.unsubscribe();
        }
      } catch {}
    })();
  },

  showBrowserNotification(title, body, data = {}) {
    try {
      if (!this.isWebPushEnabled()) return;
      // Signal over noise: hush non-urgent pings during quiet hours / vanity types.
      // (The in-app bell still receives everything; this only gates the interruption.)
      if (!shouldInterrupt(data?.type)) return;
      const n = new Notification(title || 'The Gruvs', { body: body || '', icon: '/logo.png', tag: data?.type || 'gruvs', data });
      n.onclick = () => { try { window.focus(); } catch {} try { n.close(); } catch {} };
    } catch {}
  },

  // Registers device for push and stores token in profiles table
  async registerForPush(userId) {
    if (!userId) return null;
    if (Platform.OS === 'web') return this.registerWebPush(userId);
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
    } catch (e) { logError('Notify.push', e, { type }); }
    // Device push is delivered server-side by the push-notify Supabase Edge Function,
    // which fires on every notifications INSERT via a DB webhook.  No client-side
    // Expo Push API call is needed here.
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
    } catch (e) { logError('Notify.friendsAtEvent', e); }
  },

  // ── Now playing notifications ─────────────────────────────────────────────────

  async notifyNowPlaying(eventId, artistName, songTitle) {
    try {
      const { data: followers } = await supabase
        .from('event_followers')
        .select('user_id, notify_nowplaying')
        .eq('event_id', eventId)
        .eq('notify_nowplaying', true);

      const body = songTitle ? `${artistName} — ${songTitle}` : `${artistName} is on stage`;
      for (const f of (followers || [])) {
        await this.send(f.user_id, {
          type: 'now_playing',
          title: '🎵 Now Playing',
          body,
          eventId,
        });
      }
    } catch (e) { logError('Notify.nowPlaying', e); }
  },

  async notifyLineupChange(eventId, message) {
    try {
      const { data: followers } = await supabase
        .from('event_followers')
        .select('user_id, notify_lineup')
        .eq('event_id', eventId)
        .eq('notify_lineup', true);

      for (const f of (followers || [])) {
        await this.send(f.user_id, {
          type: 'lineup_change',
          title: '📋 Lineup Update',
          body: message,
          eventId,
        });
      }
    } catch (e) { logError('Notify.lineupChange', e); }
  },

  async notifySessionStarting(eventId, sessionTitle, room) {
    try {
      const { data: followers } = await supabase
        .from('event_followers')
        .select('user_id, notify_updates')
        .eq('event_id', eventId)
        .eq('notify_updates', true);

      const body = room ? `${sessionTitle} — ${room}` : sessionTitle;
      for (const f of (followers || [])) {
        await this.send(f.user_id, {
          type: 'session_starting',
          title: '🎤 Starting Now',
          body,
          eventId,
        });
      }
    } catch (e) { logError('Notify.sessionStarting', e); }
  },

  // ── Sports / match notifications ─────────────────────────────────────────────

  async notifyGoal(eventId, homeTeam, awayTeam, scoringTeam, homeScore, awayScore) {
    try {
      const { data: followers } = await supabase
        .from('sport_event_followers')
        .select('user_id, notify_goals')
        .eq('event_id', eventId)
        .eq('notify_goals', true);

      const matchLine = `${homeTeam} ${homeScore} – ${awayScore} ${awayTeam}`;
      for (const f of (followers || [])) {
        await this.send(f.user_id, {
          type: 'sport_goal',
          title: `⚽ GOAL! ${scoringTeam}`,
          body: matchLine,
          eventId,
        });
      }
    } catch (e) { logError('Notify.sportGoal', e); }
  },

  async notifyMatchResult(eventId, homeTeam, awayTeam, homeScore, awayScore, result) {
    try {
      const { data: followers } = await supabase
        .from('sport_event_followers')
        .select('user_id, notify_results')
        .eq('event_id', eventId)
        .eq('notify_results', true);

      const resultLabel = result === 'home_win' ? `${homeTeam} win` : result === 'away_win' ? `${awayTeam} win` : 'Draw';
      const scoreLine = `${homeTeam} ${homeScore} – ${awayScore} ${awayTeam}`;
      for (const f of (followers || [])) {
        await this.send(f.user_id, {
          type: 'sport_result',
          title: `🏁 Full Time: ${resultLabel}`,
          body: scoreLine,
          eventId,
        });
      }
    } catch (e) { logError('Notify.sportResult', e); }
  },

  async notifyFixtureScheduled(eventId, homeTeam, awayTeam, scheduledAt) {
    try {
      const { data: followers } = await supabase
        .from('sport_event_followers')
        .select('user_id, notify_fixtures')
        .eq('event_id', eventId)
        .eq('notify_fixtures', true);

      const when = scheduledAt
        ? new Date(scheduledAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      for (const f of (followers || [])) {
        await this.send(f.user_id, {
          type: 'sport_fixture',
          title: `📅 Fixture: ${homeTeam} vs ${awayTeam}`,
          body: when ? `Scheduled for ${when}` : 'New fixture added',
          eventId,
        });
      }
    } catch (e) { logError('Notify.sportFixture', e); }
  },

  // ── Ecosystem Notifications: The Gruvs (Consumer & Merchant) ─────────────

  async notifyProximityVibeRadar(recipientId, count, closestEventTitle) {
    return this.send(recipientId, {
      type: 'proximity_vibe_radar',
      title: `🔥 ${count} Vibes Near Your Area`,
      body: `Including ${closestEventTitle}. Tap to explore this weekend's radar.`,
      data: { count, closestEventTitle },
    });
  },

  async notifySquadPass(recipientId, crewJoinedCount, neededCount = 1) {
    return this.send(recipientId, {
      type: 'squad_pass',
      title: '🎟️ Squad Pass Unlocked!',
      body: `${crewJoinedCount} friends joined. Invite ${neededCount} more to unlock secret VIP queue bypass.`,
      data: { crewJoinedCount, neededCount },
    });
  },

  async notifyEventGeofence(recipientId, eventId, eventTitle, vibePoints = 50) {
    return this.send(recipientId, {
      type: 'geofence_arrival',
      title: `📍 You've Arrived at ${eventTitle}!`,
      body: `Check in to claim +${vibePoints} Vibe Points and see your crew inside.`,
      eventId,
      data: { vibePoints },
    });
  },

  async notifyStageDrop(recipientId, eventId, artistName, stageName = 'Main Stage') {
    return this.send(recipientId, {
      type: 'stage_drop',
      title: `🎤 STAGE DROP: ${artistName}`,
      body: `Just stepped onto ${stageName}! Beat the rush to the front.`,
      eventId,
      data: { artistName, stageName },
    });
  },

  async notifyTicketScarcity(recipientId, eventId, eventTitle, remainingCount = 40) {
    return this.send(recipientId, {
      type: 'ticket_scarcity',
      title: `⚡ Low Ticket Alert: ${eventTitle}`,
      body: `Only ${remainingCount} early-bird tickets remaining before tier price increase.`,
      eventId,
      data: { remainingCount },
    });
  },

  async notifyMerchantForecast(recipientId, area, totalCrowd, topTrend) {
    return this.send(recipientId, {
      type: 'merchant_crowd_forecast',
      title: `📊 Weekend Crowd Forecast: ${totalCrowd}`,
      body: `${area} is surging. Top search: "${topTrend}". Check vendor permits.`,
      data: { area, totalCrowd, topTrend },
    });
  },

  async notifyMerchantSearchSurge(recipientId, area, searchCount = 50) {
    return this.send(recipientId, {
      type: 'merchant_search_surge',
      title: `🔥 High Search Surge in ${area}`,
      body: `${searchCount}+ Gruvers searching food & drinks nearby. Tap to boost your pin for 2 hours.`,
      data: { area, searchCount },
    });
  },

  async notifyVendorPermit(recipientId, eventTitle, status = 'approved', stallNumber = 'Stall #14') {
    return this.send(recipientId, {
      type: 'vendor_permit',
      title: `✅ Pop-Up Permit ${status.toUpperCase()}`,
      body: `Confirmed for ${stallNumber} at ${eventTitle}. View your digital QR access pass.`,
      data: { eventTitle, status, stallNumber },
    });
  },

  async notifyMerchantPayout(recipientId, amountRands, bankName = 'FNB') {
    return this.send(recipientId, {
      type: 'instant_payout',
      title: `💰 Payout Dispatched: R${amountRands}`,
      body: `Settled instantly to your ${bankName} account with zero processing delays.`,
      data: { amountRands, bankName },
    });
  },

  // ── Ecosystem Notifications: The Resident (Stays & Mobility) ──────────────

  async notifyWeekendLockIn(recipientId, eventTitle, padsCount = 3, minPrice = 180) {
    return this.send(recipientId, {
      type: 'weekend_lock_in',
      title: `🛌 Verified Crash Pads near ${eventTitle}`,
      body: `${padsCount} verified rooms with solar backup available from R${minPrice}/night.`,
      data: { eventTitle, padsCount, minPrice },
    });
  },

  async notifyCarpoolMatch(recipientId, captainName, fromArea, toArea, fareRands = 45) {
    return this.send(recipientId, {
      type: 'carpool_match',
      title: `🚗 Carpool Match: ${fromArea} ➔ ${toArea}`,
      body: `Ride with verified Capt. ${captainName} for R${fareRands}/seat. Tap to secure.`,
      data: { captainName, fromArea, toArea, fareRands },
    });
  },

  async notifyGuardianShield(recipientId, minutesRemaining = 15, destination = 'Home Base') {
    return this.send(recipientId, {
      type: 'guardian_shield_timer',
      title: `🛡️ Guardian Shield Active: ${minutesRemaining}m Remaining`,
      body: `En route to ${destination}. Tap to confirm arrival or extend safety timer.`,
      data: { minutesRemaining, destination },
    });
  },

  async notifyGuardianEmergency(contactId, travelerName, lastLocation, mapUrl) {
    return this.send(contactId, {
      type: 'guardian_emergency',
      title: `⚠️ EMERGENCY ALERT: ${travelerName}`,
      body: `Did not confirm arrival. Last GPS: ${lastLocation}. Tap map link immediately.`,
      data: { travelerName, lastLocation, mapUrl },
    });
  },

  async notifyHostDemandSurge(hostId, area, eventTitle, projectedYield = 'R950') {
    return this.send(hostId, {
      type: 'host_demand_surge',
      title: `📈 High Stay Demand in ${area}`,
      body: `${eventTitle} is 90% full. Average weekend yield: ${projectedYield}/night. List your cottage.`,
      data: { area, eventTitle, projectedYield },
    });
  },

  async notifyHostBooking(hostId, guestName, payoutRands) {
    return this.send(hostId, {
      type: 'host_booking',
      title: `🛎️ New Stay Confirmed: ${guestName}`,
      body: `R${payoutRands} secured in escrow. Dual-ID verified. View guest arrival details.`,
      data: { guestName, payoutRands },
    });
  },

  async notifyCarpoolCorridorCallout(captainId, fromArea, toArea, earningsEst = 'R280') {
    return this.send(captainId, {
      type: 'carpool_callout',
      title: `🚕 02:00 AM Nightlife Route Open`,
      body: `High passenger volume from ${fromArea} to ${toArea}. Earn ~${earningsEst}/run.`,
      data: { fromArea, toArea, earningsEst },
    });
  },

  // ── Ecosystem Notifications: Excellency Academy (Creators & Talent) ──────

  async notifyScholarshipDrop(recipientId, vibePoints, courseTitle, discountPercent = 30) {
    return this.send(recipientId, {
      type: 'scholarship_drop',
      title: `🎟️ ${discountPercent}% Tuition Scholarship Unlocked!`,
      body: `Your ${vibePoints} Vibe Points qualify you for ${courseTitle}. Redeem now.`,
      data: { vibePoints, courseTitle, discountPercent },
    });
  },

  async notifyFestivalGig(recipientId, roleTitle, eventTitle, rateRands = 1200) {
    return this.send(recipientId, {
      type: 'festival_gig',
      title: `💼 Open Paid Gig: ${roleTitle}`,
      body: `${eventTitle} needs certified crew (R${rateRands}/day). Apply with Academy ID.`,
      data: { roleTitle, eventTitle, rateRands },
    });
  },

  async notifyStudioSession(recipientId, sessionTitle, studioRoom = 'Studio 4', timeStr = '15:00') {
    return this.send(recipientId, {
      type: 'studio_session',
      title: `🎛️ Studio Session Starting at ${timeStr}`,
      body: `${sessionTitle} in ${studioRoom}. Bring your USB with 3 unreleased stems.`,
      data: { sessionTitle, studioRoom, timeStr },
    });
  },

  async notifyRecruiterTalent(promoterId, candidateCount, requiredRole) {
    return this.send(promoterId, {
      type: 'recruiter_talent',
      title: `🎪 ${candidateCount} Certified ${requiredRole}s Available`,
      body: `Excellency Academy graduates matched your event production crew request.`,
      data: { candidateCount, requiredRole },
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
    } catch (e) { logError('Notify.markAllRead', e, { userId }); }
  },

  async getUnreadCount(userId) {
    if (!userId) return 0;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false);
      const unread = count || 0;
      this.syncAppBadge(unread);
      return unread;
    } catch {
      return 0;
    }
  },

  /**
   * Sync unread notification count to phone app icon badge (iOS/Android) and Web tab badge
   */
  async syncAppBadge(count = 0) {
    const safeCount = Math.max(0, parseInt(count, 10) || 0);
    if (Platform.OS !== 'web') {
      try {
        await Notifications.setBadgeCountAsync(safeCount);
      } catch (_) {}
    } else if (typeof document !== 'undefined') {
      // Dynamic Web App Tab Title Badge e.g. "(3) The Gruvs"
      try {
        const titleClean = document.title.replace(/^\(\d+\)\s*/, '');
        document.title = safeCount > 0 ? `(${safeCount}) ${titleClean}` : titleClean;
        // PWA App Badge API (Chrome / Edge / Safari on mobile & desktop)
        if ('setAppBadge' in navigator) {
          if (safeCount > 0) navigator.setAppBadge(safeCount).catch(() => {});
          else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
        }
      } catch (_) {}
    }
  },
};
