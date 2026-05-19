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
import { EditEventModal } from './EditEventModal';
import { UserManager, PresenceManager, AuraService, isOnline as checkOnline } from '../services/dataFlow';
import { useToast } from './ToastNotification';
import { ReportModal } from './ReportModal';

const RANK_LABELS = [
  { min: 0,     max: 100,    name: 'Viber',       color: '#94a3b8' },
  { min: 101,   max: 500,    name: 'Elite Viber', color: '#06b6d4' },
  { min: 501,   max: 2000,   name: 'Royal Viber', color: '#8b5cf6' },
  { min: 2001,  max: 10000,  name: 'Gruv Master', color: '#f59e0b' },
  { min: 10001, max: Infinity, name: 'Grand Viber', color: '#ef4444' },
];
const getRank = (score) => RANK_LABELS.find(r => score >= r.min && score <= r.max) || RANK_LABELS[0];

const fmtLastSeen = (ts) => {
  if (!ts) return null;
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

// ── Mini event card inside the profile sheet ─────────────────────────────────
const ProfileEventCard = ({ ev, primary, textColor, muted, onPress }) => {
  const imgUrl = ev.media_urls?.[0] ||
    ev.media?.find(m => m?.type === 'image')?.url ||
    (typeof ev.media?.[0] === 'string' ? ev.media[0] : null);
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
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('events');
  const [dmOpen, setDmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followingList, setFollowingList] = useState([]);
  const [followingModalVisible, setFollowingModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [platformStats, setPlatformStats] = useState({ vibers: 0, gruvs: 0 });
  const slideAnim = useRef(new Animated.Value(300)).current;
  const presenceUnsubRef = useRef(null);

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
      // Subscribe to real-time online status
      if (targetId) {
        presenceUnsubRef.current = PresenceManager.subscribeToUser(targetId, (online) => setIsOnline(online));
      }
    } else {
      slideAnim.setValue(300);
      setProfile(null);
      setEvents([]);
      setActiveTab('events');
      setIsMutual(false);
      setIsOnline(false);
      setFollowersList([]);
      setFollowingList([]);
      presenceUnsubRef.current?.();
      presenceUnsubRef.current = null;
    }
    return () => { presenceUnsubRef.current?.(); presenceUnsubRef.current = null; };
  }, [visible, targetId]);

  const loadProfile = useCallback(async (uid) => {
    setLoading(true);
    try {
      const [profileRes, eventsRes, followersRes, followingRes, isFollowingRes, mutualRes] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('events').select('id,title,media,media_urls,event_date,venue_name,category,category_color,vibe_count').eq('author_id', uid).order('created_at', { ascending: false }).limit(10),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
        currentUser ? supabase.from('follows').select('id').eq('follower_id', currentUser.id).eq('following_id', uid).maybeSingle() : Promise.resolve({ data: null }),
        currentUser ? supabase.from('follows').select('id').eq('follower_id', uid).eq('following_id', currentUser.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      // Platform-wide stats (fire in background, non-blocking)
      Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
      ]).then(([vRes, gRes]) => {
        setPlatformStats({
          vibers: vRes.status === 'fulfilled' ? (vRes.value.count || 0) : 0,
          gruvs:  gRes.status === 'fulfilled' ? (gRes.value.count || 0) : 0,
        });
      });

      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        const p = profileRes.value.data;
        setProfile(p);
        setIsOnline(checkOnline(p));
      } else if (propUser) {
        setProfile(propUser);
        setIsOnline(checkOnline(propUser));
      }
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.data || []);
      if (followersRes.status === 'fulfilled') setFollowerCount(followersRes.value.count || 0);
      if (followingRes.status === 'fulfilled') setFollowingCount(followingRes.value.count || 0);
      const following = isFollowingRes.status === 'fulfilled' && !!isFollowingRes.value.data;
      const theyFollow = mutualRes.status === 'fulfilled' && !!mutualRes.value.data;
      setIsFollowing(following);
      setIsMutual(following && theyFollow);

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
          actorId: viewerUserId,
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
        await UserManager.unfollow(currentUser.id, targetId);
        setIsMutual(false);
      } else {
        await UserManager.follow(currentUser.id, targetId);
        const theyFollow = await UserManager.isFollowing(targetId, currentUser.id);
        setIsMutual(theyFollow);
      }
    } catch (e) {
      // Rollback optimistic update
      setIsFollowing(wasFollowing);
      setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
      const msg = e?.message?.includes('row-level security')
        ? 'Follow could not save — database not configured yet.'
        : 'Could not save follow — ' + (e?.message || 'check your connection.');
      toast?.show(msg, 'error');
    }
    setFollowLoading(false);
  };

  const loadFollowersList = async () => {
    if (!targetId) return;
    const { data } = await supabase
      .from('follows')
      .select('profiles!follows_follower_id_fkey(id, username, avatar_url, vibe_score)')
      .eq('following_id', targetId)
      .limit(50);
    setFollowersList((data || []).map(r => r.profiles).filter(Boolean));
    setFollowersModalVisible(true);
  };

  const loadFollowingList = async () => {
    if (!targetId) return;
    const { data } = await supabase
      .from('follows')
      .select('profiles!follows_following_id_fkey(id, username, avatar_url, vibe_score)')
      .eq('follower_id', targetId)
      .limit(50);
    setFollowingList((data || []).map(r => r.profiles).filter(Boolean));
    setFollowingModalVisible(true);
  };

  const rank = profile ? getRank(profile.vibe_score || 0) : null;

  const UserListModal = ({ visible: v, onClose: oc, title, users }) => (
    <Modal visible={v} transparent animationType="slide" onRequestClose={oc} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={oc} activeOpacity={1} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 12 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: `${primary}30`, alignSelf: 'center', marginBottom: 12 }} />
          <Text style={{ color: primary, fontSize: 14, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginBottom: 12 }}>{title}</Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {users.length === 0
              ? <Text style={{ color: muted, textAlign: 'center', paddingVertical: 24, fontSize: 13 }}>Nobody here yet</Text>
              : users.map(u => (
                <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: `${primary}10`, gap: 12 }}>
                  {u.avatar_url
                    ? <Image source={{ uri: u.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: `${primary}40` }} />
                    : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: primary, fontWeight: '900', fontSize: 14 }}>{(u.username || '?').slice(0, 2).toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>@{u.username}</Text>
                    <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>{u.vibe_score || 0} pts</Text>
                  </View>
                </View>
              ))
            }
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
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
          ) : !profile || !profile.id ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
              <Feather name="alert-circle" size={40} color={muted} />
              <Text style={{ color: muted, marginTop: 12, fontSize: 14 }}>Unable to load profile</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

              {/* Cover / header area with Dynamic Aura */}
              <View style={[s.coverArea, { backgroundColor: (profile.interests ? AuraService.getAura(profile.interests) : primary) + '20' }]}>
                {profile.cover_url
                  ? <Image source={{ uri: profile.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : (
                    <View 
                      style={[
                        s.coverGradient, 
                        { backgroundColor: AuraService.getAura(profile.interests) + '15' }
                      ]} 
                    />
                  )
                }
                <View 
                  style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    height: 50, 
                    backgroundColor: 'transparent' 
                  }} 
                />
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
                  {isOnline && <View style={s.onlineDot} />}
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
                              {isMutual ? 'Mutual' : isFollowing ? 'Following' : 'Follow'}
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

                    <TouchableOpacity
                      style={[s.msgBtn, { borderColor: '#ef444460' }]}
                      onPress={() => setReportOpen(true)}
                    >
                      <Feather name="flag" size={14} color="#ef4444" />
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
                {/* Last seen — only shown on other people's profiles */}
                {!isOwnProfile && (
                  <View style={s.locationRow}>
                    <Feather name="clock" size={11} color={muted} />
                    <Text style={[s.locationText, { color: muted }]}>
                      {isOnline ? 'Online now' : (profile.last_seen ? `Last seen ${fmtLastSeen(profile.last_seen)}` : 'Offline')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Stats */}
              <View style={[s.statsRow, { borderColor: `${primary}15` }]}>
                {[
                  { label: 'Vibe Score', value: profile.vibe_score || 0, icon: 'zap', color: primary, onPress: null },
                  { label: 'Followers',  value: followerCount,            icon: 'users', color: '#10b981', onPress: loadFollowersList },
                  { label: 'Following',  value: followingCount,           icon: 'user-check', color: '#8b5cf6', onPress: loadFollowingList },
                  { label: 'Gruvs',      value: events.length,            icon: 'calendar', color: '#f59e0b', onPress: null },
                ].map((stat, i, arr) => (
                  <React.Fragment key={stat.label}>
                    <TouchableOpacity style={s.stat} onPress={stat.onPress} activeOpacity={stat.onPress ? 0.7 : 1} disabled={!stat.onPress}>
                      <Feather name={stat.icon} size={12} color={stat.color} style={{ marginBottom: 4 }} />
                      <Text style={[s.statVal, { color: stat.color }]}>
                        {stat.value > 999 ? `${(stat.value / 1000).toFixed(1)}k` : stat.value}
                      </Text>
                      <Text style={[s.statLab, { color: muted }]}>{stat.label}</Text>
                    </TouchableOpacity>
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
                      <View key={ev.id} style={{ position: 'relative' }}>
                        <ProfileEventCard
                          ev={ev}
                          primary={ev.is_cancelled ? '#ef4444' : primary}
                          textColor={ev.is_cancelled ? 'rgba(255,255,255,0.4)' : textColor}
                          muted={muted}
                          onPress={() => { if (!ev.is_cancelled) { onClose(); onNavigateToEvent?.(ev); } }}
                        />
                        {/* Cancelled strikethrough overlay */}
                        {ev.is_cancelled && (
                          <View style={s.cancelledOverlay} pointerEvents="none">
                            <View style={s.cancelledLine} />
                            <Text style={s.cancelledLabel}>CANCELLED</Text>
                          </View>
                        )}
                        {/* Edit button — only on own profile */}
                        {isOwnProfile && !ev.is_cancelled && (
                          <TouchableOpacity
                            style={[s.editEventBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
                            onPress={() => setEditingEvent(ev)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Feather name="edit-2" size={12} color={primary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )
                )}

                {activeTab === 'about' && (
                  <View style={{ gap: 14, paddingVertical: 8 }}>
                    {[
                      { icon: 'briefcase', label: 'Career', value: profile.career_title ? `${profile.career_title} — ${profile.career_description || ''}` : 'Career not set' },
                      { icon: 'eye', label: 'Looks & Aura', value: profile.looks_description || 'No aura description' },
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

                    {profile.profile_gallery?.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={[s.sectionLabel, { color: muted }]}>GALLERY</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                          {profile.profile_gallery.map((url, i) => (
                            <Image key={i} source={{ uri: url }} style={{ width: 140, height: 180, borderRadius: 14, borderWidth: 1, borderColor: `${primary}20` }} resizeMode="cover" />
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Platform community stats */}
                    {(platformStats.vibers > 0 || platformStats.gruvs > 0) && (
                      <View style={[s.communityBox, { borderColor: `${primary}15`, backgroundColor: `${primary}06` }]}>
                        <Text style={[s.sectionLabel, { color: muted, marginBottom: 10 }]}>COMMUNITY</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          {[
                            { label: 'Vibers', value: platformStats.vibers, icon: 'users', color: primary },
                            { label: 'Gruvs',  value: platformStats.gruvs,  icon: 'calendar', color: '#f59e0b' },
                          ].map(s2 => (
                            <View key={s2.label} style={[s.communityPill, { borderColor: `${s2.color}25`, backgroundColor: `${s2.color}10` }]}>
                              <Text style={[{ color: s2.color, fontSize: 18, fontWeight: '900' }]}>
                                {s2.value >= 1000 ? `${(s2.value / 1000).toFixed(1)}k` : s2.value}
                              </Text>
                              <Text style={[{ color: muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }]}>{s2.label.toUpperCase()}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
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
      onNavigateToEvent={onNavigateToEvent}
    />

    <UserListModal
      visible={followersModalVisible}
      onClose={() => setFollowersModalVisible(false)}
      title="FOLLOWERS"
      users={followersList}
    />
    <UserListModal
      visible={followingModalVisible}
      onClose={() => setFollowingModalVisible(false)}
      title="FOLLOWING"
      users={followingList}
    />

    <ReportModal
      visible={reportOpen}
      onClose={() => setReportOpen(false)}
      targetId={targetId}
      targetType="user"
    />

    {/* Edit / Cancel / Delete own event */}
    <EditEventModal
      visible={!!editingEvent}
      event={editingEvent}
      onClose={() => setEditingEvent(null)}
      onSaved={() => {
        setEditingEvent(null);
        if (targetId) loadProfile(targetId);
      }}
    />
    </>
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
  msgBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  editEventBtn: { position: 'absolute', top: 6, right: 6, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cancelledOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', borderRadius: 14, overflow: 'hidden' },
  cancelledLine: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, backgroundColor: '#ef4444', opacity: 0.7, transform: [{ rotate: '-8deg' }] },
  cancelledLabel: { color: '#ef4444', fontWeight: '900', fontSize: 11, letterSpacing: 2, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },

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
  communityBox: { marginTop: 14, borderRadius: 16, borderWidth: 1, padding: 14 },
  communityPill: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
});
