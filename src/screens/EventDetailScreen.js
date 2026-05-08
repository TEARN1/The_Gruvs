import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, Linking, Share, Animated, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { EchoSection } from '../components/EchoSection';
import { RatingSection } from '../components/RatingSection';
import { EventGallery } from '../components/EventGallery';
import { MediaViewer } from '../components/MediaViewer';
import { useToast } from '../components/ToastNotification';
import { supabase } from '../services/supabase';
import { LocationService } from '../services/locationService';

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
  if (!price || price === 0) return 'FREE';
  return `$${parseFloat(price).toFixed(2)}`;
};

export const EventDetailScreen = ({ event, visible, onClose, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [goingCount, setGoingCount] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const primary = currentTheme?.primary || '#00f2ff';
  const background = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#ffffff';
  const textMuted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const organizer = event?.profiles || {};
  const media = event?.media_urls?.length
    ? event.media_urls.map((u) => ({ type: 'image', url: u }))
    : event?.image_url
    ? [{ type: 'image', url: event.image_url }]
    : [];

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
      if (event?.id) {
        fetchUserState();
        fetchGoingCount();
      }
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, event?.id]);

  const fetchUserState = async () => {
    if (!user || !event?.id) return;
    const [rsvpRes, followRes] = await Promise.all([
      supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', organizer.id)
        .maybeSingle(),
    ]);
    if (rsvpRes.data) setRsvpStatus(rsvpRes.data.status);
    setIsFollowing(!!followRes.data);
  };

  const fetchGoingCount = async () => {
    if (!event?.id) return;
    const { count } = await supabase
      .from('event_rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('status', 'going');
    setGoingCount(count || 0);
  };

  const handleRsvp = async (status) => {
    if (!user) { onAuthRequired?.(); return; }
    if (rsvpLoading) return;
    setRsvpLoading(true);
    const { error } = await supabase.from('event_rsvps').upsert(
      { event_id: event.id, user_id: user.id, status },
      { onConflict: 'event_id,user_id' }
    );
    if (error) {
      showToast('Could not update RSVP. Try again.', 'error');
    } else {
      const prev = rsvpStatus;
      setRsvpStatus(status);
      if (status === 'going' && prev !== 'going') setGoingCount((c) => c + 1);
      if (prev === 'going' && status !== 'going') setGoingCount((c) => Math.max(0, c - 1));
      showToast(
        status === 'going' ? "You're going!" : status === 'maybe' ? "Marked as maybe" : "RSVP removed",
        'success'
      );
    }
    setRsvpLoading(false);
  };

  const handleFollow = async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (followLoading || !organizer?.id) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', organizer.id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: organizer.id });
      setIsFollowing(true);
    }
    setFollowLoading(false);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${event?.title || 'Check out this event'} on The Gruvs${event?.ticket_url ? `\n${event.ticket_url}` : ''}`,
        title: event?.title,
      });
    } catch {}
  };

  const openMaps = () => {
    if (!event?.venue_name) return;
    const query = encodeURIComponent(event.venue_address || event.venue_name);
    Linking.openURL(`https://maps.google.com/?q=${query}`);
  };

  const openTickets = () => {
    if (event?.ticket_url) Linking.openURL(event.ticket_url);
  };

  const handleReport = () => {
    showToast('Report submitted. We will review this event.', 'info');
  };

  const handleCheckIn = async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (checkingIn || checkedIn) return;
    setCheckingIn(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    const coords = await LocationService.requestAndGet();
    const { error } = await supabase.from('live_checkins').upsert(
      {
        user_id: user.id,
        event_id: event.id,
        lat: coords?.lat ?? event.lat ?? null,
        lon: coords?.lon ?? event.lon ?? null,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_id' }
    );
    setCheckingIn(false);
    if (!error) {
      setCheckedIn(true);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      showToast("You're checked in! Your footprint is updated.", 'success');
    } else {
      showToast('Check-in failed: ' + error.message, 'error');
    }
  };

  const capacity = event?.capacity || 0;
  const spotsLeft = Math.max(0, capacity - goingCount);
  const capacityPct = capacity > 0 ? Math.min(1, goingCount / capacity) : 0;

  const RSVP_OPTIONS = [
    { key: 'going', label: 'Going', icon: 'check-circle' },
    { key: 'maybe', label: 'Maybe', icon: 'help-circle' },
    { key: 'not_going', label: 'Not Going', icon: 'x-circle' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: background }]}>

        <View style={styles.hero}>
          <MediaViewer media={media} containerWidth={undefined} />
          <View style={styles.heroScrim} pointerEvents="none" />

          {event?.category && (
            <View style={[styles.categoryBadge, { backgroundColor: primary + 'cc' }]}>
              <Text style={styles.categoryText}>{event.category.toUpperCase()}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.heroBtn, styles.closeBtn]} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.heroBtn, styles.shareBtn]} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="share-2" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyContent}>

          <View style={styles.organizerRow}>
            <View style={styles.avatarWrap}>
              {organizer.avatar_url
                ? <Image source={{ uri: organizer.avatar_url }} style={styles.avatar} />
                : <View style={[styles.avatar, { backgroundColor: ['#0891b2','#7c3aed','#059669','#dc2626'][(organizer.username?.charCodeAt(0)||0)%4], alignItems:'center', justifyContent:'center' }]}>
                    <Text style={{ color:'#fff', fontWeight:'900', fontSize:18 }}>{(organizer.username||'V')[0].toUpperCase()}</Text>
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
            >
              <Text style={[styles.followBtnText, { color: isFollowing ? '#000' : primary }]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: textColor }]}>{event?.title || 'Untitled Event'}</Text>

          {!!event?.description && (
            <Text style={[styles.description, { color: textMuted }]}>{event.description}</Text>
          )}

          <View style={styles.metaRow}>
            <MetaChip icon="calendar" label={formatDate(event?.event_date)} color={primary} />
            {!!event?.start_time && <MetaChip icon="clock" label={formatTime(event.start_time)} color={primary} />}
            {!!event?.venue_name && (
              <TouchableOpacity onPress={openMaps}>
                <MetaChip icon="map-pin" label={event.venue_name} color={primary} pressable />
              </TouchableOpacity>
            )}
            <MetaChip icon="tag" label={formatPrice(event?.price)} color={primary} />
          </View>

          {capacity > 0 && (
            <GlassView style={[styles.capacityCard, { backgroundColor: surface }]}>
              <View style={styles.capacityHeader}>
                <Text style={[styles.capacityLabel, { color: textColor }]}>
                  {goingCount} <Text style={{ color: textMuted }}>/ {capacity} going</Text>
                </Text>
                <Text style={[styles.spotsLeft, { color: spotsLeft < 10 ? '#ff6b6b' : primary }]}>
                  {spotsLeft} spots left
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={[styles.progressFill, { width: `${capacityPct * 100}%`, backgroundColor: primary }]} />
              </View>
            </GlassView>
          )}

          <GlassView style={[styles.rsvpCard, { backgroundColor: surface }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>RSVP</Text>
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

          {Array.isArray(event?.tags) && event.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {event.tags.map((tag, i) => (
                <View key={i} style={[styles.tagPill, { borderColor: primary + '55', backgroundColor: primary + '12' }]}>
                  <Text style={[styles.tagText, { color: primary }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {!!event?.ticket_url && (
            <TouchableOpacity
              style={[styles.ticketBtn, { backgroundColor: primary }]}
              onPress={openTickets}
              activeOpacity={0.85}
            >
              <Feather name="external-link" size={16} color="#000" />
              <Text style={styles.ticketBtnText}>Get Tickets</Text>
            </TouchableOpacity>
          )}

          {/* Check In button — builds user's Digital Footprint */}
          {user && (
            <TouchableOpacity
              style={[styles.checkInBtn, {
                backgroundColor: checkedIn ? '#10b981' : primary,
                opacity: checkingIn ? 0.7 : 1,
              }]}
              onPress={handleCheckIn}
              disabled={checkingIn || checkedIn}
              activeOpacity={0.85}
            >
              <Feather name={checkedIn ? 'check-circle' : 'map-pin'} size={16} color="#000" />
              <Text style={styles.checkInBtnText}>
                {checkingIn ? 'Checking in...' : checkedIn ? "Checked In ✓" : "Check In to This Event"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.sectionDivider} />
          {event?.id && <EchoSection eventId={event.id} />}

          <View style={styles.sectionDivider} />
          {event?.id && <RatingSection eventId={event.id} />}

          <View style={styles.sectionDivider} />
          {event?.id && <EventGallery eventId={event.id} />}

          <TouchableOpacity style={styles.reportBtn} onPress={handleReport}>
            <Feather name="flag" size={12} color={textMuted} />
            <Text style={[styles.reportText, { color: textMuted }]}>Report Event</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
};

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
    height: 200,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
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
    top: Platform.OS === 'ios' ? 50 : 16,
    width: 36,
    height: 36,
    borderRadius: 18,
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
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 24,
    paddingVertical: 8,
  },
  reportText: {
    fontSize: 12,
  },
});
