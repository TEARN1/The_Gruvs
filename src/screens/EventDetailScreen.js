import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, Linking, Share, Animated, Modal, Dimensions, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const SCREEN_W = Dimensions.get('window').width;
const HERO_H = Math.min(300, Math.max(220, SCREEN_W * 0.72));
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { GlassView } from '../components/GlassView';
import { EchoSection } from '../components/EchoSection';
import { RatingSection } from '../components/RatingSection';
import { EventGallery } from '../components/EventGallery';
import { WaitlistButton } from '../components/WaitlistButton';
import { EventReactions } from '../components/EventReactions';
import { LiveEventUpdates } from '../components/LiveEventUpdates';
import { EventWeather } from '../components/EventWeather';
import { VIPTierSelector } from '../components/VIPTierSelector';
import { CarpoolBoard } from '../components/CarpoolBoard';
import { MediaViewer } from '../components/MediaViewer';
import { useToast } from '../components/ToastNotification';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { RSVPManager, CheckInManager, UserManager, RealtimeManager, CapacityManager, ReminderManager, ScoreEngine, VibeManager } from '../services/dataFlow';
import { LocationService } from '../services/locationService';
import { SecurityService } from '../services/securityService';
import { EventContextualAds } from '../components/EventContextualAds';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { ReportModal } from '../components/ReportModal';
import { EventScheduleSection } from '../components/EventScheduleSection';
import { EventChatRoom } from '../components/EventChatRoom';
import { EventPollSection } from '../components/EventPollSection';
import { EventPlaylistSection } from '../components/EventPlaylistSection';
import { EventRoleManager } from '../components/EventRoleManager';
import { useEventRole } from '../hooks/useEventRole';
import { EventMomentsSection } from '../components/EventMomentsSection';
import { OrganizerDashboard } from '../components/OrganizerDashboard';
import { LiveEventBanner } from '../components/LiveEventBanner';

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
};

const formatPrice = (price) => {
  if (!price || price === 0 || price === '0' || price === 'FREE') return 'FREE';
  if (typeof price === 'string' && price.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(price);
      if (parsed.general !== undefined) {
        const genVal = parseFloat(parsed.general);
        if (!isNaN(genVal)) {
          if (parsed.vip || parsed.vvip) {
            return `R${genVal.toFixed(2)}+`;
          }
          return `R${genVal.toFixed(2)}`;
        }
      }
      return 'TICKETS';
    } catch (e) {}
  }
  const parsed = parseFloat(price);
  if (isNaN(parsed)) return price;
  return `R${parsed.toFixed(2)}`;
};

export const EventDetailScreen = ({ event, visible, onClose, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const { applyLocationPrivacy, applyProfilePrivacy } = useIdentity();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();

  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [goingCount, setGoingCount] = useState(0);
  const [vibeCount, setVibeCount] = useState(event?.vibe_count || 0);
  const [hasVibed, setHasVibed] = useState(false);
  const [vibeSending, setVibeSending] = useState(false);
  const [capacityStatus, setCapacityStatus] = useState({ hasLimit: false, isSoldOut: false, spotsLeft: null });
  const [hasReminder, setHasReminder] = useState(false);
  const [settingReminder, setSettingReminder] = useState(false);
  const [whoGoingVisible, setWhoGoingVisible] = useState(false);
  const [whoGoing, setWhoGoing] = useState([]);
  const [attendeePreview, setAttendeePreview] = useState([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [roleManagerVisible, setRoleManagerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'polls' | 'playlist'
  const [momentCaptureOpen, setMomentCaptureOpen] = useState(false);
  const scrollRef = useRef(null);

  const { isOrganiser, isCoHost, canPost, canModerate } = useEventRole(
    event?.id, user?.id, event?.author_id ?? event?.profiles?.id
  );

  const slideAnim = useRef(new Animated.Value(0)).current;

  const primary = currentTheme?.primary || '#00f2ff';
  const background = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#ffffff';
  const textMuted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const organizer = event?.profiles || {};
  const media = event?.media?.length
    ? event.media
    : event?.media_urls?.length
      ? event.media_urls.map(u => ({ type: /\.(mp4|mov|m4v|webm)/i.test(u) ? 'video' : 'image', url: u }))
      : event?.cover_url
        ? [{ type: 'image', url: event.cover_url }]
        : event?.image_url
          ? [{ type: 'image', url: event.image_url }]
          : event?.cover_image
            ? [{ type: 'image', url: event.cover_image }]
            : [];

  // Countdown clock — ticks every second while event is in the future
  useEffect(() => {
    const target = event?.event_date
      ? new Date(`${event.event_date}${event.event_time ? 'T' + event.event_time : 'T00:00:00'}`)
      : null;
    if (!target || isNaN(target.getTime())) { setCountdown(null); return; }

    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setCountdown({ over: true }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown({ d, h, m, s, over: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event?.event_date, event?.event_time]);

  const fetchUserState = useCallback(async () => {
    if (!user || !event?.id) return;
    const [rsvpRes, followRes, checkinRes] = await Promise.allSettled([
      RSVPManager.getUserStatus(event.id, user.id),
      UserManager.isFollowing(user.id, organizer?.id),
      CheckInManager.hasCheckedIn(event.id, user.id),
    ]);
    if (rsvpRes.status === 'fulfilled' && rsvpRes.value != null) setRsvpStatus(rsvpRes.value);
    if (followRes.status === 'fulfilled' && followRes.value != null) setIsFollowing(followRes.value);
    if (checkinRes.status === 'fulfilled' && checkinRes.value) setCheckedIn(true);
  }, [user, event?.id, organizer?.id]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
      if (event?.id) {
        fetchUserState();
        fetchGoingCount();
        fetchAttendeePreview();
        setVibeCount(event?.vibe_count || 0);
        CapacityManager.getStatus(event.id).then(setCapacityStatus);
        if (user) ReminderManager.hasReminder(user.id, event.id).then(setHasReminder);
      }
    } else {
      slideAnim.setValue(0);
    }

    if (!visible || !event?.id) return;

    let unsubVibe = () => {};
    let unsubCheckin = () => {};
    let rsvpChan = null;

    // Real-time: live vibe count — wired to state
    unsubVibe = RealtimeManager.subscribeToVibeCount(event.id, (count) => {
      setVibeCount(count);
    });
    // Real-time: live Touch Down (attendee) count
    unsubCheckin = RealtimeManager.subscribeToAttendees(event.id, () => {
      fetchGoingCount();
    });
    // Real-time: RSVP changes → refresh going count
    const chanKey = `rsvp_${event.id}`;
    rsvpChan = supabase.channel(chanKey)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps', filter: `event_id=eq.${event.id}` }, () => {
        fetchGoingCount();
      })
      .subscribe();

    return () => {
      unsubVibe();
      unsubCheckin();
      if (rsvpChan) supabase.removeChannel(rsvpChan);
    };
  }, [visible, event?.id, fetchUserState, fetchAttendeePreview]);

  const fetchGoingCount = async () => {
    if (!event?.id) return;
    try {
      const count = await RSVPManager.getGoingCount(event.id);
      setGoingCount(count || 0);
    } catch { }
  };

  const fetchAttendeePreview = useCallback(async () => {
    if (!event?.id) return;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('profiles:user_id(id, username, avatar_url)')
        .eq('event_id', event.id)
        .eq('status', 'going')
        .limit(7);
      setAttendeePreview((data || []).map(r => r.profiles).filter(Boolean));
    } catch { }
  }, [event?.id]);

  const handleRsvp = useCallback(async (status) => {
    if (!user) { onAuthRequired?.(); return; }
    if (rsvpLoading) return;
    // Optimistic update
    const prev = rsvpStatus;
    setRsvpStatus(status);
    if (status === 'going' && prev !== 'going') setGoingCount((c) => c + 1);
    if (prev === 'going' && status !== 'going') setGoingCount((c) => Math.max(0, c - 1));
    setRsvpLoading(true);
    try {
      const ok = await RSVPManager.upsert(event.id, user.id, status);
      if (!ok) throw new Error('RSVP update failed');
      
      showToast(
        status === 'going' ? "You're Vibing!" : status === 'maybe' ? "Maybe Vibing" : "Vibe removed",
        'success'
      );
    } catch (err) {
      // Rollback on failure
      setRsvpStatus(prev);
      if (status === 'going' && prev !== 'going') setGoingCount((c) => Math.max(0, c - 1));
      if (prev === 'going' && status !== 'going') setGoingCount((c) => c + 1);
      showToast('Could not Vibe. Try again.', 'error');
    } finally {
      setRsvpLoading(false);
    }
  }, [user, rsvpStatus, rsvpLoading, event?.id, onAuthRequired, showToast]);

  const handleVibe = useCallback(async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (vibeSending) return;
    const wasVibed = hasVibed;
    setHasVibed(!wasVibed);
    setVibeCount(c => wasVibed ? Math.max(0, c - 1) : c + 1);
    setVibeSending(true);
    try {
      const ok = wasVibed
        ? await VibeManager.removeVibe(event.id, user.id)
        : await VibeManager.sendVibe(event.id, user.id);
      if (!ok) throw new Error('vibe failed');
      if (!wasVibed) {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        showToast('⚡ Vibe sent!', 'success');
      }
    } catch {
      setHasVibed(wasVibed);
      setVibeCount(c => wasVibed ? c + 1 : Math.max(0, c - 1));
      showToast('Could not send vibe. Try again.', 'error');
    } finally {
      setVibeSending(false);
    }
  }, [user, event?.id, hasVibed, vibeSending, onAuthRequired, showToast]);

  const handleFollow = async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (followLoading || !organizer?.id) return;
    setIsFollowing(!isFollowing); // optimistic
    setFollowLoading(true);
    try {
      const ok = isFollowing
        ? await UserManager.unfollow(user.id, organizer.id)
        : await UserManager.follow(user.id, organizer.id);
      if (!ok) setIsFollowing(isFollowing); // rollback
    } catch {
      setIsFollowing(isFollowing); // rollback on exception
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const eventUrl = `https://thegruvs.app?event=${event?.id}`;
      const freeTag = (!event?.price || event?.price === 0 || event?.price === 'FREE') ? '\n🆓 FREE entry' : (event?.price ? `\n🎟 R${event.price}` : '');
      const shareText = `🎉 ${event?.title || 'Check out this Gruv'}\n📅 ${formatDate(event?.event_date)}${event?.venue_name ? `\n📍 ${event.venue_name}` : ''}${freeTag}\n\nDownload The Gruvs 👉 ${eventUrl}`;
      await Share.share({ message: shareText, title: event?.title });
    } catch { }
  };

  const handleToggleReminder = async () => {
    if (!user) { onAuthRequired?.(); return; }
    setSettingReminder(true);
    try {
      if (hasReminder) {
        await ReminderManager.cancel(user.id, event.id);
        setHasReminder(false);
        showToast('Reminder cancelled', 'info');
      } else {
        const ok = await ReminderManager.set(user.id, event.id, event.event_date, event.event_time || event.start_time, 60);
        setHasReminder(ok);
        showToast(ok ? 'Reminder set — 1 hour before' : 'Could not set reminder (event may have passed)', ok ? 'success' : 'error');
      }
    } catch {
      showToast('Could not update reminder', 'error');
    } finally {
      setSettingReminder(false);
    }
  };

  const handleWhoGoing = async () => {
    if (!event?.id) return;
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('profiles(id, username, avatar_url, vibe_score, identity_mode, is_beacon_active)')
        .eq('event_id', event.id)
        .eq('status', 'going')
        .limit(50);
      if (error) throw error;

      const results = (data || [])
        .map(r => r.profiles)
        .filter(Boolean)
        .map(p => applyProfilePrivacy(p, p.id))
        .filter(v => v !== null);

      setWhoGoing(results);
      setWhoGoingVisible(true);
    } catch (err) {
      showToast('Could not load vibers list.', 'error');
    }
  };

  const openMaps = () => {
    if (!event?.venue_name) return;
    const query = encodeURIComponent(event.venue_address || event.venue_name);
    SecurityService.safeOpenURL(`https://maps.google.com/?q=${query}`);
  };

  const openTickets = () => {
    if (event?.ticket_url) SecurityService.safeOpenURL(event.ticket_url);
  };

  const handleReport = () => {
    if (!user) { onAuthRequired?.(); return; }
    setReportVisible(true);
  };

  const handleCheckIn = async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (checkingIn || checkedIn) return;
    setCheckingIn(true);
    try {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch { }
      const coords = await LocationService.requestAndGet();
      const privateCoords = coords ? applyLocationPrivacy(coords.lat, coords.lon) : {};
      const ok = await CheckInManager.touchDown(event.id, user.id, privateCoords || {});
      if (ok) {
        setCheckedIn(true);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
        showToast("Touched Down! Your footprint is lit. 🔥", 'success');
      } else {
        showToast('Touch Down failed. Try again.', 'error');
      }
    } catch {
      showToast('Touch Down failed. Try again.', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const capacity = event?.max_attendees || event?.capacity || 0;
  const spotsLeft = capacityStatus.spotsLeft ?? Math.max(0, capacity - goingCount);
  const isSoldOut = capacityStatus.isSoldOut || (capacity > 0 && goingCount >= capacity);
  const capacityPct = capacity > 0 ? Math.min(1, goingCount / capacity) : 0;

  const RSVP_OPTIONS = [
    { key: 'going', label: 'Vibe', icon: 'check-circle' },
    { key: 'maybe', label: 'Maybe', icon: 'help-circle' },
    { key: 'not_going', label: 'Not Vibing', icon: 'x-circle' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[styles.root, { backgroundColor: background }]}
        accessibilityViewIsModal
        accessibilityLabel={event?.title ? `Event details: ${event.title}` : 'Event details'}
        {...(Platform.OS === 'web' ? { 'aria-modal': true } : {})}
      >

        <View style={styles.hero}>
          <MediaViewer media={media} containerWidth={undefined} />
          <View style={styles.heroScrim} pointerEvents="none" />

          {event?.category && (
            <View style={[styles.categoryBadge, { backgroundColor: primary + 'cc' }]}>
              <Text style={styles.categoryText}>{event.category.toUpperCase()}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.heroBtn, styles.closeBtn, { top: insets.top + 8 }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close event details"
          >
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.heroBtn, styles.shareBtn, { top: insets.top + 8 }]} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="share-2" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.body}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.bodyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try { await Promise.all([fetchUserState(), fetchGoingCount()]); } catch { } finally { setRefreshing(false); }
              }}
              tintColor={primary}
              colors={[primary]}
            />
          }
        >

          {event?.id && (
            <EventMomentsSection
              event={event}
              primary={primary}
              textColor={textColor}
              surface={surface}
              triggerCapture={momentCaptureOpen}
              onCaptureHandled={() => setMomentCaptureOpen(false)}
            />
          )}

          <View style={styles.organizerRow}>
            <View style={styles.avatarWrap}>
              {organizer.avatar_url
                ? <Image source={{ uri: organizer.avatar_url }} style={styles.avatar} />
                : <View style={[styles.avatar, { backgroundColor: ['#0891b2', '#7c3aed', '#059669', '#dc2626'][(organizer.username?.charCodeAt(0) || 0) % 4], alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{(organizer.username || 'V')[0].toUpperCase()}</Text>
                </View>
              }
              <View style={[styles.onlineDot, { backgroundColor: primary }]} />
              {organizer.is_verified && (
                <View style={[styles.verifiedBadge, { backgroundColor: primary }]}>
                  <Feather name="check" size={8} color="#000" />
                </View>
              )}
            </View>

            <View style={styles.organizerMeta}>
              <Text style={[styles.organizerName, { color: textColor }]}>
                {organizer.username || 'Unknown Organizer'}
              </Text>
              {organizer.vibe_score != null && (
                <View style={[styles.vibeBadge, { borderColor: primary + '80' }]}>
                  <Feather name="zap" size={10} color={primary} />
                  <Text style={[styles.vibeScore, { color: primary }]}>{organizer.vibe_score}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.followBtn, { borderColor: primary, backgroundColor: isFollowing ? primary : 'transparent' }]}
              onPress={handleFollow}
              disabled={followLoading}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? `Unfollow ${organizer.username}` : `Follow ${organizer.username}`}
            >
              <Text style={[styles.followBtnText, { color: isFollowing ? '#000' : primary }]}>
                {isFollowing ? 'Locked In' : 'Lock In'}
              </Text>
            </TouchableOpacity>

            {user && organizer?.id && user.id !== organizer.id && (
              <TouchableOpacity
                style={[styles.messageOrganizerBtn, { borderColor: `${primary}50`, backgroundColor: `${primary}12` }]}
                onPress={() => setDmOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Message ${organizer.username || 'organizer'}`}
              >
                <Feather name="message-circle" size={16} color={primary} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.title, { color: textColor }]}>{event?.title || 'Untitled Gruv'}</Text>

          {!!event?.description && (
            <Text style={[styles.description, { color: textMuted }]}>{event.description}</Text>
          )}

          <View style={styles.metaRow}>
            <MetaChip icon="calendar" label={formatDate(event?.event_date)} color={primary} />
            {!!(event?.event_time || event?.date_time) && (
              <MetaChip
                icon="clock"
                label={
                  (event?.event_time ? formatTime(event.event_time) : new Date(event.date_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})) +
                  (event?.end_time ? ` – ${formatTime(event.end_time)}` : '')
                }
                color={primary}
              />
            )}
            {!!event?.venue_name && (
              <TouchableOpacity onPress={openMaps}>
                <MetaChip icon="map-pin" label={event.venue_name} color={primary} pressable />
              </TouchableOpacity>
            )}
            <MetaChip icon="tag" label={formatPrice(event?.price)} color={primary} />
            {!!event?.age_restriction && (
              <MetaChip
                icon="shield"
                label={event.age_max && event.age_max !== 99 ? `${event.age_restriction}–${event.age_max}` : `${event.age_restriction}+`}
                color="#f59e0b"
              />
            )}
          </View>

          {/* Ticket Tiers Section */}
          {(() => {
            if (!event?.price) return null;
            if (typeof event.price === 'string' && event.price.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(event.price);
                const hasTiers = parsed.general || parsed.vip || parsed.vvip || parsed.other;
                if (!hasTiers) return null;
                return (
                  <View style={[styles.ticketSection, { backgroundColor: `${primary}06`, borderColor: `${primary}18` }]}>
                    <Text style={[styles.ticketSectionTitle, { color: primary }]}>🎟️ TICKET OPTIONS</Text>
                    <View style={styles.ticketGrid}>
                      {parsed.general ? (
                        <View style={styles.ticketTier}>
                          <Text style={[styles.ticketLabel, { color: textMuted }]}>General / Entry</Text>
                          <Text style={[styles.ticketValue, { color: textColor }]}>R{parseFloat(parsed.general).toFixed(2)}</Text>
                        </View>
                      ) : null}
                      {parsed.vip ? (
                        <View style={styles.ticketTier}>
                          <Text style={[styles.ticketLabel, { color: '#f59e0b' }]}>👑 VIP</Text>
                          <Text style={[styles.ticketValue, { color: '#f59e0b' }]}>R{parseFloat(parsed.vip).toFixed(2)}</Text>
                        </View>
                      ) : null}
                      {parsed.vvip ? (
                        <View style={styles.ticketTier}>
                          <Text style={[styles.ticketLabel, { color: '#d946ef' }]}>💎 VVIP</Text>
                          <Text style={[styles.ticketValue, { color: '#d946ef' }]}>R{parseFloat(parsed.vvip).toFixed(2)}</Text>
                        </View>
                      ) : null}
                    </View>
                    {parsed.other ? (
                      <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: `${primary}12`, paddingTop: 8 }}>
                        <Text style={[styles.ticketLabel, { color: textMuted }]}>Other Packages</Text>
                        <Text style={[styles.ticketValue, { color: textColor, fontSize: 13, fontWeight: '700' }]}>{parsed.other}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              } catch (e) {}
            }
            return null;
          })()}

          {/* Weather forecast */}
          {event && (
            <EventWeather
              event={event}
              primary={primary}
              textColor={textColor}
              muted={textMuted}
              surface={surface}
            />
          )}

          {/* Countdown Timer */}
          {countdown && !countdown.over && (
            <View style={[styles.countdownBar, { backgroundColor: `${primary}10`, borderColor: `${primary}25` }]}>
              <Feather name="clock" size={13} color={primary} />
              {countdown.d > 0 ? (
                <>
                  <CountdownUnit value={countdown.d} label="D" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.h} label="H" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.m} label="M" primary={primary} textColor={textColor} />
                </>
              ) : (
                <>
                  <CountdownUnit value={countdown.h} label="H" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.m} label="M" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.s} label="S" primary={primary} textColor={textColor} />
                </>
              )}
              <Text style={[styles.countdownLabel, { color: textMuted }]}>until the Gruv</Text>
            </View>
          )}
          {countdown?.over && (
            <LiveEventBanner
              event={event}
              primary={primary}
              textColor={textColor}
              surface={surface}
              capacity={event?.max_attendees || event?.capacity || 0}
              onAddMoment={user ? () => setMomentCaptureOpen(true) : null}
            />
          )}

          {/* Attendee preview strip */}
          {attendeePreview.length > 0 && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingHorizontal: 2 }}
              onPress={handleWhoGoing}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row' }}>
                {attendeePreview.slice(0, 6).map((p, i) => (
                  <View key={p.id || i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i, borderRadius: 18, borderWidth: 2, borderColor: background }}>
                    {p.avatar_url
                      ? <Image source={{ uri: p.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      : <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ['#0891b2','#7c3aed','#059669','#d97706','#db2777','#dc2626'][i % 6], alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{(p.username || '?')[0].toUpperCase()}</Text>
                        </View>
                    }
                  </View>
                ))}
              </View>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', flex: 1 }}>
                {attendeePreview[0]?.username && `@${attendeePreview[0].username}`}
                {attendeePreview.length > 1 && ` and ${goingCount - 1} others are vibing`}
              </Text>
              <Feather name="chevron-right" size={14} color={primary} />
            </TouchableOpacity>
          )}

          {/* Vibe count + Who's Going */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.vibePill, { backgroundColor: hasVibed ? `${primary}30` : `${primary}15`, borderColor: hasVibed ? primary : `${primary}30` }]}
              onPress={handleVibe}
              disabled={vibeSending}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={13} color={primary} />
              <Text style={[styles.vibeCountText, { color: primary }]}>{vibeCount} Vibe{vibeCount !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.vibePill, { backgroundColor: `${primary}08`, borderColor: `${primary}20` }]}
              onPress={handleWhoGoing}
            >
              <Feather name="users" size={13} color={primary} />
              <Text style={[styles.vibeCountText, { color: primary }]}>{goingCount} Vibing</Text>
            </TouchableOpacity>
            {isSoldOut && (
              <View style={[styles.vibePill, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}>
                <Feather name="alert-circle" size={13} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>SOLD OUT</Text>
              </View>
            )}
          </View>

          {capacity > 0 && !isSoldOut && (
            <GlassView style={[styles.capacityCard, { backgroundColor: surface }]}>
              <View style={styles.capacityHeader}>
                <Text style={[styles.capacityLabel, { color: textColor }]}>
                  {goingCount} <Text style={{ color: textMuted }}>/ {capacity} Vibing</Text>
                </Text>
                <Text style={[styles.spotsLeft, { color: spotsLeft < 10 ? '#ff6b6b' : primary }]}>
                  {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={[styles.progressFill, { width: `${capacityPct * 100}%`, backgroundColor: capacityPct > 0.8 ? '#ef4444' : primary }]} />
              </View>
            </GlassView>
          )}

          <GlassView style={[styles.rsvpCard, { backgroundColor: surface }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>VIBE</Text>
            <View style={styles.rsvpRow}>
              {RSVP_OPTIONS.map((opt) => {
                const active = rsvpStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.rsvpBtn,
                      { borderColor: active ? primary : 'rgba(255,255,255,0.15)', backgroundColor: active ? primary + '22' : 'transparent' },
                    ]}
                    onPress={() => handleRsvp(opt.key)}
                    disabled={rsvpLoading}
                  >
                    <Feather name={opt.icon} size={16} color={active ? primary : textMuted} />
                    <Text style={[styles.rsvpBtnText, { color: active ? primary : textMuted }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassView>

          {event?.rsvp_tiers?.length > 0 && (
            <VIPTierSelector
              event={event}
              primary={primary}
              textColor={textColor}
              muted={textMuted}
              surface={surface}
              onBooked={() => {}}
            />
          )}

          {isSoldOut && event?.id && (
            <WaitlistButton
              eventId={event.id}
              primary={primary}
              muted={textMuted}
              surface={surface}
            />
          )}

          {Array.isArray(event?.tags) && event.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {event.tags.map((tag, i) => (
                <View key={i} style={[styles.tagPill, { borderColor: primary + '55', backgroundColor: primary + '12' }]}>
                  <Text style={[styles.tagText, { color: primary }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {event?.id && (
            <EventReactions eventId={event.id} primary={primary} muted={textMuted} />
          )}

          {!!event?.ticket_url && (
            <TouchableOpacity
              style={[styles.ticketBtn, { backgroundColor: primary }]}
              onPress={openTickets}
              activeOpacity={0.85}
            >
              <Feather name="external-link" size={16} color="#000" />
              <Text style={styles.ticketBtnText}>Get Passes</Text>
            </TouchableOpacity>
          )}

          {/* Reminder + Check In row */}
          {user && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0 }}>
              <TouchableOpacity
                style={[styles.checkInBtn, {
                  backgroundColor: checkedIn ? '#10b981' : primary,
                  opacity: checkingIn ? 0.7 : 1,
                  flex: 1,
                }]}
                onPress={handleCheckIn}
                disabled={checkingIn || checkedIn}
                activeOpacity={0.85}
              >
                <Feather name={checkedIn ? 'check-circle' : 'map-pin'} size={16} color="#000" />
                <Text style={styles.checkInBtnText}>
                  {checkingIn ? 'Touching Down...' : checkedIn ? 'Touched Down ✓' : 'Touch Down'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.checkInBtn, {
                  backgroundColor: hasReminder ? `${primary}30` : 'transparent',
                  borderWidth: 1,
                  borderColor: hasReminder ? primary : 'rgba(255,255,255,0.2)',
                  opacity: settingReminder ? 0.6 : 1,
                }]}
                onPress={handleToggleReminder}
                disabled={settingReminder}
                activeOpacity={0.85}
              >
                <Feather name={hasReminder ? 'bell-off' : 'bell'} size={16} color={hasReminder ? primary : textMuted} />
                <Text style={[styles.checkInBtnText, { color: hasReminder ? primary : textMuted }]}>
                  {hasReminder ? 'Reminder On' : 'Remind Me'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Contextual ads based on event phase */}
          {event && <EventContextualAds event={event} />}

          <View style={styles.sectionDivider} />
          <EventScheduleSection
            event={event}
            primary={primary}
            textColor={textColor}
            muted={textMuted}
            bg={background}
          />

          <View style={styles.sectionDivider} />
          {event?.id && (
            <CarpoolBoard
              event={event}
              primary={primary}
              textColor={textColor}
              muted={textMuted}
              surface={surface}
            />
          )}

          <View style={styles.sectionDivider} />
          {event?.id && <EchoSection eventId={event.id} onAuthRequired={onAuthRequired} />}

          <View style={styles.sectionDivider} />
          {event?.id && <RatingSection eventId={event.id} onAuthRequired={onAuthRequired} />}

          {/* ── Organizer live dashboard ──────────────────────────── */}
          {event?.id && isOrganiser && (
            <OrganizerDashboard
              event={event}
              primary={primary}
              textColor={textColor}
              surface={surface}
              muted={textMuted}
            />
          )}

          {/* ── Co-management action bar ──────────────────────────── */}
          {event?.id && (isOrganiser || isCoHost) && (
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 }}>
              {isOrganiser && (
                <TouchableOpacity
                  style={[styles.mgmtBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
                  onPress={() => setRoleManagerVisible(true)}
                >
                  <Feather name="users" size={14} color={primary} />
                  <Text style={[styles.mgmtBtnText, { color: primary }]}>Manage Team</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.mgmtBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
                onPress={() => setChatVisible(true)}
              >
                <Feather name="message-square" size={14} color={primary} />
                <Text style={[styles.mgmtBtnText, { color: primary }]}>Event Chat</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Tab switcher: Info / Polls / Playlist ──────────────── */}
          {event?.id && (
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: `${primary}20` }}>
              {['info', 'polls', 'playlist'].map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === tab ? `${primary}20` : 'transparent' }}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={{ color: activeTab === tab ? primary : textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {tab === 'info' ? 'Info' : tab === 'polls' ? 'Polls' : 'Playlist'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.sectionDivider} />

          {/* ── Polls tab ──────────────────────────────────────────── */}
          {activeTab === 'polls' && event?.id && (
            <EventPollSection eventId={event.id} canPost={canPost} />
          )}

          {/* ── Playlist tab ───────────────────────────────────────── */}
          {activeTab === 'playlist' && event?.id && (
            <EventPlaylistSection eventId={event.id} canModerate={canModerate} />
          )}

          {/* ── Info tab: existing sections ────────────────────────── */}
          {(activeTab === 'info') && event?.id && (
            <LiveEventUpdates
              eventId={event.id}
              organiserId={organizer?.id}
              canPost={canPost}
              primary={primary}
              textColor={textColor}
              muted={textMuted}
              surface={surface}
            />
          )}

          {event?.id && <EventGallery eventId={event.id} />}

          <View style={styles.sectionDivider} />
          {media.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>EVENT PREVIEW</Text>
              <MediaViewer media={media} />
            </View>
          )}

          <TouchableOpacity style={styles.reportBtn} onPress={handleReport}>
            <Feather name="flag" size={12} color={textMuted} />
            <Text style={[styles.reportText, { color: textMuted }]}>Report Gruv</Text>
          </TouchableOpacity>

        </ScrollView>

        <ReportModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          targetId={event?.id}
          targetType="event"
        />

        {/* Chat FAB — always visible for signed-in users */}
        {user && event?.id && (
          <TouchableOpacity
            style={[styles.chatFab, { backgroundColor: primary, bottom: insets.bottom + 16 }]}
            onPress={() => setChatVisible(true)}
            activeOpacity={0.85}
          >
            <Feather name="message-circle" size={22} color="#000" />
          </TouchableOpacity>
        )}

        <EventChatRoom
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          eventId={event?.id}
          eventTitle={event?.title}
          canModerate={canModerate}
        />

        {isOrganiser && event?.id && (
          <EventRoleManager
            visible={roleManagerVisible}
            onClose={() => setRoleManagerVisible(false)}
            eventId={event.id}
            organiserId={event.author_id ?? event.profiles?.id}
          />
        )}

        {/* Who's Going Modal */}
        <Modal visible={whoGoingVisible} animationType="slide" transparent onRequestClose={() => setWhoGoingVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <View style={[styles.whoGoingSheet, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.whoGoingTitle, { color: textColor }]}>Who's Vibing ({whoGoing.length})</Text>
                <TouchableOpacity onPress={() => setWhoGoingVisible(false)}>
                  <Feather name="x" size={22} color={textColor} />
                </TouchableOpacity>
              </View>
              {whoGoing.length === 0
                ? <Text style={[{ color: textMuted, textAlign: 'center', paddingVertical: 32, fontSize: 14 }]}>No one has Vibed yet — be first!</Text>
                : whoGoing.map(p => (
                  <View key={p.id} style={[styles.whoGoingRow, { borderBottomColor: `${primary}15` }]}>
                    {p.avatar_url
                      ? <Image source={{ uri: p.avatar_url }} style={styles.whoGoingAvatar} />
                      : <View style={[styles.whoGoingAvatar, { backgroundColor: ['#0891b2', '#7c3aed', '#059669', '#dc2626'][(p.username?.charCodeAt(0) || 0) % 4], alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontWeight: '900' }}>{(p.username || 'V')[0].toUpperCase()}</Text>
                      </View>
                    }
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[{ color: textColor, fontWeight: '700', fontSize: 14 }]}>@{p.username}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={[{ color: primary, fontSize: 11, fontWeight: '600' }]}>⚡ {p.vibe_score || 0} pts</Text>
                        {p.social_integrity_score != null && (
                          <View style={[styles.sisBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
                            <Text style={{ color: primary, fontSize: 9, fontWeight: '700' }}>SIS {p.social_integrity_score}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              }
            </View>
          </View>
        </Modal>
      </View>
      {dmOpen && (
        <DirectMessageModal
          visible={dmOpen}
          recipient={organizer}
          onClose={() => setDmOpen(false)}
        />)}
    </Modal>
  );
};

const CountdownUnit = ({ value, label, primary, textColor }) => (
  <View style={{ alignItems: 'center', minWidth: 28 }}>
    <Text style={{ color: primary, fontSize: 18, fontWeight: '900', lineHeight: 20 }}>
      {String(value).padStart(2, '0')}
    </Text>
    <Text style={{ color: textColor, fontSize: 8, fontWeight: '700', opacity: 0.5, letterSpacing: 0.5 }}>{label}</Text>
  </View>
);

const MetaChip = ({ icon, label, color, pressable }) => (
  <View style={[styles.metaChip, pressable && { borderBottomWidth: 1, borderBottomColor: color + '88' }]}>
    <Feather name={icon} size={12} color={color} />
    <Text style={[styles.metaChipText, { color: pressable ? color : 'rgba(255,255,255,0.75)' }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    height: HERO_H,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroBtn: {
    position: 'absolute',
    top: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    left: 14,
  },
  shareBtn: {
    right: 14,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#0d1112',
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0d1112',
  },
  organizerMeta: {
    flex: 1,
    gap: 4,
  },
  organizerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  vibeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vibeScore: {
    fontSize: 11,
    fontWeight: '700',
  },
  followBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageOrganizerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  capacityCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  capacityLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  spotsLeft: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  rsvpCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ticketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 4,
  },
  ticketBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 4,
    marginTop: 8,
  },
  checkInBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 20,
  },
  vibePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  vibeCountText: { fontSize: 12, fontWeight: '800' },
  countdownBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  countdownSep: { fontSize: 16, fontWeight: '900', marginBottom: 6 },
  countdownLabel: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  whoGoingSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' },
  whoGoingTitle: { fontSize: 17, fontWeight: '900' },
  whoGoingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  whoGoingAvatar: { width: 42, height: 42, borderRadius: 21 },
  sisBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 24,
    paddingVertical: 8,
  },
  mgmtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mgmtBtnText: { fontSize: 12, fontWeight: '900' },
  chatFab: {
    position: 'absolute',
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  reportText: {
    fontSize: 12,
  },
  ticketSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 14,
  },
  ticketSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  ticketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ticketTier: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ticketLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  ticketValue: {
    fontSize: 15,
    fontWeight: '900',
  },
});
