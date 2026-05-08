/**
 * ViberProfileModal — Full user profile sheet.
 * Loads real data, records profile views, sends notifications,
 * handles follow/unfollow, shows their events and interests.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator, Animated, Linking, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { NotificationService } from '../services/notificationService';
import { DirectMessageModal } from './DirectMessageModal';

const RANK_LABELS = [
  { min: 0,     max: 100,    name: 'Viber',       color: '#94a3b8' },
  { min: 101,   max: 500,    name: 'Elite Viber', color: '#06b6d4' },
  { min: 501,   max: 2000,   name: 'Royal Viber', color: '#8b5cf6' },
  { min: 2001,  max: 10000,  name: 'Gruv Master', color: '#f59e0b' },
  { min: 10001, max: Infinity, name: 'Grand Viber', color: '#ef4444' },
];
const getRank = (score) => RANK_LABELS.find(r => score >= r.min && score <= r.max) || RANK_LABELS[0];

// ── Mini event card inside the profile sheet ─────────────────────────────────
const ProfileEventCard = ({ ev, primary, textColor, muted, onPress }) => {
  const imgUrl = ev.media?.[0]?.url || (typeof ev.media?.[0] === 'string' ? ev.media[0] : null);
  const catColor = ev.category_color || primary;
  return (
    <TouchableOpacity style={[pec.wrap, { borderColor: `${catColor}25` }]} onPress={onPress} activeOpacity={0.85}>
      {imgUrl
        ? <Image source={{ uri: imgUrl }} style={pec.img} resizeMode="cover" />
        : <View style={[pec.img, { backgroundColor: `${catColor}15`, alignItems: 'center', justifyContent: 'center' }]}><Feather name="image" size={16} color={`${catColor}60`} /></View>
      }
      <View style={pec.info}>
        <Text style={[pec.title, { color: textColor }]} numberOfLines={1}>{ev.title}</Text>
        <View style={pec.metaRow}>
          {ev.event_date ? (
            <Text style={[pec.meta, { color: muted }]}>
              {new Date(ev.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
            </Text>
          ) : null}
          {ev.venue_name ? <Text style={[pec.meta, { color: muted }]}>· {ev.venue_name}</Text> : null}
        </View>
      </View>
      <View style={[pec.vibeBadge, { backgroundColor: `${primary}15` }]}>
        <Feather name="zap" size={10} color={primary} />
        <Text style={[pec.vibeText, { color: primary }]}>{ev.vibe_count || 0}</Text>
      </View>
    </TouchableOpacity>
  );
};

const pec = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, marginBottom: 8, overflow: 'hidden', gap: 10, padding: 10 },
  img: { width: 52, height: 52, borderRadius: 10 },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  metaRow: { flexDirection: 'row', gap: 4 },
  meta: { fontSize: 11 },
  vibeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  vibeText: { fontSize: 11, fontWeight: '800' },
});

// ── Main component ────────────────────────────────────────────────────────────
export const ViberProfileModal = ({ visible, user: propUser, userId: propUserId, onClose, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('events');
  const [dmOpen, setDmOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#131a1c';

  const targetId = propUserId || propUser?.id;
  const isOwnProfile = currentUser?.id === targetId;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
      if (targetId) loadProfile(targetId);
    } else {
      slideAnim.setValue(300);
      setProfile(null);
      setEvents([]);
      setActiveTab('events');
    }
  }, [visible, targetId]);

  const loadProfile = useCallback(async (uid) => {
    setLoading(true);
    try {
      const [profileRes, eventsRes, followersRes, followingRes, isFollowingRes] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('events').select('id,title,media,event_date,venue_name,category,category_color,vibe_count').eq('author_id', uid).order('created_at', { ascending: false }).limit(10),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
        currentUser ? supabase.from('follows').select('id').eq('follower_id', currentUser.id).eq('following_id', uid).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        setProfile(profileRes.value.data);
      } else if (propUser) {
        setProfile(propUser);
      }
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.data || []);
      if (followersRes.status === 'fulfilled') setFollowerCount(followersRes.value.count || 0);
      if (followingRes.status === 'fulfilled') setFollowingCount(followingRes.value.count || 0);
      if (isFollowingRes.status === 'fulfilled') setIsFollowing(!!isFollowingRes.value.data);

      // Record profile view (don't await — fire and forget)
      if (currentUser && uid !== currentUser.id) {
        recordProfileView(uid, currentUser.id);
      }
    } catch {}
    setLoading(false);
  }, [currentUser, propUser]);

  const recordProfileView = async (viewedUserId, viewerUserId) => {
    try {
      // Store in a dedicated table if exists, otherwise just send notification
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', viewerUserId)
        .single();

      const viewerName = viewerProfile?.username || 'Someone';

      // Deduplicate: only notify once per hour per viewer per profile
      const since = new Date(Date.now() - 3600000).toISOString();
      const { data: recent } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', viewedUserId)
        .eq('type', 'profile_view')
        .eq('data->viewer_id', viewerUserId)
        .gte('created_at', since)
        .maybeSingle();

      if (!recent) {
        await NotificationService.send(viewedUserId, {
          type: 'profile_view',
          title: `${viewerName} viewed your profile`,
          body: 'Tap to see who visited',
          data: { viewer_id: viewerUserId, viewer_username: viewerName, viewer_avatar: viewerProfile?.avatar_url || null },
        });
      }
    } catch {}
  };

  const handleFollow = async () => {
    if (!currentUser) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount(c => wasFollowing ? Math.max(0, c - 1) : c + 1);

    try {
      if (wasFollowing) {
        await supabase.from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetId);
      } else {
        await supabase.from('follows')
          .upsert({ follower_id: currentUser.id, following_id: targetId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
        // Notify the user they were followed
        const { data: myProfile } = await supabase.from('profiles').select('username').eq('id', currentUser.id).single();
        await NotificationService.notifyFollow(targetId, myProfile?.username || 'Someone');
      }
    } catch {
      // Rollback optimistic update
      setIsFollowing(wasFollowing);
      setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
    }
    setFollowLoading(false);
  };

  const rank = profile ? getRank(profile.vibe_score || 0) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View
          style={[s.sheet, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Drag handle */}
          <View style={[s.handle, { backgroundColor: `${primary}30` }]} />

          {/* Close */}
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color={muted} />
          </TouchableOpacity>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
              <ActivityIndicator color={primary} size="large" />
            </View>
          ) : !profile ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
              <Feather name="user-x" size={40} color={muted} />
              <Text style={{ color: muted, marginTop: 12, fontSize: 14 }}>Profile not found</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

              {/* Cover / header area */}
              <View style={[s.coverArea, { backgroundColor: `${primary}10` }]}>
                {profile.cover_url
                  ? <Image source={{ uri: profile.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <View style={[s.coverGradient, { backgroundColor: rank?.color ? `${rank.color}20` : `${primary}15` }]} />
                }
              </View>

              {/* Avatar + actions row */}
              <View style={s.avatarRow}>
                <View style={s.avatarWrap}>
                  {profile.avatar_url
                    ? <Image source={{ uri: profile.avatar_url }} style={[s.avatar, { borderColor: rank?.color || primary }]} />
                    : <View style={[s.avatar, { borderColor: rank?.color || primary, backgroundColor: '#1a2428', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>
                          {(profile.username || '?').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                  }
                  {profile.is_online && <View style={s.onlineDot} />}
                </View>

                {!isOwnProfile && currentUser && (
                  <View style={s.actionBtns}>
                    <TouchableOpacity
                      style={[s.followBtn, isFollowing
                        ? { borderColor: `${primary}50`, borderWidth: 1.5, backgroundColor: 'transparent' }
                        : { backgroundColor: primary }
                      ]}
                      onPress={handleFollow}
                      disabled={followLoading}
                    >
                      {followLoading
                        ? <ActivityIndicator size="small" color={isFollowing ? primary : '#000'} />
                        : <>
                            <Feather name={isFollowing ? 'user-check' : 'user-plus'} size={13} color={isFollowing ? primary : '#000'} />
                            <Text style={[s.followBtnText, { color: isFollowing ? primary : '#000' }]}>
                              {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                          </>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.msgBtn, { borderColor: `${primary}40` }]}
                      onPress={() => setDmOpen(true)}
                    >
                      <Feather name="message-circle" size={16} color={primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Name + rank */}
              <View style={s.nameSection}>
                <Text style={[s.username, { color: textColor }]}>@{profile.username || 'viber'}</Text>
                {profile.display_name ? (
                  <Text style={[s.displayName, { color: muted }]}>{profile.display_name}</Text>
                ) : null}
                {rank && (
                  <View style={[s.rankBadge, { backgroundColor: `${rank.color}20`, borderColor: `${rank.color}50` }]}>
                    <Feather name="star" size={10} color={rank.color} />
                    <Text style={[s.rankText, { color: rank.color }]}>{rank.name}</Text>
                  </View>
                )}
                {profile.bio ? (
                  <Text style={[s.bio, { color: muted }]}>{profile.bio}</Text>
                ) : null}
                {profile.location ? (
                  <View style={s.locationRow}>
                    <Feather name="map-pin" size={11} color={muted} />
                    <Text style={[s.locationText, { color: muted }]}>{profile.location}</Text>
                  </View>
                ) : null}
              </View>

              {/* Stats */}
              <View style={[s.statsRow, { borderColor: `${primary}15` }]}>
                {[
                  { label: 'Vibe Score', value: profile.vibe_score || 0, icon: 'zap', color: primary },
                  { label: 'Followers',  value: followerCount,            icon: 'users', color: '#10b981' },
                  { label: 'Following',  value: followingCount,           icon: 'user-check', color: '#8b5cf6' },
                  { label: 'Gruvs',      value: events.length,            icon: 'calendar', color: '#f59e0b' },
                ].map((stat, i, arr) => (
                  <React.Fragment key={stat.label}>
                    <View style={s.stat}>
                      <Feather name={stat.icon} size={12} color={stat.color} style={{ marginBottom: 4 }} />
                      <Text style={[s.statVal, { color: stat.color }]}>
                        {stat.value > 999 ? `${(stat.value / 1000).toFixed(1)}k` : stat.value}
                      </Text>
                      <Text style={[s.statLab, { color: muted }]}>{stat.label}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={[s.statDiv, { backgroundColor: `${primary}15` }]} />}
                  </React.Fragment>
                ))}
              </View>

              {/* Interests */}
              {(profile.interests?.length > 0) && (
                <View style={s.section}>
                  <Text style={[s.sectionLabel, { color: muted }]}>INTERESTS</Text>
                  <View style={s.tagRow}>
                    {profile.interests.slice(0, 10).map(tag => (
                      <View key={tag} style={[s.tag, { backgroundColor: `${primary}12`, borderColor: `${primary}28` }]}>
                        <Text style={[s.tagText, { color: primary }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Tab: Events */}
              <View style={s.tabRow}>
                {['events', 'about'].map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[s.tab, activeTab === tab && { borderBottomColor: primary, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[s.tabText, { color: activeTab === tab ? primary : muted }]}>
                      {tab === 'events' ? `Events (${events.length})` : 'About'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ paddingHorizontal: 16 }}>
                {activeTab === 'events' && (
                  events.length === 0 ? (
                    <View style={s.emptySection}>
                      <Feather name="calendar" size={28} color={muted} style={{ opacity: 0.5 }} />
                      <Text style={[s.emptyText, { color: muted }]}>No events posted yet</Text>
                    </View>
                  ) : (
                    events.map(ev => (
                      <ProfileEventCard
                        key={ev.id}
                        ev={ev}
                        primary={primary}
                        textColor={textColor}
                        muted={muted}
                        onPress={() => { onClose(); onNavigateToEvent?.(ev); }}
                      />
                    ))
                  )
                )}

                {activeTab === 'about' && (
                  <View style={{ gap: 14, paddingVertical: 8 }}>
                    {[
                      { icon: 'info', label: 'Bio', value: profile.bio || 'No bio added yet' },
                      { icon: 'map-pin', label: 'Location', value: profile.location || 'Location not set' },
                      { icon: 'zap', label: 'Identity Mode', value: (profile.identity_mode || 'public').charAt(0).toUpperCase() + (profile.identity_mode || 'public').slice(1) },
                    ].map(item => (
                      <View key={item.label} style={[s.aboutRow, { borderBottomColor: `${primary}10` }]}>
                        <Feather name={item.icon} size={14} color={muted} />
                        <View style={{ flex: 1 }}>
                          <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 }]}>{item.label.toUpperCase()}</Text>
                          <Text style={[{ color: textColor, fontSize: 13 }]}>{item.value}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>

    <DirectMessageModal
      visible={dmOpen}
      onClose={() => setDmOpen(false)}
      recipient={profile}
    />
  );
};

const SHEET_MAX_H = '90%';

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { maxHeight: SHEET_MAX_H, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, overflow: 'hidden' },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 6 },
  closeBtn: { position: 'absolute', top: 14, right: 16, zIndex: 10, padding: 8 },

  coverArea: { height: 100, overflow: 'hidden' },
  coverGradient: { ...StyleSheet.absoluteFillObject },

  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -36, marginBottom: 8 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 3 },
  onlineDot: { position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2.5, borderColor: '#0d1112' },
  actionBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, minWidth: 100, justifyContent: 'center' },
  followBtnText: { fontWeight: '900', fontSize: 12 },
  msgBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },

  nameSection: { paddingHorizontal: 16, marginBottom: 14, gap: 4 },
  username: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  displayName: { fontSize: 13 },
  rankBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginTop: 2 },
  rankText: { fontSize: 11, fontWeight: '900' },
  bio: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { fontSize: 12 },

  statsRow: { flexDirection: 'row', marginHorizontal: 16, borderWidth: 1, borderRadius: 16, paddingVertical: 14, marginBottom: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLab: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  statDiv: { width: 1, height: 40 },

  section: { paddingHorizontal: 16, marginBottom: 14 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '700' },

  tabRow: { flexDirection: 'row', marginHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '800' },

  emptySection: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 13 },

  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
});
