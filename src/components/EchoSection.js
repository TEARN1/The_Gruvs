import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useDraft } from '../hooks/useDraft';
import { supabase } from '../services/supabase';
import { log } from '../utils/log';
import { logError } from '../utils/logError';
import { useToast } from './ToastNotification';
import { filterByViewerAge } from '../utils/contentAgeRating';
import { loadViewerAge, viewerAgeSync } from '../utils/viewerAge';
import { transform } from '../utils/writingStyles';
import { thumb } from '../utils/storageThumb';
import { resilient } from '../utils/resilience';
import { GlitterBurst } from './GlitterBurst';
import { ViberProfileModal } from './ViberProfileModal';

const IS_WEB = Platform.OS === 'web';

const formatAge = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const EchoSkeleton = ({ primary }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, gap: 10, paddingVertical: 8 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${primary}20` }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 10, width: '40%', borderRadius: 5, backgroundColor: `${primary}20` }} />
            <View style={{ height: 10, width: '90%', borderRadius: 5, backgroundColor: `${primary}12` }} />
            <View style={{ height: 10, width: '70%', borderRadius: 5, backgroundColor: `${primary}10` }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
};

const RANK_STYLES = [
  { bg: 'rgba(124,58,237,0.3)', color: "#c084fc", label: 'Top', glow: "#c084fc" },
  { bg: 'rgba(245,158,11,0.3)', color: "#fbbf24", label: '2nd', glow: "#fbbf24" },
  { bg: 'rgba(16,185,129,0.2)', color: "#34d399", label: '3rd', glow: "#34d399" },
];

const EchoRow = memo(({ echo, rank, isLiked, primary, textColor, muted, onLike, onReply, onOpenProfile, isReply = false, replyingToName = null }) => {
  const [likeFx, setLikeFx] = useState(0);
  const prevLiked = useRef(isLiked);
  useEffect(() => {
    if (isLiked && !prevLiked.current) setLikeFx(Date.now()); // sparkle on a fresh like
    prevLiked.current = isLiked;
  }, [isLiked]);
  const name = echo.profiles?.username || 'Viber';
  const colors = ["#0891b2", "#0d9488", "#1d4ed8", "#65a30d", "#dc2626", "#7c3aed"];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'G';
  return (
    <View style={[styles.echoItem, isReply && styles.replyItem]}>
      {/* One-layer thread guide: replies hang off their parent with an L-line */}
      {isReply && <View style={[styles.threadLine, { backgroundColor: `${primary}30` }]} />}
      <TouchableOpacity onPress={() => onOpenProfile?.(echo.user_id)} disabled={!echo.user_id}>
        {echo.profiles?.avatar_url
          ? <Image source={{ uri: thumb.avatar(echo.profiles.avatar_url) }} style={[styles.avatar, isReply && styles.avatarSmall]} />
          : <View style={[styles.avatar, isReply && styles.avatarSmall, styles.avatarFallback, { backgroundColor: bg }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
        }
      </TouchableOpacity>
      <View style={[styles.bubble, { backgroundColor: `${primary}08`, borderColor: rank ? rank.glow : `${primary}18` }, rank && (IS_WEB ? { boxShadow: `0 0 12px ${rank.glow}55` } : { shadowColor: rank.glow, shadowOpacity: 0.45, shadowRadius: 7, elevation: 4 })]}>
        <View style={styles.bubbleHeader}>
          <TouchableOpacity onPress={() => onOpenProfile?.(echo.user_id)} disabled={!echo.user_id}>
            <Text style={[styles.echoName, { color: primary }]}>{name}</Text>
          </TouchableOpacity>
          {isReply && replyingToName && (
            <Text style={[styles.replyingTo, { color: muted }]}>↩ {replyingToName}</Text>
          )}
          {rank && (
            <View style={[styles.rankBadge, { backgroundColor: rank.bg }]}>
              <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
            </View>
          )}
          <Text style={[styles.echoTime, { color: muted }]}>{formatAge(echo.created_at)}</Text>
        </View>
        <Text style={[styles.echoContent, { color: textColor }]}>{transform(echo.body, echo.profiles?.writing_style)}</Text>
        <View style={styles.echoActions}>
          <TouchableOpacity onPress={() => onLike(echo.id)} style={[styles.likeBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="heart" size={13} color={isLiked ? "#ef4444" : muted} />
              <GlitterBurst trigger={likeFx} size={84} />
            </View>
            <Text style={{ color: isLiked ? "#ef4444" : muted, fontSize: 12 }}>
              {echo.likes || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply({ id: echo.id, username: name })}>
            <Text style={[styles.replyBtn, { color: muted }]}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export const EchoSection = ({ eventId, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const { show: showToast } = useToast();
  const [echoes, setEchoes] = useState(null); // null = loading, [] = empty, [...] = loaded
  const [text, setText] = useState('');
  const [sort, setSort] = useState('top');
  const [replyTo, setReplyTo] = useState(null);
  const [likedEchoes, setLikedEchoes] = useState(new Set());
  const [posting, setPosting] = useState(false);
  // Draft: keep a half-typed comment so closing the thread never loses it.
  const { clearDraft: clearEchoDraft } = useDraft(
    user && eventId ? `draft:echo:${eventId}:${user.id}` : null,
    () => ({ text }),
    (d) => { if (typeof d.text === 'string') setText(d.text); },
    { enabled: !!user && !!eventId },
  );

  const primary = currentTheme?.primary || "#00f2ff";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || "#1a1a1a";

  const fetchEchoes = useCallback(async () => {
    setEchoes(null);
    try {
      const { data, error } = await supabase
        .from('echoes')
        .select('id, body, likes, parent_id, created_at, user_id, profiles:user_id(username, avatar_url, writing_style)')
        .eq('event_id', eventId)
        .order(sort === 'top' ? 'likes' : 'created_at', { ascending: false })
        .limit(30);
      if (error) {
        // Fallback: fetch without join, show echoes without profile data
        const { data: fallback } = await supabase
          .from('echoes')
          .select('id, body, likes, parent_id, created_at, user_id')
          .eq('event_id', eventId)
          .order(sort === 'top' ? 'likes' : 'created_at', { ascending: false })
          .limit(30);
        setEchoes(fallback ? filterByViewerAge(fallback.map(e => ({ ...e, profiles: null })), viewerAgeSync()) : []);
        log.error('EchoSection:fetch', error);
        logError('Echo.fetch', error, { code: error.code });
        return;
      }
      setEchoes(filterByViewerAge(data || [], viewerAgeSync()));
      // Hydrate which of these I already liked — otherwise hearts reset on
      // every open and "my like disappeared" reports keep coming in.
      if (user && data?.length) {
        try {
          const { data: mine } = await supabase
            .from('echo_likes')
            .select('echo_id')
            .eq('user_id', user.id)
            .in('echo_id', data.map(e => e.id));
          if (mine) setLikedEchoes(new Set(mine.map(r => r.echo_id)));
        } catch { /* echo_likes not migrated — hearts stay session-local */ }
      }
    } catch (e) {
      log.error('EchoSection:fetch', e);
      setEchoes([]);
    }
  }, [eventId, sort, user]);

  useEffect(() => { loadViewerAge(user?.id).then(() => fetchEchoes()).catch(() => {}); }, [user?.id]);

  useEffect(() => {
    fetchEchoes();
  }, [fetchEchoes]);

  const submitEcho = async () => {
    if (!text.trim()) return;
    if (!user) { onAuthRequired(); return; }
    const body = text.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      event_id: eventId,
      user_id: user?.id,
      body,
      parent_id: replyTo?.id || null,
      created_at: new Date().toISOString(),
      likes: 0,
      profiles: { username: profile?.username || user.user_metadata?.username || 'You', avatar_url: profile?.avatar_url || null },
    };
    setEchoes(prev => [optimistic, ...(prev ?? [])]);
    setText(''); clearEchoDraft();
    setReplyTo(null);
    setPosting(true);
    try {
      const { error } = await supabase.from('echoes').insert({
        event_id: eventId,
        user_id: user?.id,
        body,
        parent_id: optimistic.parent_id,
      });
      if (error) {
        setEchoes(prev => (prev ?? []).filter(e => e.id !== tempId));
        logError('Echo.post', error, { code: error.code });
        showToast(error.message ? `Couldn't post: ${error.message}` : "Couldn't post your comment — try again.", 'error');
      } else {
        fetchEchoes();
      }
    } catch (e) {
      setEchoes(prev => (prev ?? []).filter(e => e.id !== tempId));
      logError('Echo.post', e, { code: e?.code });
      showToast(e?.message ? `Couldn't post: ${e.message}` : "Couldn't post your comment — try again.", 'error');
    } finally {
      setPosting(false);
    }
  };

  const likeEcho = async (echoId) => {
    if (!user) { onAuthRequired(); return; }
    const isCurrentlyLiked = likedEchoes.has(echoId);

    setLikedEchoes(prev => {
      const next = new Set(prev);
      isCurrentlyLiked ? next.delete(echoId) : next.add(echoId);
      return next;
    });

    let currentLikes = 0;
    setEchoes(prev => (prev ?? []).map(e => {
      if (e.id !== echoId) return e;
      currentLikes = Math.max(0, (e.likes || 0) + (isCurrentlyLiked ? -1 : 1));
      return { ...e, likes: currentLikes };
    }));

    try {
      const ok = await resilient(
        [
          // Tier 1: update likes count directly
          () => supabase.from('echoes').update({ likes: currentLikes }).eq('id', echoId),
          // Tier 2: upsert like row — let DB compute count via trigger
          () => isCurrentlyLiked
            ? supabase.from('echo_likes').delete().eq('echo_id', echoId).eq('user_id', user?.id)
            : supabase.from('echo_likes').upsert({ echo_id: echoId, user_id: user?.id }, { onConflict: 'echo_id,user_id', ignoreDuplicates: true }),
          // Tier 3: RPC increment/decrement
          () => supabase.rpc(isCurrentlyLiked ? 'decrement_echo_like' : 'increment_echo_like', { p_echo_id: echoId }),
        ],
        { attemptsPerTier: 3, baseMs: 300, label: `EchoSection.likeEcho:${echoId}`, fallbackValue: null }
      );
      if (ok === null) throw new Error('all tiers failed');
    } catch {
      // Rollback optimistic like/unlike
      setLikedEchoes(prev => {
        const next = new Set(prev);
        isCurrentlyLiked ? next.add(echoId) : next.delete(echoId);
        return next;
      });
      setEchoes(prev => (prev ?? []).map(e => {
        if (e.id !== echoId) return e;
        return { ...e, likes: Math.max(0, (e.likes || 0) + (isCurrentlyLiked ? 1 : -1)) };
      }));
    }
  };

  const avatarInitials = (name) =>
    name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'G';

  const avatarColor = (name) => {
    const colors = ["#0891b2", "#0d9488", "#1d4ed8", "#65a30d", "#dc2626", "#7c3aed"];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const displayEchoes = echoes ?? [];

  // One-layer thread: top-level echoes keep the chosen sort; replies hang
  // under their parent chronologically. A reply to a reply still attaches to
  // the top-level parent (single layer, like Instagram).
  const { tops, childrenOf, parentNameOf } = React.useMemo(() => {
    const byId = new Map(displayEchoes.map(e => [e.id, e]));
    const topList = [];
    const kidsMap = new Map();
    for (const e of displayEchoes) {
      const parent = e.parent_id ? byId.get(e.parent_id) : null;
      if (!parent) { topList.push(e); continue; }
      // collapse deeper nesting to the top-level ancestor
      const rootId = parent.parent_id && byId.has(parent.parent_id) ? parent.parent_id : parent.id;
      if (!kidsMap.has(rootId)) kidsMap.set(rootId, []);
      kidsMap.get(rootId).push(e);
    }
    for (const kids of kidsMap.values()) {
      kids.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return {
      tops: topList,
      childrenOf: kidsMap,
      parentNameOf: (e) => byId.get(e.parent_id)?.profiles?.username || null,
    };
  }, [displayEchoes]);

  const [profileUserId, setProfileUserId] = useState(null);

  const myAvatar = thumb.avatar(profile?.avatar_url);
  const myInitials = avatarInitials(profile?.username || user?.email);
  const myColor = avatarColor(profile?.username || user?.email);

  return (
    <View style={[styles.container, { borderTopColor: `${primary}18` }]}>
      {/* Sort */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Echoes ({displayEchoes.length})</Text>
        <View style={styles.sortRow}>
          {['top', 'new'].map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setSort(s)}
              style={[styles.sortBtn, sort === s && { backgroundColor: `${primary}25` }]}
            >
              <Text style={[styles.sortText, { color: sort === s ? primary : muted }]}>
                {s === 'top' ? 'Top' : 'New'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
          <Text style={[styles.replyText, { color: primary }]}>↩ Replying to @{replyTo.username}</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={{ color: muted, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Echo list */}
      {echoes === null
        ? <EchoSkeleton primary={primary} />
        : displayEchoes.length === 0
          ? <Text style={[styles.empty, { color: muted }]}>No echoes yet. Be the first.</Text>
          : tops.map((echo, idx) => (
              <View key={echo.id}>
                <EchoRow
                  echo={echo}
                  rank={idx < 3 ? RANK_STYLES[idx] : null}
                  isLiked={likedEchoes.has(echo.id)}
                  primary={primary}
                  textColor={textColor}
                  muted={muted}
                  onLike={likeEcho}
                  onReply={setReplyTo}
                  onOpenProfile={setProfileUserId}
                />
                {(childrenOf.get(echo.id) || []).map((reply) => (
                  <EchoRow
                    key={reply.id}
                    echo={reply}
                    rank={null}
                    isReply
                    replyingToName={parentNameOf(reply)}
                    isLiked={likedEchoes.has(reply.id)}
                    primary={primary}
                    textColor={textColor}
                    muted={muted}
                    onLike={likeEcho}
                    onReply={setReplyTo}
                    onOpenProfile={setProfileUserId}
                  />
                ))}
              </View>
            ))
      }

      {/* Input */}
      <View style={styles.inputRow}>
        {myAvatar
          ? <Image source={{ uri: myAvatar }} style={[styles.avatar, { marginRight: 8 }]} />
          : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: myColor, marginRight: 8 }]}>
              <Text style={styles.avatarText}>{myInitials}</Text>
            </View>
        }
        <TextInput
          style={[styles.input, { color: textColor, borderColor: `${primary}35` }]}
          placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Drop an Echo...'}
          placeholderTextColor={muted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submitEcho}
          returnKeyType="send"
          maxLength={280}
        />
        <TouchableOpacity onPress={submitEcho} style={[styles.sendBtn, { backgroundColor: primary }]} disabled={posting}>
          {posting
            ? <ActivityIndicator size="small" color="#000" />
            : <Feather name="send" size={15} color="#000" />
          }
        </TouchableOpacity>
      </View>

      {/* Tap a name/avatar anywhere in the thread → their profile */}
      {profileUserId && (
        <ViberProfileModal
          visible={!!profileUserId}
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 8, borderTopWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 12, fontWeight: '800' },
  sortRow: { flexDirection: 'row', gap: 4 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sortText: { fontSize: 11, fontWeight: '700' },
  replyPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  replyText: { fontSize: 12, fontWeight: '600' },
  empty: { fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  echoItem: { flexDirection: 'row', marginBottom: 10 },
  replyItem: { marginLeft: 34, marginTop: -4, position: 'relative' },
  threadLine: { position: 'absolute', left: -16, top: -6, bottom: 14, width: 1.5, borderRadius: 1 },
  replyingTo: { fontSize: 10, fontWeight: '700' },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarSmall: { width: 22, height: 22, borderRadius: 11 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  bubble: { flex: 1, marginLeft: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  echoName: { fontSize: 12, fontWeight: '800' },
  rankBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  rankText: { fontSize: 9, fontWeight: '800' },
  echoTime: { fontSize: 9, marginLeft: 'auto' },
  echoContent: { fontSize: 13, lineHeight: 18 },
  echoActions: { flexDirection: 'row', gap: 14, marginTop: 6 },
  likeBtn: {},
  replyBtn: { fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.05)' },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
