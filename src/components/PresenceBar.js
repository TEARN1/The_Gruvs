/**
 * PresenceBar — "Who Was There" live check-in component.
 * Allows users to check in to events, see who else is present,
 * and flag interest in other attendees (stars → mutual match → DM room).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { UserManager, GeoUtils } from '../services/dataFlow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';

// ---------------------------------------------------------------------------
// Initials avatar fallback
// ---------------------------------------------------------------------------
const InitialsAvatar = ({ name = '', size = 40, color = '#00f2ff' }) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase();
  return (
    <View style={[
      av.wrap,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}30`, borderColor: `${color}60` },
    ]}>
      <Text style={[av.text, { color, fontSize: size * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
};

const av = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  text: { fontWeight: '900' },
});

// ---------------------------------------------------------------------------
// PresenceBar
// ---------------------------------------------------------------------------
export const PresenceBar = ({
  eventId,
  eventEndTime,
  eventLat,
  eventLon,
  onAuthRequired,
  primary = '#00f2ff',
  muted = 'rgba(255,255,255,0.45)',
  textColor = '#fff',
  bg = '#0d1112',
}) => {
  const { user, profile } = useAuth();
  const { show: showToast } = useToast();

  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [starredIds, setStarredIds] = useState(new Set());
  const [matchIds, setMatchIds] = useState(new Set());

  const channelRef = useRef(null);

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  const expiresAt = () => {
    if (eventEndTime) return new Date(eventEndTime).toISOString();
    const t = new Date();
    t.setHours(t.getHours() + 4);
    return t.toISOString();
  };

  const sortCheckins = useCallback((rows, loc) => {
    return [...rows].sort((a, b) => {
      // proximity first (if location available)
      if (loc && a.lat != null && b.lat != null) {
        const dA = GeoUtils.getDistance(loc.latitude, loc.longitude, a.lat, a.lon);
        const dB = GeoUtils.getDistance(loc.latitude, loc.longitude, b.lat, b.lon);
        if (Math.abs(dA - dB) > 0.1) return dA - dB;
      }

      // compatibility — matching interest tags count
      const myTags = new Set(profile?.interests || []);
      const tagsA = (a.profiles?.interests || []).filter(t => myTags.has(t)).length;
      const tagsB = (b.profiles?.interests || []).filter(t => myTags.has(t)).length;
      return tagsB - tagsA;
    });
  }, [profile]);

  // ------------------------------------------------------------------
  // Fetch checkins
  // ------------------------------------------------------------------
  const fetchCheckins = useCallback(async (loc = userLocation) => {
    if (!eventId) return;
    const { data, error } = await supabase
      .from('live_checkins')
      .select('*, profiles(id, username, avatar_url, interests, lat, lon, identity_mode, is_beacon_active, is_online, last_seen)')
      .eq('event_id', eventId)
      .gte('checked_in_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString());

    if (error) {
      console.log('PresenceBar fetch error:', error.message);
      setLoading(false);
      return;
    }

    const sorted = sortCheckins(data || [], loc);
    setCheckins(sorted);

    if (user?.id) {
      setAlreadyCheckedIn((data || []).some(c => c.user_id === user.id));
    }

    setLoading(false);
  }, [eventId, user?.id, userLocation, sortCheckins]);

  // ------------------------------------------------------------------
  // Fetch stars & mutual matches
  // ------------------------------------------------------------------
  const fetchStars = useCallback(async () => {
    if (!user?.id || !eventId) return;

    // Only fetch rows involving the current user — avoids exposing third-party star data
    const [{ data: iStarredData }, { data: theyStarredData }] = await Promise.all([
      supabase.from('path_stars').select('to_user_id').eq('event_id', eventId).eq('from_user_id', user.id),
      supabase.from('path_stars').select('from_user_id').eq('event_id', eventId).eq('to_user_id', user.id),
    ]);

    const iStarred  = new Set((iStarredData  || []).map(r => r.to_user_id));
    const theyStarred = new Set((theyStarredData || []).map(r => r.from_user_id));
    const mutual = new Set([...iStarred].filter(id => theyStarred.has(id)));

    setStarredIds(iStarred);
    setMatchIds(mutual);
  }, [user?.id, eventId]);

  const getCommonTags = (checkin) => {
    const myTags = new Set(profile?.interests || []);
    return (checkin.profiles?.interests || []).filter(t => myTags.has(t));
  };

  // ------------------------------------------------------------------
  // Mount: get location + fetch data + subscribe realtime
  // ------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          setUserLocation(loc.coords);
          await fetchCheckins(loc.coords);
        }
      } catch (_) { }
    })();

    // Realtime subcription
    const channel = supabase.channel(`live_checkins_${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_checkins', filter: `event_id=eq.${eventId}` },
        () => { fetchCheckins(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'live_checkins', filter: `event_id=eq.${eventId}` },
        () => { fetchCheckins(); }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Re-sort when location changes
  useEffect(() => {
    if (userLocation && checkins.length > 0) {
      fetchCheckins(userLocation);
    }
  }, [userLocation]);

  // ------------------------------------------------------------------
  // Check In
  // ------------------------------------------------------------------
  const handleCheckIn = async () => {
    if (!user?.id) {
      onAuthRequired ? onAuthRequired() : showToast('Sign in to check in', 'info');
      return;
    }
    if (alreadyCheckedIn) {
      showToast('You are already checked in', 'info');
      return;
    }

    setCheckingIn(true);
    try {
      // Request a fresh, high-accuracy location fix
      const { status: currentStatus } = await Location.requestForegroundPermissionsAsync();
      if (currentStatus !== 'granted') throw new Error('Location permission required');

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });

      setUserLocation(loc.coords);

      // Strict proximity check
      if (eventLat && eventLon) {
        const dist = GeoUtils.getDistance(loc.coords.latitude, loc.coords.longitude, Number(eventLat), Number(eventLon));
        if (dist > 2.0) throw new Error(`You're too far (${dist.toFixed(1)}km). Must be within 2km to Touch Down.`);
      }

      const identityMode = (await AsyncStorage.getItem('gruv_identity_mode')) || 'public';
      const { error } = await supabase.from('live_checkins').insert({
        event_id: eventId,
        user_id: user.id,
        checked_in_at: new Date().toISOString(),
        identity_mode: identityMode,
        expires_at: expiresAt(),
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Checked in!', 'success');
      setAlreadyCheckedIn(true);
      fetchCheckins();
    } catch (e) {
      showToast(e.message || 'Check-in failed', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  // ------------------------------------------------------------------
  // Star
  // ------------------------------------------------------------------
  const handleStar = async (toUserId) => {
    if (!user?.id) {
      showToast('Sign in to star people', 'info');
      return;
    }
    if (starredIds.has(toUserId)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { error } = await supabase.from('path_stars').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      event_id: eventId,
    });

    if (error) {
      showToast('Could not star — try again', 'error');
      return;
    }

    setStarredIds(prev => new Set([...prev, toUserId]));
    showToast('Star sent!', 'vibe');

    // Check for mutual star
    const { data: mutual } = await supabase
      .from('path_stars')
      .select('id')
      .eq('from_user_id', toUserId)
      .eq('to_user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle();

    if (mutual) {
      // Create DM room
      await supabase.from('dm_rooms').upsert(
        {
          participant_1: user.id < toUserId ? user.id : toUserId,
          participant_2: user.id < toUserId ? toUserId : user.id,
        },
        { onConflict: 'participant_1,participant_2', ignoreDuplicates: true }
      );
      setMatchIds(prev => new Set([...prev, toUserId]));
      showToast('💬 Mutual match! A chat room is open for 48h', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const mutualTagCount = (checkin) => {
    const myTags = new Set(profile?.interests || []);
    return (checkin.profiles?.interests || []).filter(t => myTags.has(t)).length;
  };

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: `${bg}` }]}>
        <ActivityIndicator color={primary} size="small" style={{ marginVertical: 16 }} />
      </View>
    );
  }

  return (
    <View style={[s.root, { borderColor: `${primary}18` }]}>
      {/* Header row */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.countPill, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
            <View style={[s.liveDot, { backgroundColor: primary }]} />
            <Text style={[s.countText, { color: primary }]}>
              {checkins.length} {checkins.length === 1 ? 'person' : 'people'} here now
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            s.checkInBtn,
            {
              backgroundColor: alreadyCheckedIn ? `${primary}20` : primary,
              borderColor: primary,
            },
          ]}
          onPress={handleCheckIn}
          disabled={checkingIn || alreadyCheckedIn}
          activeOpacity={0.8}
        >
          {checkingIn ? (
            <ActivityIndicator color={alreadyCheckedIn ? primary : '#000'} size="small" />
          ) : (
            <>
              <Feather
                name={alreadyCheckedIn ? 'check-circle' : 'map-pin'}
                size={13}
                color={alreadyCheckedIn ? primary : '#000'}
              />
              <Text style={[
                s.checkInText,
                { color: alreadyCheckedIn ? primary : '#000' },
              ]}>
                {alreadyCheckedIn ? 'CHECKED IN' : 'CHECK IN'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Presence cards */}
      {checkins.length === 0 ? (
        <View style={s.emptyState}>
          <Feather name="users" size={28} color={`${primary}40`} />
          <Text style={[s.emptyText, { color: muted }]}>Be the first to check in</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {checkins.map(checkin => {
            const isGhost = (checkin.profiles?.identity_mode || checkin.identity_mode) === 'ghost';
            const isMe = checkin.user_id === user?.id;
            const starred = starredIds.has(checkin.user_id);
            const matched = matchIds.has(checkin.user_id);
            const commonTags = getCommonTags(checkin);
            const tags = commonTags.length;
            const username = checkin.profiles?.username || 'Anon';
            const avatar = checkin.profiles?.avatar_url;
            const checkedTime = new Date(checkin.checked_in_at).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit',
            });

            return (
              <View
                key={checkin.id}
                style={[
                  s.card,
                  {
                    backgroundColor: `${bg}F2`,
                    borderColor: matched
                      ? `${primary}80`
                      : isGhost
                        ? 'rgba(255,255,255,0.08)'
                        : `${primary}22`,
                  },
                ]}
              >
                {isGhost ? (
                  <View style={[s.avatar, { borderColor: 'rgba(255,255,255,0.15)' }]}> 
                    <Text style={s.ghostEmoji}>👻</Text>
                  </View>
                ) : avatar ? (
                  <Image source={{ uri: avatar }} style={[s.avatar, { borderColor: `${primary}50` }]} />
                ) : (
                  <InitialsAvatar name={username} size={48} color={primary} />
                )}

          {/* Name */}
          <Text style={[s.username, { color: isGhost ? muted : textColor }]} numberOfLines={1}>
            {isGhost ? '👻 Ghost' : username}
            {isMe ? ' (you)' : ''}
          </Text>

          {/* Check-in time */}
          <Text style={[s.time, { color: muted }]}>{checkedTime}</Text>

          {/* Mutual tags badge */}
          {!isGhost && !isMe && tags > 0 && (
            <View style={[s.tagBadge, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
              <Text style={[s.tagBadgeText, { color: primary }]}>
                {tags} mutual {tags === 1 ? 'interest' : 'interests'}
              </Text>
            </View>
          )}

          {/* Match pill */}
          {matched && (
            <View style={[s.matchPill, { backgroundColor: `${primary}25`, borderColor: primary }]}>
              <Text style={[s.matchText, { color: primary }]}>💬 Match!</Text>
            </View>
          )}

          {/* Star button */}
          {!isMe && !isGhost && (
            <TouchableOpacity
              style={[
                s.starBtn,
                {
                  backgroundColor: starred ? `${primary}25` : 'rgba(255,255,255,0.06)',
                  borderColor: starred ? primary : 'rgba(255,255,255,0.15)',
                },
              ]}
              onPress={() => handleStar(checkin.user_id)}
              disabled={starred}
              activeOpacity={0.75}
            >
              <Text style={s.starEmoji}>{starred ? '⭐' : '☆'}</Text>
              <Text style={[s.starLabel, { color: starred ? primary : muted }]}>
                {starred ? 'Starred' : 'Star'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
          })}
        </ScrollView>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 14,
    marginVertical: 10,
    overflow: 'hidden',
    ...(Platform.OS === 'android' ? { elevation: 4 } : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  countText: { fontSize: 12, fontWeight: '800' },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  checkInText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
  scroll: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 10,
  },
  card: {
    width: 120,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  ghostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ghostEmoji: { fontSize: 22 },
  username: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  time: { fontSize: 10, fontWeight: '500' },
  tagBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagBadgeText: { fontSize: 9, fontWeight: '800' },
  matchPill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchText: { fontSize: 10, fontWeight: '900' },
  starBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  starEmoji: { fontSize: 11 },
  starLabel: { fontSize: 10, fontWeight: '700' },
});
