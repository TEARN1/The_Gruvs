/**
 * DirectMessageModal — Advanced real-time 1-on-1 messaging.
 * Features: DB-backed message requests, read receipts (✓/✓✓/coloured ✓✓),
 * typing indicator via Presence, soft-delete, emoji reactions, block sender.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Modal, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Alert, Linking,
} from 'react-native';
import { SmartImage } from './SmartImage';
import { VibeCardBubble } from './VibeCardBubble';
import { Video } from 'expo-av';
import { useCall } from '../context/CallContext';
import { SignedImage } from './SignedImage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { SoundFX } from '../services/soundFX';
import { resilientRead } from '../utils/resilience';
import { MessageManager, BlockManager, isOnline as checkOnline } from '../services/dataFlow';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useDraft } from '../hooks/useDraft';
import { transform } from '../utils/writingStyles';
import { useToast } from '../components/ToastNotification';
import { LocationService } from '../services/locationService';
import { EventMapView } from './EventMapView';
import { uploadToStorage } from '../services/storageService';
import { useBackClose } from '../hooks/useBackClose';
import { money, priceLabel } from '../constants/currencies';
import { buildVibeCardShareText } from '../utils/vibeCardShare';

// Dynamic wrapper to break static circular import cycle
const ViberProfileModal = (props) => {
  const { ViberProfileModal: Component } = require('./ViberProfileModal');
  return <Component {...props} />;
};

const EMOJI_REACTIONS = ['❤️', '😂', '🔥', '💯', '👀', '🙏'];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

// Removed Ticks component as time text itself is now colored directly based on status.

// ── Animated typing dots ───────────────────────────────────────────────────────
const MAX_MESSAGES = 200;

const DMSkeleton = ({ primary, muted }) => {
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
    <Animated.View style={{ opacity: pulse, flex: 1, padding: 16, gap: 14 }}>
      {[false, true, false, true, false].map((isRight, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: isRight ? 'flex-end' : 'flex-start' }}>
          <View style={{ height: 36, width: `${40 + (i % 3) * 15}%`, borderRadius: 16, backgroundColor: `${primary}${isRight ? '25' : '12'}` }} />
        </View>
      ))}
    </Animated.View>
  );
};

const TypingDots = ({ primary, bg }) => {
  const anims = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    anims.forEach((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: true }),
      ])).start()
    );
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 10, paddingHorizontal: 14, backgroundColor: bg || "#1e2a2d", borderRadius: 18, alignSelf: 'flex-start', marginBottom: 8 }}>
      {anims.map((d, i) => <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: primary, opacity: d }} />)}
    </View>
  );
};

// ── Message Request Banner ─────────────────────────────────────────────────────
const RequestBanner = ({ sender, onAccept, onDecline, primary, textColor, muted }) => (
  <View style={[rb.wrap, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]}>
    {sender?.avatar_url
      ? <SmartImage source={sender.avatar_url} style={rb.avatar} />
      : <View style={[rb.avatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="user" size={22} color={primary} />
      </View>
    }
    <Text style={[rb.name, { color: textColor }]}>{sender?.username || 'Viber'} wants to link up</Text>
    <Text style={[rb.sub, { color: muted }]}>Accept to reply and start the conversation.</Text>
    <View style={rb.actions}>
      <TouchableOpacity onPress={onDecline} style={[rb.btn, rb.declineBtn]}>
        <Feather name="x" size={16} color="#ef4444" />
        <Text style={{ color: "#ef4444", fontWeight: '800', fontSize: 13 }}>Decline</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onAccept} style={[rb.btn, rb.acceptBtn, { backgroundColor: primary }]}>
        <Feather name="check" size={16} color="#000" />
        <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Lock In</Text>
      </TouchableOpacity>
    </View>
  </View>
);
const rb = StyleSheet.create({
  wrap: { margin: 14, padding: 18, borderRadius: 18, borderWidth: 1, alignItems: 'center', gap: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  name: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14 },
  declineBtn: { borderWidth: 1, borderColor: '#ef444450' },
  acceptBtn: {},
});

// ── Date separator ─────────────────────────────────────────────────────────────
const DateSep = ({ label, muted }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10, paddingHorizontal: 20 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
    <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
  </View>
);

// ── Emoji reaction picker ──────────────────────────────────────────────────────
const ReactionPicker = ({ onSelect, onClose, primary }) => (
  <View style={[rp.wrap, { borderColor: `${primary}20` }]}>
    {EMOJI_REACTIONS.map(emoji => (
      <TouchableOpacity key={emoji} style={rp.btn} onPress={() => onSelect(emoji)}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </TouchableOpacity>
    ))}
    <TouchableOpacity style={rp.btn} onPress={onClose}>
      <Feather name="x" size={18} color="rgba(255,255,255,0.5)" />
    </TouchableOpacity>
  </View>
);
const rp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, borderWidth: 1, padding: 6, gap: 4 },
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
});

// ── Main component ─────────────────────────────────────────────────────────────
const _sharedEventCache = {};
const _shareDate = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };

// Shared-event card in a DM — fetches the real event so it actually reflects
// the original Gruv (cover, title, date, venue, price) instead of a placeholder.
const SharedEventCard = ({ evId, onPress, primary, textColor, muted }) => {
  const [ev, setEv] = useState(_sharedEventCache[evId] || null);
  const [loading, setLoading] = useState(!_sharedEventCache[evId]);
  useEffect(() => {
    if (_sharedEventCache[evId]) { setEv(_sharedEventCache[evId]); setLoading(false); return undefined; }
    let alive = true;
    supabase.from('events').select('id, title, cover_url, media, event_date, event_time, venue_name, city, category, price').eq('id', evId).maybeSingle()
      .then(({ data }) => { if (!alive) return; if (data) { _sharedEventCache[evId] = data; setEv(data); } setLoading(false); })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [evId]);

  let thumb = null;
  if (ev) {
    // TODO(v6): remove cover_image fallback after migration
    thumb = ev.cover_url || ev.cover_image || null;
    if (!thumb) { let m = ev.media; if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = null; } } if (Array.isArray(m) && m[0]) thumb = typeof m[0] === 'string' ? m[0] : m[0]?.url; }
    // TODO(v6): remove media_urls fallback after migration
    if (!thumb && Array.isArray(ev.media_urls) && ev.media_urls[0]) thumb = ev.media_urls[0];
  }
  const priceStr = priceLabel(ev?.price);
  const free = priceStr === 'FREE';

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isPast = ev?.event_date && ev.event_date.split('T')[0] < todayStr;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[sec.card, { borderColor: `${primary}33`, backgroundColor: `${primary}0d`, opacity: isPast ? 0.55 : 1 }]}>
      <View style={sec.thumbWrap}>
        {thumb
          ? <SmartImage source={thumb} style={sec.thumb} resizeMode="cover" />
          : <View style={[sec.thumb, { backgroundColor: `${primary}1a`, alignItems: 'center', justifyContent: 'center' }]}><Feather name="calendar" size={22} color={primary} /></View>}
        {ev?.category ? <View style={sec.catPill}><Text style={sec.catText}>{String(ev.category).toUpperCase()}</Text></View> : null}
      </View>
      <View style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
        <Text style={[sec.title, { color: textColor }]} numberOfLines={2}>{loading ? 'Loading Gruv…' : (ev?.title || 'Shared Gruv')}</Text>
        {ev ? (
          <>
            <View style={sec.metaRow}><Feather name="calendar" size={11} color={muted} /><Text style={[sec.meta, { color: muted }]} numberOfLines={1}>{_shareDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time}` : ''}{isPast ? ' · PASSED' : ''}</Text></View>
            {(ev.venue_name || ev.city) ? <View style={sec.metaRow}><Feather name="map-pin" size={11} color={muted} /><Text style={[sec.meta, { color: muted }]} numberOfLines={1}>{ev.venue_name || ev.city}</Text></View> : null}
          </>
        ) : null}
        <View style={sec.footer}>
          <View style={[sec.cta, { backgroundColor: primary }]}><Text style={sec.ctaText}>View Gruv</Text><Feather name="arrow-right" size={11} color="#000" /></View>
          {ev ? <Text style={[sec.price, { color: free ? '#10b981' : primary }]}>{priceStr}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const sec = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 6, width: 270 },
  thumbWrap: { width: 88, position: 'relative' },
  thumb: { width: 88, height: '100%', minHeight: 104 },
  catPill: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  catText: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  title: { fontSize: 13, fontWeight: '900', marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { fontSize: 10, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 9 },
  ctaText: { color: '#000', fontSize: 11, fontWeight: '900' },
  price: { fontSize: 11, fontWeight: '900' },
});

export const DirectMessageModal = ({ visible, onClose, recipient, onNavigateToEvent, initialMessage = '', embedded = false }) => {
  // In embedded (split-pane) mode there is no Modal to intercept back — the
  // parent screen owns the hardware-back behaviour, so skip the hook.
  useBackClose(visible && !embedded, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const insets = useSafeAreaInsets();

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [messages, setMessages] = useState([]);
  const [msgStyles, setMsgStyles] = useState({}); // sender_id -> writing_style (display only; body stays plain)
  useEffect(() => {
    if (!user || !recipient) return undefined;
    let alive = true;
    supabase.from('profiles').select('id, writing_style').in('id', [user.id, recipient.id])
      .then(({ data }) => { if (alive && data) { const m = {}; data.forEach(p => { if (p.writing_style) m[p.id] = p.writing_style; }); setMsgStyles(m); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.id, recipient?.id]);
  const [body, setBody] = useState(initialMessage || '');
  // Draft: a half-typed message survives closing the chat; cleared on send.
  const { clearDraft: clearDmDraft } = useDraft(
    user && recipient ? `draft:dm:${recipient.id}:${user.id}` : null,
    () => ({ body }),
    (d) => { if (typeof d.body === 'string') setBody(d.body); },
    { enabled: !!visible && !!user && !!recipient },
  );
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [requestStatus, setRequestStatus] = useState('none'); // 'none'|'pending'|'accepted'|'declined'
  // Verified co-presence — the two of you actually stood in the same room.
  const [sharedMet, setSharedMet] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!visible || !user?.id || !recipient?.id) { setSharedMet(null); return undefined; }
    import('../services/coPresence')
      .then(({ sharedPresence, describeSharedPresence }) =>
        sharedPresence(user.id, recipient.id).then(evts => {
          if (alive) setSharedMet(describeSharedPresence(evts));
        }))
      .catch(() => {}); // never let this break the conversation
    return () => { alive = false; };
  }, [visible, user?.id, recipient?.id]);
  const [selectedMsgId, setSelectedMsgId] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionMsgId, setReactionMsgId] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [crossPathCount, setCrossPathCount] = useState(0);

  // Event picker for "Share Gruv" — pick which event to send, instead of the
  // old dead button that sent an empty event card.
  const [eventPickerVisible, setEventPickerVisible] = useState(false);
  const [pickerEvents, setPickerEvents] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [profileTarget, setProfileTarget] = useState(null); // user id to open (defaults to recipient)

  // Media preview before send: hold the picked asset here until the user
  // confirms (with an optional caption), instead of firing it off blind.
  const [pendingMedia, setPendingMedia] = useState(null); // { uri, type: 'image'|'video' }
  const [pendingCaption, setPendingCaption] = useState('');

  // ── Voice / video calling ─────────────────────────────────────────────────
  // Calls are owned by the global CallProvider so an incoming call rings from
  // any screen and there's only ever one session. Here we just fire an outgoing
  // call at this recipient; the overlay/permission UI lives in the provider.
  const { startCall: startCallGlobal, callSupported } = useCall();
  const startCall = (video) => startCallGlobal(recipient, video);

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapTarget, setMapTarget] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sharingLoading, setSharingLoading] = useState(false);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const data = await MessageManager.getConversations(user.id);
      setConversations(data.filter(c => c.partner?.id !== recipient?.id));
    } catch (e) {
      console.warn("Failed to fetch conversations for sharing:", e);
    }
  };

  const handleShareToConvo = async (targetPartner) => {
    if (selectedMsgIds.size === 0) return;
    setSharingLoading(true);
    try {
      const selectedMsgs = messages.filter(m => selectedMsgIds.has(m.id));
      const formattedLines = selectedMsgs.map(m => {
        const senderName = m.sender_id === user.id ? 'You' : `${recipient.username}`;
        return `> **${senderName}**: ${m.body || '[Media/Shared Event]'}`;
      }).join('\n');

      const shareText = `🔒 Shared messages from chat with ${recipient.username}:\n${formattedLines}`;

      await MessageManager.send(user.id, targetPartner.id, shareText);
      toast?.show(`Shared selected messages to ${targetPartner.username}!`, 'success');
      
      setIsMultiSelectMode(false);
      setSelectedMsgIds(new Set());
      setShowShareModal(false);
    } catch (e) {
      toast?.show('Failed to share messages: ' + (e?.message || 'Unknown error'), 'error');
    } finally {
      setSharingLoading(false);
    }
  };

  const flatRef = useRef(null);
  const channelRef = useRef(null);
  const presenceRef = useRef(null);
  const broadcastRef = useRef(null);
  const typingTimeout = useRef(null);

  // Deterministic broadcast channel key shared by both conversation participants
  const broadcastKey = user && recipient
    ? `dm_fast_${[user.id, recipient.id].sort().join('_')}`
    : null;

  // ── Fetch messages + determine request status ────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!user || !recipient) return;
    const msgs = await MessageManager.fetchThread(user.id, recipient.id);
    const filtered = msgs.filter(m => !m.deleted_at);
    const next = filtered.length > MAX_MESSAGES ? filtered.slice(filtered.length - MAX_MESSAGES) : filtered;
    // Merge instead of blindly replacing: never drop a just-sent message that
    // hasn't surfaced in this fetch yet (otherwise a refetch can wipe it).
    setMessages(prev => {
      const ids = new Set(next.map(m => m.id));
      const inFlight = prev.filter(m => (m._optimistic || m._failed) && !ids.has(m.id));
      return inFlight.length ? [...next, ...inFlight] : next;
    });

    // Determine request status from DB fields
    const myMsg = msgs.find(m => m.sender_id === user.id);
    const theirReply = msgs.find(m => m.sender_id === recipient.id);

    if (!myMsg && !theirReply) {
      setRequestStatus('none');
    } else if (myMsg && !theirReply) {
      // I sent — they see it as a request; I see 'pending'
      setRequestStatus('pending');
    } else if (theirReply?.request_accepted === false && !myMsg) {
      // They sent to me, I haven't accepted
      setRequestStatus('incoming_request');
    } else {
      setRequestStatus('accepted');
    }

    // Mark their messages as read
    await MessageManager.markRead(recipient.id, user.id);

    // Fetch Cross Path context — count shared path crossings via paths.user_id
    if (user && recipient) {
      try {
        const count = await resilientRead(
          async () => {
            const [myPathsRes, theirPathsRes] = await Promise.allSettled([
              supabase.from('paths').select('id').eq('user_id', user?.id),
              supabase.from('paths').select('id').eq('user_id', recipient.id),
            ]);
            const myIds = (myPathsRes.status === 'fulfilled' ? myPathsRes.value?.data || [] : []).map(p => p.id);
            const theirIds = (theirPathsRes.status === 'fulfilled' ? theirPathsRes.value?.data || [] : []).map(p => p.id);
            if (!myIds.length || !theirIds.length) return 0;
            const [fwdRes, revRes] = await Promise.allSettled([
              supabase.from('path_crossings').select('*', { count: 'exact', head: true }).in('path_id_a', myIds).in('path_id_b', theirIds),
              supabase.from('path_crossings').select('*', { count: 'exact', head: true }).in('path_id_a', theirIds).in('path_id_b', myIds),
            ]);
            const fwd = fwdRes.status === 'fulfilled' ? fwdRes.value?.count || 0 : 0;
            const rev = revRes.status === 'fulfilled' ? revRes.value?.count || 0 : 0;
            return fwd + rev;
          },
          async () => {
            const { count: c } = await supabase.rpc('count_path_crossings', { p_user_a: user?.id, p_user_b: recipient.id });
            return c || 0;
          },
          async () => 0,
          0,
          'DirectMessageModal.crossPaths'
        );
        setCrossPathCount(count);
      } catch { /* non-critical context */ }
    }
  }, [user, recipient]);

  // ── Subscribe to realtime messages + read receipt updates ────────────────────
  useEffect(() => {
    if (!visible || !user || !recipient) return;
    let active = true;

    const loadMessages = async () => {
      setLoading(true);
      try {
        await fetchMessages();
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMessages();

    // ── Fast broadcast channel (shared by both participants, bypass WAL pipeline) ──
    // Recipient receives messages here in ~50-100ms; sender uses it to push instantly.
    const broadcast = supabase
      .channel(broadcastKey)
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        if (!active) return;
        if (payload.sender_id === user.id) return; // own message already shown optimistically
        // Merge if already present (postgres_changes may fire later with same ID)
        setMessages(prev =>
          prev.some(m => m.id === payload.id)
            ? prev.map(m => m.id === payload.id ? { ...m, ...payload } : m)
            : [...prev, payload]
        );
        setRequestStatus('accepted');
        (async () => { try { await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.id); } catch {} })();
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
      })
      .subscribe();
    broadcastRef.current = broadcast;

    // Typing subscription
    const unsubTyping = MessageManager.subscribeToTyping(user.id, (p) => {
      if (p.senderId === recipient.id) setIsTyping(p.isTyping);
    });

    // ── postgres_changes: fallback + read-receipt sync ───────────────────────
    const chanKey = `dm_${[user.id, recipient.id].sort().join('_')}_${Date.now()}`;
    const channel = supabase
      .channel(chanKey)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      } , async (payload) => {
        if (payload.new.sender_id !== recipient.id) return;
        if (payload.new.deleted_at) return;
        // Merge: broadcast may have already added this message
        setMessages(prev =>
          prev.some(m => m.id === payload.new.id)
            ? prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
            : [...prev, payload.new]
        );
        setRequestStatus('accepted');
        supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id).catch(() => {});
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
        SoundFX.playChannel('dm'); // routes through the user's tone choice
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${user.id}`,
      } , (payload) => {
        // Sync read receipts and delivered_at back onto our optimistic messages
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, _optimistic: false } : m));
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      } , (payload) => {
        // Messages THEY sent to me being updated — reactions land here (and any
        // edit). Only merge rows already in view; don't resurrect deleted ones.
        if (payload.new.sender_id !== recipient.id) return;
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();
    channelRef.current = channel;

    // ── Presence for typing indicator ────────────────────────────────────────
    const presKey = `presence_dm_${[user.id, recipient.id].sort().join('_')}_${Date.now()}`;
    const presence = supabase.channel(presKey, { config: { presence: { key: user?.id } } });
    presence
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState();
        const recipientTyping = Object.entries(state).some(
          ([key, arr]) => key === recipient.id && arr.some(s => s.typing)
        );
        setIsTyping(recipientTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presence.track({ typing: false, online: true });
      });
    presenceRef.current = presence;

    return () => {
      active = false;
      supabase.removeChannel(broadcast);
      supabase.removeChannel(channel);
      if (presenceRef.current) {
        supabase.removeChannel(presenceRef.current);
        presenceRef.current = null;
      }
      broadcastRef.current = null;
      channelRef.current = null;
      unsubTyping();
      clearTimeout(typingTimeout.current);
    };
    // Depend on the stable IDs, not the object identities. Passing `recipient`/
    // `fetchMessages` (new references on every parent render) made this effect
    // re-run constantly — tearing down realtime and re-showing the loading
    // skeleton, which made messages flicker and "disappear".
  }, [visible, user?.id, recipient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  // ── Typing broadcast ──────────────────────────────────────────────────────────
  const broadcastTyping = useCallback(async (isTypingNow) => {
    if (!user || !recipient) return;
    MessageManager.sendTypingStatus(user.id, recipient.id, isTypingNow);
  }, [user, recipient]);

  const handleTextChange = useCallback((text) => {
    setBody(text);
    broadcastTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => broadcastTyping(false), 1500);
  }, [broadcastTyping]);

  // ── Send message — optimistic + broadcast for near-instant delivery ──────────
  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !user || !recipient || sending) return;

    const parentId = replyingTo?.id || null;
    setSending(true);
    setBody(''); clearDmDraft();
    setReplyingTo(null);
    broadcastTyping(false);

    // Pre-generate a valid UUID v4 so broadcast and DB row share the same ID.
    const msgId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

    const now = new Date().toISOString();
    const optimistic = {
      id: msgId,
      sender_id: user?.id,
      recipient_id: recipient.id,
      body: trimmed,
      message_type: 'text',
      parent_id: parentId,
      created_at: now,
      delivered_at: now,
      is_request: requestStatus === 'none',
      request_accepted: requestStatus !== 'none',
      _optimistic: true,
    };

    // 1. Render immediately for the sender (0 ms)
    setMessages(prev => [...prev, optimistic]);
    if (requestStatus === 'none') setRequestStatus('pending');

    // 2. Push via broadcast channel — recipient sees it in ~50-100 ms
    //    (broadcast bypasses the WAL pipeline entirely)
    broadcastRef.current?.send({
      type: 'broadcast',
      event: 'msg',
      payload: optimistic,
    }).catch(() => {});

    // 3. Persist to DB in the background — same ID so deduplication is automatic
    try {
      const newMsg = await MessageManager.send(user.id, recipient.id, trimmed, {
        parent_id: parentId,
        _pregenId: msgId,
      });
      // Swap the optimistic placeholder with the DB-confirmed row
      setMessages(prev => prev.map(m => m.id === msgId ? { ...newMsg, _optimistic: false } : m));
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { }
      SoundFX.play('messageSent');
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, _failed: true, _optimistic: false } : m));
      SoundFX.play('error');
      showToast(e?.message?.includes('row-level security')
        ? 'Message blocked — run the SQL patch in Supabase to enable messaging.'
        : 'Message failed: ' + (e?.message || 'Unknown error'), 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Share Vibe Card ───────────────────────────────────────────────────────────
  // A4 — ONE Vibe Card: this used to build its own ad-hoc card text that
  // drifted from the canonical builder (no tier, no verified, no link). The
  // Vibe Card has ONE meaning — your identity summary — and ONE renderer.
  const handleShareVibeCard = async () => {
    if (!user) return;
    setShowAttachmentMenu(false);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, vibe_score, is_verified, followers_count')
        .eq('id', user.id)
        .single();
      const cardText = buildVibeCardShareText(profile || { username: user.email });
      const newMsg = await MessageManager.send(user.id, recipient.id, cardText, { messageType: 'vibe_card', profile_id: user?.id });
      if (newMsg) {
        setMessages(prev => [...prev, newMsg]);
        if (requestStatus === 'none') setRequestStatus('pending');
      } else {
        showToast('Could not share Vibe Card.', 'error');
      }
    } catch {
      showToast('Could not share Vibe Card.', 'error');
    }
  };

  // ── Share Event ──────────────────────────────────────────────────────────────
  const handleShareEvent = async (evId) => {
    setShowAttachmentMenu(false);
    setMediaLoading(true);
    try {
      const newMsg = await MessageManager.send(user.id, recipient.id, 'Check out this Gruv!', { event_id: evId });
      if (newMsg) {
        setMessages(prev => [...prev, newMsg]);
        if (requestStatus === 'none') setRequestStatus('pending');
      }
    } catch {
      showToast('Could not share event.', 'error');
    } finally {
      setMediaLoading(false);
    }
  };

  // ── Share Gruv: open a picker of events you can actually share ────────────────
  // Your upcoming events — the ones you host or are going to — are what you'd
  // want to send someone. Deduped, soonest first.
  const openEventPicker = async () => {
    setShowAttachmentMenu(false);
    setPickerSearch('');
    setEventPickerVisible(true);
    setPickerLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const cols = 'id, title, event_date, venue_name, cover_url, cover_image, image_url';
      const [hosted, rsvps] = await Promise.all([
        supabase.from('events').select(cols)
          .eq('author_id', user.id).gte('event_date', today)
          .order('event_date', { ascending: true }).limit(25),
        supabase.from('event_rsvps').select(`events:event_id(${cols})`)
          .eq('user_id', user.id).eq('status', 'going').limit(25),
      ]);
      const going = (rsvps.data || []).map(r => r.events).filter(Boolean);
      const seen = new Set();
      const merged = [...(hosted.data || []), ...going]
        .filter(e => e && !seen.has(e.id) && seen.add(e.id));
      setPickerEvents(merged);
    } catch { setPickerEvents([]); }
    finally { setPickerLoading(false); }
  };

  const pickAndShareEvent = (ev) => {
    setEventPickerVisible(false);
    handleShareEvent(ev.id);
  };

  // ── Render Shared Event ──────────────────────────────────────────────────────
  const renderEventShare = (evId) => (
    <SharedEventCard
      evId={evId}
      onPress={() => onNavigateToEvent?.({ id: evId })}
      primary={primary}
      textColor={textColor}
      muted={muted}
    />
  );

  // Pick an image OR video from the library, then PREVIEW it (with an optional
  // caption) before anything uploads — nothing is sent until the user confirms.
  const handlePickMedia = async () => {
    if (inputLocked || requestStatus === 'incoming_request') return;
    setShowAttachmentMenu(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // images + video
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        setPendingCaption('');
        setPendingMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' });
      }
    } catch { showToast('Could not open your library.', 'error'); }
  };

  // Pick any document (pdf, doc, etc.), preview a file card, then send.
  const handlePickDocument = async () => {
    if (inputLocked || requestStatus === 'incoming_request') return;
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const a = result.assets[0];
        setPendingCaption('');
        setPendingMedia({ uri: a.uri, type: 'document', name: a.name || 'file', size: a.size, mime: a.mimeType });
      }
    } catch { showToast('Could not open your files.', 'error'); }
  };

  // Confirm from the preview → upload to storage → send.
  const confirmSendMedia = async () => {
    if (!pendingMedia) return;
    const { uri, type, name } = pendingMedia;
    const caption = pendingCaption.trim();
    setPendingMedia(null);
    setPendingCaption('');
    setMediaLoading(true);
    try {
      const fallbackExt = type === 'video' ? 'mp4' : type === 'document' ? 'bin' : 'jpg';
      const ext = ((name || uri).split('?')[0].split('.').pop() || fallbackExt).toLowerCase();
      // First path segment MUST be the user id — chat_media INSERT policy checks
      // (storage.foldername(name))[1] = auth.uid(). A random token makes the
      // public URL unguessable (listing is already owner-only via RLS).
      const rand = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
      const path = `${user.id}/dm_${Date.now()}_${rand}.${ext}`;
      const publicUrl = await uploadToStorage(uri, 'chat_media', path);
      // Documents carry their filename as the body so the file card can label
      // it (a caption, if given, wins).
      const body = type === 'document' ? (caption || name || 'Document') : caption;
      const newMsg = await MessageManager.send(user.id, recipient.id, body, { messageType: type, mediaUrl: publicUrl });
      if (newMsg) {
        setMessages(prev => [...prev, newMsg]);
        if (requestStatus === 'none') setRequestStatus('pending');
      }
    } catch { showToast('Could not send that.', 'error'); }
    finally { setMediaLoading(false); }
  };

  // ── Share Location ───────────────────────────────────────────────────────────
  const handleShareLocation = async () => {
    if (inputLocked || requestStatus === 'incoming_request') return;
    setMediaLoading(true); // Use mediaLoading for any attachment type
    try {
      const coords = await LocationService.requestAndGet();
      // requestAndGet returns { lat, lon } — reading .latitude/.longitude here
      // (the old code) sent undefined coords, so every "Shared location" arrived
      // with no pin and rendered as dead text.
      const lat = coords?.lat, lng = coords?.lon;
      if (lat != null && lng != null && user && recipient) {
        const newMsg = await MessageManager.send(
          user.id,
          recipient.id,
          'Shared location', // Default body for location message
          { messageType: 'location', latitude: lat, longitude: lng }
        );
        if (newMsg) {
          setMessages(prev => [...prev, newMsg]);
          if (requestStatus === 'none') setRequestStatus('pending');
        }
      } else {
        showToast('Could not get your location. Enable location services.', 'error');
      }
    } catch { showToast('Failed to share location.', 'error'); }
    finally { setMediaLoading(false); }
  };

  // ── Accept request ────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    setRequestStatus('accepted');
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
    try {
      await MessageManager.acceptRequest(recipient.id, user.id);
      const welcomeMsg = await MessageManager.send(user.id, recipient.id, "Locked in! Let's talk.");
      if (welcomeMsg) setMessages(prev => [...prev, welcomeMsg]);
      await fetchMessages();
    } catch {
      showToast('Could not accept request. Try again.', 'error');
    }
  };

  // ── Decline / block ───────────────────────────────────────────────────────────
  const handleDecline = () => {
    Alert.alert(
      'Decline & Block',
      `Block messages from ${recipient?.username}? They won't know you blocked them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            setRequestStatus('declined');
            await BlockManager.block(user.id, recipient.id);
            onClose();
          },
        },
      ]
    );
  };

  // ── Delete message (soft) ────────────────────────────────────────────────────
  const handleDelete = (msgId) => {
    Alert.alert('Delete Message', 'Remove this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await MessageManager.deleteMessage(msgId, user.id);
          setMessages(prev => prev.filter(m => m.id !== msgId));
          setSelectedMsgId(null);
        },
      },
    ]);
  };

  // ── React to message ──────────────────────────────────────────────────────────
  const handleReact = async (msgId, emoji) => {
    setShowReactions(false);
    setReactionMsgId(null);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    // Optimistic: toggle this user's emoji in the local map immediately.
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const map = { ...(m.reactions || {}) };
      if (map[user?.id] === emoji) delete map[user?.id];
      else map[user?.id] = emoji;
      return { ...m, reactions: map };
    }));
    const map = await MessageManager.reactToMessage(msgId, emoji, user?.id);
    // Reconcile with the server's authoritative map (no-op if it matched).
    if (map) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: map } : m));
  };

  // ── Render message bubble ─────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }) => {
    const isMine = item.sender_id === user?.id;
    const showDate = index === 0 || fmtDate(item.created_at) !== fmtDate(messages[index - 1]?.created_at);
    const isSelected = selectedMsgId === item.id;

    return (
      <>
        {showDate && <DateSep label={fmtDate(item.created_at)} muted={muted} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 6 }}>
          {isMultiSelectMode && (
            <TouchableOpacity
              onPress={() => {
                setSelectedMsgIds(prev => {
                  const next = new Set(prev);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  return next;
                });
              }}
              style={{ padding: 12, paddingRight: 4, alignSelf: 'center' }}
            >
              <Feather
                name={selectedMsgIds.has(item.id) ? "check-square" : "square"}
                size={18}
                color={selectedMsgIds.has(item.id) ? primary : muted}
              />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              onLongPress={() => {
                if (isMultiSelectMode) return;
                setSelectedMsgId(isSelected ? null : item.id);
                if (!isMine) {
                  setReactionMsgId(item.id);
                  setShowReactions(true);
                }
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { }
              }}
              onPress={() => {
                if (isMultiSelectMode) {
                  setSelectedMsgIds(prev => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                } else if (isSelected) {
                  setSelectedMsgId(null);
                }
              }}
              activeOpacity={0.85}
              style={[isMine ? dm.bubbleMine : dm.bubbleTheirs]}
            >
              <View style={[
                dm.bubbleInner,
                {
                  borderBottomRightRadius: isMine ? 4 : 18,
                  borderBottomLeftRadius: isMine ? 18 : 4,
                  backgroundColor: isMine ? primary : bg,
                },
              ]}>
                {item.parent_id && (() => {
                  const p1 = messages.find(m => m.id === item.parent_id);
                  if (!p1) return null;
                  const p2 = p1.parent_id ? messages.find(m => m.id === p1.parent_id) : null;
                  const p3 = p2?.parent_id ? messages.find(m => m.id === p2.parent_id) : null;
                  return (
                    <View style={[dm.replyQuote, { backgroundColor: isMine ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)', borderLeftWidth: 3, borderLeftColor: isMine ? 'rgba(0,0,0,0.3)' : primary, marginBottom: 8 }]}>
                      {p3 && (
                        <View style={{ borderLeftWidth: 2, borderLeftColor: isMine ? 'rgba(0,0,0,0.2)' : primary, paddingLeft: 6, marginBottom: 4, opacity: 0.4 }}>
                          <Text style={{ color: isMine ? 'rgba(0,0,0,0.6)' : muted, fontSize: 9, fontWeight: '800' }}>LEVEL 1</Text>
                          <Text style={{ color: isMine ? 'rgba(0,0,0,0.7)' : muted, fontSize: 10 }} numberOfLines={1}>{p3.body || '[Media/Shared Event]'}</Text>
                        </View>
                      )}
                      {p2 && (
                        <View style={{ borderLeftWidth: 2, borderLeftColor: isMine ? 'rgba(0,0,0,0.2)' : primary, paddingLeft: 6, marginBottom: 4, opacity: 0.7 }}>
                          <Text style={{ color: isMine ? 'rgba(0,0,0,0.6)' : muted, fontSize: 9, fontWeight: '800' }}>LEVEL 2</Text>
                          <Text style={{ color: isMine ? 'rgba(0,0,0,0.7)' : muted, fontSize: 11 }} numberOfLines={1}>{p2.body || '[Media/Shared Event]'}</Text>
                        </View>
                      )}
                      <View style={{ borderLeftWidth: 2, borderLeftColor: isMine ? 'rgba(0,0,0,0.2)' : primary, paddingLeft: 6 }}>
                        <Text style={{ color: isMine ? 'rgba(0,0,0,0.6)' : primary, fontSize: 9, fontWeight: '900' }}>REPLYING TO</Text>
                        <Text style={{ color: isMine ? '#000' : textColor, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
                          {p1.body || '[Media/Shared Event]'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {item.message_type === 'image' && item.media_url && (
                  <SignedImage source={item.media_url} style={dm.bubbleImage} resizeMode="cover" />
                )}
                {item.message_type === 'video' && item.media_url && (
                  <Video
                    source={{ uri: item.media_url }}
                    style={dm.bubbleImage}
                    useNativeControls
                    resizeMode="contain"
                  />
                )}
                {item.message_type === 'document' && item.media_url && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(item.media_url)}
                    style={[dm.docCard, { borderColor: isMine ? 'rgba(0,0,0,0.15)' : `${primary}30`, backgroundColor: isMine ? 'rgba(0,0,0,0.05)' : `${primary}0f` }]}
                  >
                    <View style={[dm.docIcon, { backgroundColor: isMine ? 'rgba(0,0,0,0.08)' : `${primary}20` }]}>
                      <Feather name="file-text" size={20} color={isMine ? '#000' : primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isMine ? '#000' : textColor, fontWeight: '800', fontSize: 13 }} numberOfLines={2}>{item.body || 'Document'}</Text>
                      <Text style={{ color: isMine ? 'rgba(0,0,0,0.5)' : muted, fontSize: 11 }}>Tap to open</Text>
                    </View>
                    <Feather name="download" size={16} color={isMine ? 'rgba(0,0,0,0.5)' : primary} />
                  </TouchableOpacity>
                )}
                {item.message_type === 'vibe_card' && (
                  <VibeCardBubble
                    userId={item.sender_id}
                    primary={primary}
                    textColor={textColor}
                    muted={muted}
                    onPress={() => { setProfileTarget(item.sender_id); setProfileModalVisible(true); }}
                  />
                )}
                {item.event_id && item.message_type !== 'vibe_card' && renderEventShare(item.event_id)}
                {item.message_type === 'location' && item.latitude && item.longitude ? (
                  <TouchableOpacity
                    onPress={() => {
                      setMapTarget({
                        title: 'Shared Location',
                        venue_name: `${recipient?.username || 'Viber'}'s location`,
                        lat: item.latitude,
                        lon: item.longitude,
                        category: 'wellness'
                      });
                      LocationService.requestAndGet().then(setUserCoords).catch(() => {});
                      setMapVisible(true);
                    }}
                    style={dm.locationBubble}
                  >
                    <Feather name="map-pin" size={16} color={isMine ? '#000' : primary} />
                    <Text style={[dm.bodyText, { color: isMine ? '#000' : primary, marginLeft: 5 }]}>Shared Location</Text>
                    <Text style={[dm.timeText, { color: isMine ? 'rgba(0,0,0,0.5)' : muted, marginLeft: 10 }]}>Tap to view</Text>
                  </TouchableOpacity>
                ) : (item.body && item.message_type !== 'vibe_card' && item.message_type !== 'document') ? (
                  <Text style={[dm.bodyText, { color: isMine ? '#000' : textColor }]}>{transform(item.body, msgStyles[item.sender_id])}</Text>
                ) : null}
                {item.reactions && Object.keys(item.reactions).length > 0 && (() => {
                  // reactions is { userId: emoji } — collapse to counts per emoji,
                  // and mark the ones I placed so mine read as "selected".
                  const counts = {};
                  for (const [uid, e] of Object.entries(item.reactions)) {
                    if (!counts[e]) counts[e] = { n: 0, mine: false };
                    counts[e].n += 1;
                    if (uid === user?.id) counts[e].mine = true;
                  }
                  return (
                    <View style={dm.reactionBubble}>
                      {Object.entries(counts).map(([e, { n, mine }]) => (
                        <View key={e} style={[dm.reactionChip, mine && { borderColor: primary, borderWidth: 1 }]}>
                          <Text style={{ fontSize: 13 }}>{e}</Text>
                          {n > 1 && <Text style={{ fontSize: 10, color: '#fff', fontWeight: '800', marginLeft: 2 }}>{n}</Text>}
                        </View>
                      ))}
                    </View>
                  );
                })()}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 2 }}>
                  <Text
                    style={[
                      dm.timeText,
                      {
                        color: !isMine
                          ? muted
                          : item.read_at
                            ? "#10b981" // green for read
                            : item.delivered_at
                              ? "#ff9800" // orange for delivered
                              : "#ef4444" // red for sent
                      }
                    ]}
                  >
                    {fmtTime(item.created_at)}
                  </Text>
                </View>
              </View>

              {/* Failed message retry */}
              {item._failed && isMine && (
                <TouchableOpacity
                  style={[dm.deleteBtn, { backgroundColor: '#ef444420' }]}
                  onPress={() => {
                    setMessages(prev => prev.filter(m => m.id !== item.id));
                    setBody(item.body || '');
                  }}
                >
                  <Feather name="refresh-cw" size={14} color="#ef4444" />
                </TouchableOpacity>
              )}

              {/* Long-press actions menu inline */}
              {isSelected && !item._failed && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' }}
                    onPress={() => {
                      setReplyingTo(item);
                      setSelectedMsgId(null);
                    }}
                  >
                    <Feather name="corner-up-left" size={12} color={isMine ? 'rgba(0,0,0,0.6)' : primary} />
                    <Text style={{ color: isMine ? '#000' : primary, fontSize: 11, fontWeight: '800' }}>Reply</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' }}
                    onPress={() => {
                      setIsMultiSelectMode(true);
                      setSelectedMsgIds(new Set([item.id]));
                      setSelectedMsgId(null);
                    }}
                  >
                    <Feather name="check-square" size={12} color={isMine ? 'rgba(0,0,0,0.6)' : primary} />
                    <Text style={{ color: isMine ? '#000' : primary, fontSize: 11, fontWeight: '800' }}>Select</Text>
                  </TouchableOpacity>
                  {isMine && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)' }}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Feather name="trash-2" size={12} color="#ef4444" />
                      <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: '800' }}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Reaction picker */}
        {showReactions && reactionMsgId === item.id && (
          <View style={[dm.reactionPickerWrap, { alignSelf: 'flex-start', marginLeft: 16, marginTop: -4, marginBottom: 8 }]}>
            <ReactionPicker
              primary={primary}
              onSelect={(emoji) => handleReact(item.id, emoji)}
              onClose={() => { setShowReactions(false); setReactionMsgId(null); }}
            />
          </View>
        )}
      </>
    );
  }, [user?.id, messages, selectedMsgId, reactionMsgId, showReactions, primary, bg, muted, textColor, isMultiSelectMode, selectedMsgIds,
      handleDelete, handleReact, setSelectedMsgId, setReactionMsgId, setShowReactions, setMessages, setBody]);

  // Determine if the current user is the recipient of the *first* message in the thread
  // and if that message is a request that hasn't been accepted yet.
  const firstMessage = messages[0];
  const isIAmRecipientOfPendingRequest = firstMessage && firstMessage.recipient_id === user?.id && firstMessage.is_request && !firstMessage.request_accepted;

  // Allow up to 3 messages while a request is pending; lock after the 3rd
  const myPendingCount = messages.filter(m => m.sender_id === user?.id).length;
  const inputLocked = (requestStatus === 'pending' && myPendingCount >= 3) || requestStatus === 'declined';

  const inner = (
    <>
      <KeyboardAvoidingView
        style={[dm.root, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={embedded ? 0 : insets.top}
      >
        {/* Header */}
        <View style={[dm.header, { borderBottomColor: `${primary}18`, paddingTop: embedded ? 14 : insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={dm.backBtn}>
            <Feather name={embedded ? 'x' : 'arrow-left'} size={22} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity style={dm.headerInfo} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
            {recipient?.avatar_url
              ? <SmartImage source={recipient.avatar_url} style={dm.headerAvatar} />
              : <View style={[dm.headerAvatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="user" size={16} color={primary} />
              </View>
            }
            <View>
              <Text style={[dm.headerName, { color: textColor }]}>{recipient?.username || 'Viber'}</Text>
              {isTyping
                ? <Text style={[dm.headerSub, { color: primary }]}>typing...</Text>
                : checkOnline(recipient)
                  ? <Text style={[dm.headerSub, { color: "#10b981" }]}>● Online</Text>
                  : <Text style={[dm.headerSub, { color: muted }]}>Offline</Text>
              }
              {crossPathCount > 0 && (
                <View style={[dm.pathBadge, { backgroundColor: `${primary}20` }]}>
                  <Text style={{ color: primary, fontSize: 8, fontWeight: '900' }}>{crossPathCount} CROSSINGS</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          {/* Voice / video call (web-first; hidden where WebRTC isn't available) */}
          {callSupported && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity onPress={() => startCall(false)} style={dm.callBtn} accessibilityLabel="Voice call">
                <Feather name="phone" size={18} color={primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => startCall(true)} style={dm.callBtn} accessibilityLabel="Video call">
                <Feather name="video" size={18} color={primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Request banner — shown to recipient of a pending request */}
        {isIAmRecipientOfPendingRequest && (
          <RequestBanner
            sender={recipient}
            onAccept={handleAccept}
            onDecline={handleDecline}
            primary={primary}
            textColor={textColor}
            muted={muted}
          />
        )}

        {/* Proof of presence — the warmest intro there is, and it can't be faked.
            Only shows when BOTH people verifiably Touched Down at the same event. */}
        {sharedMet && (
          <TouchableOpacity
            activeOpacity={sharedMet.eventId ? 0.75 : 1}
            onPress={() => { if (sharedMet.eventId) onNavigateToEvent?.(sharedMet.eventId); }}
            style={[dm.metBanner, { backgroundColor: `${primary}12`, borderColor: `${primary}35` }]}
          >
            <View style={[dm.metIcon, { backgroundColor: `${primary}22` }]}>
              <Feather name="check-circle" size={13} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[dm.metText, { color: textColor }]} numberOfLines={2}>
                You both <Text style={{ fontWeight: '900', color: primary }}>Touched Down</Text> at{' '}
                <Text style={{ fontWeight: '800' }}>{sharedMet.title}</Text>
                {sharedMet.more ? ` and ${sharedMet.more} more` : ''}
                {sharedMet.when ? ` · ${sharedMet.when}` : ''}
              </Text>
              <Text style={[dm.metSub, { color: muted }]}>Verified — you've actually met</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Sender's pending request status */}
        {requestStatus === 'pending' && !isIAmRecipientOfPendingRequest && (
          <View style={[dm.pendingSenderBanner, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
            <Feather name="clock" size={14} color={primary} />
            <Text style={[dm.pendingSenderText, { color: primary }]}>Waiting for @{recipient?.username} to accept your request...</Text>
            {/* Optional: Add a button to cancel the request */}
          </View>
        )}

        {/* Message list */}
        {loading
          ? <DMSkeleton primary={primary} muted={muted} />
          : <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                <Feather name="message-circle" size={44} color={muted} style={{ opacity: 0.4 }} />
                <Text style={{ color: muted, fontSize: 14, fontWeight: '700' }}>
                  {requestStatus === 'pending' ? 'Message sent. Waiting for them to accept...' : 'Start the conversation'}
                </Text>
              </View>
            }
          />
        }

        {/* Typing indicator */}
        {isTyping && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            <TypingDots primary={primary} bg={bg} />
          </View>
        )}

        {/* Pending request limit notice — slim bar above input, never hides messages */}
        {requestStatus === 'pending' && !isIAmRecipientOfPendingRequest && myPendingCount >= 3 && (
          <View style={[dm.pendingLimitBar, { backgroundColor: `${primary}10`, borderColor: `${primary}25` }]}>
            <Feather name="lock" size={13} color={muted} />
            <Text style={[dm.pendingLimitText, { color: muted }]}>
              3 messages sent — waiting for @{recipient?.username} to accept before you can send more.
            </Text>
          </View>
        )}
        {requestStatus === 'declined' && !isIAmRecipientOfPendingRequest && (
          <View style={[dm.pendingLimitBar, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]}>
            <Feather name="x-circle" size={13} color="#ef4444" />
            <Text style={[dm.pendingLimitText, { color: "#ef4444" }]}>Request declined — messaging blocked.</Text>
          </View>
        )}

        {isMultiSelectMode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: `${primary}18`, backgroundColor: bg, paddingBottom: insets.bottom || 14 }}>
            <Text style={{ color: textColor, fontWeight: '700', fontSize: 13 }}>
              {selectedMsgIds.size} message(s) selected
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setIsMultiSelectMode(false);
                  setSelectedMsgIds(new Set());
                }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: `${primary}25` }}
              >
                <Text style={{ color: textColor, fontWeight: '700', fontSize: 12 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={selectedMsgIds.size === 0 || sharingLoading}
                onPress={() => {
                  fetchConversations();
                  setShowShareModal(true);
                }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: primary, opacity: selectedMsgIds.size === 0 || sharingLoading ? 0.5 : 1 }}
              >
                {sharingLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>Share to...</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Reply Preview */}
            {replyingTo && (
              <View style={[dm.replyPreview, { backgroundColor: bg, borderTopColor: `${primary}18` }]}>
                <View style={[dm.replyBar, { backgroundColor: primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: primary, fontSize: 11, fontWeight: '900' }}>Replying to @{replyingTo.sender_id === user?.id ? 'yourself' : recipient.username}</Text>
                  <Text style={{ color: muted, fontSize: 12 }} numberOfLines={1}>{replyingTo.body}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)}><Feather name="x" size={16} color={muted} /></TouchableOpacity>
              </View>
            )}

            {/* Attachment Menu */}
            {showAttachmentMenu && (
              <View style={[dm.attachMenu, { backgroundColor: bg, borderTopColor: `${primary}18` }]}>
                {[
                  { label: 'Photo / Video', icon: 'image', onPress: handlePickMedia },
                  { label: 'Document', icon: 'file-text', onPress: handlePickDocument },
                  { label: 'Location', icon: 'map-pin', onPress: handleShareLocation },
                  { label: 'Share Gruv', icon: 'zap', onPress: openEventPicker },
                  { label: 'Vibe Card', icon: 'user', onPress: handleShareVibeCard },
                ].map(item => (
                  <TouchableOpacity key={item.label} onPress={item.onPress} style={dm.attachMenuItem}>
                    <View style={[dm.attachMenuIcon, { backgroundColor: `${primary}15` }]}><Feather name={item.icon} size={18} color={primary} /></View>
                    <Text style={[dm.attachMenuLabel, { color: textColor }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={[dm.inputRow, { borderTopColor: `${primary}18`, paddingBottom: insets.bottom || 12 }]}>
              <TouchableOpacity
                style={[dm.attachBtn, { backgroundColor: `${primary}15` }]}
                onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
                disabled={inputLocked || requestStatus === 'incoming_request' || mediaLoading}
              >
                {mediaLoading
                  ? <ActivityIndicator size="small" color={primary} />
                  : <Feather name={showAttachmentMenu ? "x" : "plus"} size={18} color={primary} />
                }
              </TouchableOpacity>
              <TextInput
                style={[dm.input, { color: textColor, backgroundColor: `${bg}cc`, borderWidth: 1, borderColor: `${primary}18`, opacity: inputLocked ? 0.5 : 1 }]}
                placeholder={
                  inputLocked
                    ? 'Waiting for them to accept...'
                    : requestStatus === 'incoming_request'
                      ? 'Accept to reply...'
                      : 'Message...'
                }
                placeholderTextColor={muted}
                value={body}
                onChangeText={handleTextChange}
                multiline
                maxLength={2000}
                editable={!inputLocked && requestStatus !== 'incoming_request'}
                returnKeyType="default"
              />
              <TouchableOpacity
                style={[dm.sendBtn, { backgroundColor: body.trim() && !inputLocked ? primary : `${primary}30` }]}
                onPress={handleSend}
                disabled={!body.trim() || inputLocked || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Feather name="send" size={18} color={body.trim() && !inputLocked ? '#000' : muted} />
                }
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* The call overlay + permission UI are rendered globally by CallProvider. */}

      <React.Suspense fallback={null}>
        <ViberProfileModal
          visible={profileModalVisible}
          user={profileTarget && profileTarget !== recipient?.id ? undefined : recipient}
          userId={profileTarget || recipient?.id}
          onClose={() => { setProfileModalVisible(false); setProfileTarget(null); }}
          onNavigateToEvent={onNavigateToEvent}
        />
      </React.Suspense>

      {/* Media preview — confirm before sending an image / video */}
      <Modal visible={!!pendingMedia} transparent animationType="fade" onRequestClose={() => setPendingMedia(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: (insets.top || 12) + 8 }}>
            <TouchableOpacity onPress={() => { setPendingMedia(null); setPendingCaption(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
              {pendingMedia?.type === 'video' ? 'Send video' : pendingMedia?.type === 'document' ? 'Send document' : 'Send photo'}
            </Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
            {pendingMedia?.type === 'video'
              ? <Video source={{ uri: pendingMedia.uri }} style={{ width: '100%', height: '80%' }} useNativeControls resizeMode="contain" shouldPlay={false} />
              : pendingMedia?.type === 'document'
                ? (
                  <View style={{ alignItems: 'center', gap: 14, padding: 24 }}>
                    <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="file-text" size={40} color={primary} />
                    </View>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' }} numberOfLines={3}>{pendingMedia?.name || 'Document'}</Text>
                    {pendingMedia?.size ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{(pendingMedia.size / 1024).toFixed(0)} KB</Text> : null}
                  </View>
                )
                : pendingMedia?.uri
                  ? <SmartImage source={pendingMedia.uri} style={{ width: '100%', height: '80%', borderRadius: 12 }} resizeMode="contain" />
                  : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: (insets.bottom || 12) + 10 }}>
            <TextInput
              value={pendingCaption}
              onChangeText={setPendingCaption}
              placeholder="Add a caption..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={{ flex: 1, color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 }}
            />
            <TouchableOpacity onPress={confirmSendMedia} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: primary, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="send" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Share Gruv — event picker */}
      <Modal visible={eventPickerVisible} transparent animationType="slide" onRequestClose={() => setEventPickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%', minHeight: 300, borderTopWidth: 1, borderTopColor: `${primary}25`, paddingBottom: insets.bottom || 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '900' }}>Share a Gruv</Text>
              <TouchableOpacity onPress={() => setEventPickerVisible(false)}>
                <Feather name="x" size={20} color={textColor} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${primary}10`, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 }}>
              <Feather name="search" size={15} color={muted} />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search your events..."
                placeholderTextColor={muted}
                style={{ flex: 1, color: textColor, paddingVertical: 10, fontSize: 14 }}
              />
            </View>
            {pickerLoading ? (
              <ActivityIndicator color={primary} style={{ marginVertical: 40 }} />
            ) : (
              <FlatList
                data={pickerSearch.trim()
                  ? pickerEvents.filter(e => (e.title || '').toLowerCase().includes(pickerSearch.toLowerCase()))
                  : pickerEvents}
                keyExtractor={item => String(item.id)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={{ color: muted, textAlign: 'center', marginTop: 40 }}>
                    No upcoming events yet. Host one or RSVP going, then share it here.
                  </Text>
                }
                renderItem={({ item }) => {
                  const cover = item.cover_url || item.cover_image || item.image_url;
                  return (
                    <TouchableOpacity
                      onPress={() => pickAndShareEvent(item)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
                    >
                      {cover
                        ? <SmartImage source={cover} style={{ width: 48, height: 48, borderRadius: 10 }} />
                        : <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: `${primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="calendar" size={18} color={primary} />
                          </View>}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{item.title || 'Untitled event'}</Text>
                        <Text style={{ color: muted, fontSize: 12 }} numberOfLines={1}>
                          {[item.event_date, item.venue_name].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Feather name="send" size={16} color={primary} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Share Contacts Modal */}
      <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 320, borderTopWidth: 1, borderTopColor: `${primary}25`, paddingBottom: insets.bottom || 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '900' }}>Forward selected messages to...</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Feather name="x" size={20} color={textColor} />
              </TouchableOpacity>
            </View>
            {conversations.length === 0 ? (
              <Text style={{ color: muted, textAlign: 'center', marginTop: 40 }}>No other active conversations found.</Text>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleShareToConvo(item.partner)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="user" size={16} color={primary} />
                    </View>
                    <Text style={{ color: textColor, fontWeight: '800' }}>{item.partner?.username}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Internal Map Modal */}
      {mapVisible && (
        <EventMapView
          visible={mapVisible}
          onClose={() => setMapVisible(false)}
          events={mapTarget ? [mapTarget] : []}
          userCoords={userCoords}
          onSelectEvent={() => setMapVisible(false)}
        />
      )}
    </>
  );

  // Split-pane / desktop: render inline as a panel, no Modal chrome.
  if (embedded) return <View style={[dm.root, { flex: 1, backgroundColor: bg }]}>{inner}</View>;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {inner}
    </Modal>
  );
};

const dm = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,242,255,0.08)' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerName: { fontSize: 15, fontWeight: '800' },
  headerSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  bubble: { marginBottom: 6 },
  bubbleMine: { alignItems: 'flex-end', paddingRight: 16 },
  bubbleTheirs: { alignItems: 'flex-start', paddingLeft: 16 },
  bubbleInner: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  timeText: { fontSize: 10, marginTop: 2 },
  reactionBubble: { position: 'absolute', bottom: -12, right: 6, flexDirection: 'row', gap: 3, alignItems: 'center' },
  reactionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#1a2225", borderColor: 'transparent', borderWidth: 1, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  deleteBtn: { marginTop: 4, padding: 8, borderRadius: 10, alignSelf: 'flex-end' },
  reactionPickerWrap: {},
  attachMenu: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8, borderTopWidth: 1 },
  attachMenuItem: { alignItems: 'center', justifyContent: 'flex-start', gap: 7, width: 72, paddingVertical: 4 },
  attachMenuIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  attachMenuLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1 },
  attachBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bubbleImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 8 },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10, width: 240, marginBottom: 4 },
  docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  eventBar: { width: 4, height: '100%' },
  eventTitle: { fontSize: 13, fontWeight: '800' },
  eventSub: { fontSize: 10 },
  replyQuote: { padding: 8, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: 'rgba(0,0,0,0.2)', marginBottom: 8 },
  replyPreview: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderTopWidth: 1 },
  replyBar: { width: 3, height: '80%', borderRadius: 2 },
  locationBubble: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)' },
  pendingSenderBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  // Proof-of-presence banner
  metBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  metIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metText: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  metSub: { fontSize: 10.5, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  pendingSenderText: { flex: 1, fontSize: 13, fontWeight: '700' },
  pendingLimitBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  pendingLimitText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
});
