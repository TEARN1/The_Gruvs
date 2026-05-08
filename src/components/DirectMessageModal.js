/**
 * DirectMessageModal — Advanced real-time 1-on-1 messaging.
 * Features: message request/accept/decline, real-time typing indicator,
 * read receipts (✓ / ✓✓ / blue ✓✓), message deletion, block sender.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Modal, FlatList, TextInput, TouchableOpacity,
  Image, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from './GlassView';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// ── Read receipt tick component ────────────────────────────────────────────────
const Ticks = ({ msg, userId, primary }) => {
  if (msg.sender_id !== userId) return null;
  if (msg.read_at) return (
    <Text style={{ fontSize: 11, color: primary, marginLeft: 4 }}>✓✓</Text>
  );
  if (msg.delivered_at) return (
    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>✓✓</Text>
  );
  return <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>✓</Text>;
};

// ── Typing indicator dots ──────────────────────────────────────────────────────
const TypingDots = ({ primary }) => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ])
    ).start();
    anim(dot1, 0); anim(dot2, 150); anim(dot3, 300);
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 10, paddingHorizontal: 14, backgroundColor: '#1e2a2d', borderRadius: 18, alignSelf: 'flex-start', marginBottom: 8 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: primary, opacity: d }} />
      ))}
    </View>
  );
};

// ── Message Request Banner ─────────────────────────────────────────────────────
const RequestBanner = ({ recipient, onAccept, onDecline, primary, textColor, muted }) => (
  <View style={[rb.wrap, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]}>
    <View style={rb.avatarWrap}>
      {recipient?.avatar_url
        ? <Image source={{ uri: recipient.avatar_url }} style={rb.avatar} />
        : <View style={[rb.avatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="user" size={22} color={primary} />
          </View>
      }
    </View>
    <Text style={[rb.name, { color: textColor }]}>@{recipient?.username || 'Viber'} wants to link up</Text>
    <Text style={[rb.sub, { color: muted }]}>Accept to reply and start the conversation. Decline to block.</Text>
    <View style={rb.actions}>
      <TouchableOpacity onPress={onDecline} style={[rb.btn, rb.declineBtn]}>
        <Feather name="x" size={16} color="#ef4444" />
        <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>Decline</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onAccept} style={[rb.btn, rb.acceptBtn, { backgroundColor: primary }]}>
        <Feather name="check" size={16} color="#000" />
        <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Lock In</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const rb = StyleSheet.create({
  wrap: { margin: 14, padding: 18, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  name: { fontSize: 15, fontWeight: '900', marginBottom: 6 },
  sub: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14 },
  declineBtn: { borderWidth: 1, borderColor: '#ef444450' },
  acceptBtn: {},
});

// ── Date separator ─────────────────────────────────────────────────────────────
const DateSep = ({ label, muted }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
    <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
  </View>
);

// ── Main component ─────────────────────────────────────────────────────────────
export const DirectMessageModal = ({ visible, onClose, recipient }) => {
  const { currentTheme }  = useTheme();
  const { user }          = useAuth();
  const insets            = useSafeAreaInsets();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [messages,        setMessages]        = useState([]);
  const [body,            setBody]            = useState('');
  const [loading,         setLoading]         = useState(false);
  const [sending,         setSending]         = useState(false);
  const [isTyping,        setIsTyping]        = useState(false);        // recipient is typing
  const [requestStatus,   setRequestStatus]   = useState('none');       // 'none' | 'pending' | 'accepted' | 'declined'
  const [selectedMsgId,   setSelectedMsgId]   = useState(null);

  const flatRef       = useRef(null);
  const channelRef    = useRef(null);
  const presenceRef   = useRef(null);
  const typingTimeout = useRef(null);

  // ── Load messages + resolve request status ───────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!user || !recipient) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    const msgs = data || [];
    setMessages(msgs);

    // Resolve request status: has the OTHER person ever replied?
    const theyReplied = msgs.some(m => m.sender_id === recipient.id);
    const iSent = msgs.some(m => m.sender_id === user.id);
    if (!iSent && !theyReplied) {
      setRequestStatus('none');           // fresh — no messages yet
    } else if (iSent && !theyReplied) {
      setRequestStatus('pending');        // I sent, they haven't replied — they see a request
    } else {
      setRequestStatus('accepted');       // conversation is live
    }

    // Mark unread messages from recipient as read
    const unread = msgs.filter(m => m.sender_id === recipient.id && !m.read_at).map(m => m.id);
    if (unread.length > 0) {
      await supabase.from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread);
    }
  }, [user, recipient]);

  // ── Real-time message subscription ───────────────────────────────────────────
  useEffect(() => {
    if (!visible || !user || !recipient) return;
    setLoading(true);
    fetchMessages().finally(() => setLoading(false));

    // Subscribe to new messages in this conversation
    const chanKey = `dm_${[user.id, recipient.id].sort().join('_')}`;
    const channel = supabase
      .channel(chanKey)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, async (payload) => {
        if (payload.new.sender_id !== recipient.id) return;
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        setRequestStatus('accepted'); // they replied = accepted
        // Mark as read immediately if modal is open
        await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id);
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        // Update read/delivered receipts in-place
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();

    channelRef.current = channel;

    // ── Presence channel for typing indicator ────────────────────────────────
    const presKey = `presence_${chanKey}`;
    const presence = supabase.channel(presKey, { config: { presence: { key: user.id } } });
    presence
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState();
        const recipientTyping = Object.entries(state).some(([key, arr]) =>
          key === recipient.id && arr.some(s => s.typing)
        );
        setIsTyping(recipientTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ typing: false, online: true });
        }
      });
    presenceRef.current = presence;

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presence);
      channelRef.current = null;
      presenceRef.current = null;
    };
  }, [visible, user, recipient, fetchMessages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  // ── Typing broadcast ──────────────────────────────────────────────────────────
  const broadcastTyping = useCallback(async (isTypingNow) => {
    if (!presenceRef.current) return;
    await presenceRef.current.track({ typing: isTypingNow, online: true }).catch(() => {});
  }, []);

  const handleTextChange = useCallback((text) => {
    setBody(text);
    broadcastTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => broadcastTyping(false), 1500);
  }, [broadcastTyping]);

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !user || !recipient || sending) return;
    setSending(true);
    setBody('');
    broadcastTyping(false);

    const { data: newMsg } = await supabase.from('messages').insert({
      sender_id:    user.id,
      recipient_id: recipient.id,
      body:         trimmed,
    }).select().single();

    if (newMsg) {
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      if (requestStatus === 'none') setRequestStatus('pending');
    }
    setSending(false);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  };

  // ── Accept / Decline request ──────────────────────────────────────────────────
  const handleAccept = async () => {
    setRequestStatus('accepted');
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    // Send an acceptance message
    await supabase.from('messages').insert({
      sender_id: user.id, recipient_id: recipient.id,
      body: "🔒 Locked in! Let's talk.",
    });
    await fetchMessages();
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline & Block',
      `Block messages from @${recipient?.username}? They won't know you blocked them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            setRequestStatus('declined');
            // Store block (best-effort — table may not exist)
            await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: recipient.id }).catch(() => {});
            onClose();
          },
        },
      ]
    );
  };

  // ── Delete message ────────────────────────────────────────────────────────────
  const handleDelete = async (msgId) => {
    Alert.alert('Delete Message', 'Remove this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('messages').delete().eq('id', msgId).eq('sender_id', user.id);
          setMessages(prev => prev.filter(m => m.id !== msgId));
          setSelectedMsgId(null);
        },
      },
    ]);
  };

  // ── Render a single message bubble ───────────────────────────────────────────
  const renderItem = useCallback(({ item, index }) => {
    const isMine = item.sender_id === user?.id;
    const showDate = index === 0 || fmtDate(item.created_at) !== fmtDate(messages[index - 1]?.created_at);
    const isSelected = selectedMsgId === item.id;

    return (
      <>
        {showDate && <DateSep label={fmtDate(item.created_at)} muted={muted} />}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => {
            if (isMine) {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
              setSelectedMsgId(isSelected ? null : item.id);
            }
          }}
        >
          <View style={[dm.msgRow, isMine ? dm.rowRight : dm.rowLeft]}>
            {!isMine && (
              <Image
                source={recipient?.avatar_url ? { uri: recipient.avatar_url } : undefined}
                style={dm.msgAvatar}
                defaultSource={undefined}
              />
            )}
            <View style={{ maxWidth: '74%' }}>
              <View style={[
                dm.bubble,
                isMine
                  ? [dm.bubbleMine, { backgroundColor: primary }]
                  : dm.bubbleTheirs,
              ]}>
                <Text style={[dm.bubbleText, { color: isMine ? '#000' : textColor }]}>
                  {item.body}
                </Text>
              </View>
              <View style={[dm.metaRow, isMine ? { alignSelf: 'flex-end' } : {}]}>
                <Text style={[dm.timeText, { color: muted }]}>{fmtTime(item.created_at)}</Text>
                <Ticks msg={item} userId={user.id} primary={primary} />
              </View>
            </View>
          </View>
          {isSelected && isMine && (
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={[dm.deleteBtn, { borderColor: '#ef444430' }]}
            >
              <Feather name="trash-2" size={13} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>Delete</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </>
    );
  }, [user, recipient, primary, textColor, muted, messages, selectedMsgId]);

  // ── Determine what to show in the body ───────────────────────────────────────
  // If I am the recipient seeing a request from them for the first time
  const iAmRecipientOfRequest =
    requestStatus === 'pending' &&
    messages.length > 0 &&
    messages[messages.length - 1].sender_id === recipient?.id;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[dm.root, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[dm.header, { paddingTop: (insets.top || 0) + 12, borderBottomColor: `${primary}15`, backgroundColor: bg }]}>
          <TouchableOpacity onPress={onClose} style={dm.backBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
            <Feather name="arrow-left" size={22} color={textColor} />
          </TouchableOpacity>

          <View style={dm.headerCenter}>
            <View style={{ position: 'relative' }}>
              {recipient?.avatar_url
                ? <Image source={{ uri: recipient.avatar_url }} style={dm.headerAvatar} />
                : <View style={[dm.headerAvatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
                    <Feather name="user" size={18} color={primary} />
                  </View>
              }
              <View style={[dm.onlineDot, { backgroundColor: primary }]} />
            </View>
            <View>
              <Text style={[dm.headerName, { color: textColor }]} numberOfLines={1}>
                @{recipient?.username || 'Viber'}
              </Text>
              {isTyping && (
                <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>typing...</Text>
              )}
            </View>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* ── Message request banner (when I am the recipient) ─────────────── */}
        {iAmRecipientOfRequest && requestStatus === 'pending' && (
          <RequestBanner
            recipient={recipient}
            onAccept={handleAccept}
            onDecline={handleDecline}
            primary={primary}
            textColor={textColor}
            muted={muted}
          />
        )}

        {/* ── Message list ─────────────────────────────────────────────────── */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={primary} />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={messages.length === 0 ? { flex: 1, alignItems: 'center', justifyContent: 'center' } : { paddingHorizontal: 14, paddingVertical: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', gap: 12 }}>
                <Feather name="message-circle" size={48} color={`${primary}30`} />
                <Text style={{ color: muted, fontSize: 14 }}>Send the first message to link up</Text>
              </View>
            }
            ListFooterComponent={isTyping ? <TypingDots primary={primary} /> : null}
          />
        )}

        {/* ── Input bar (hidden if declined) ────────────────────────────────── */}
        {requestStatus !== 'declined' && (
          <View style={[dm.inputBar, { borderTopColor: `${primary}12`, backgroundColor: bg }]}>
            <TextInput
              style={[dm.input, { borderColor: `${primary}30`, color: textColor, backgroundColor: `${primary}06` }]}
              placeholder={requestStatus === 'pending' && !iAmRecipientOfRequest ? 'Message sent — waiting for reply...' : 'Drop a message...'}
              placeholderTextColor={muted}
              value={body}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
              editable={requestStatus !== 'pending' || !iAmRecipientOfRequest}
            />
            <TouchableOpacity
              style={[dm.sendBtn, { backgroundColor: body.trim() ? primary : `${primary}15` }]}
              onPress={handleSend}
              disabled={!body.trim() || sending || (requestStatus === 'pending' && iAmRecipientOfRequest)}
              activeOpacity={0.75}
            >
              {sending
                ? <ActivityIndicator size="small" color="#000" />
                : <Feather name="send" size={18} color={body.trim() ? '#000' : muted} />
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const dm = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#0d1112' },
  headerName: { fontSize: 15, fontWeight: '800' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  rowRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  rowLeft: { alignSelf: 'flex-start' },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, marginBottom: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 2 },
  timeText: { fontSize: 10 },
  deleteBtn: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, marginTop: 4, marginRight: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1, gap: 10 },
  input: { flex: 1, minHeight: 42, maxHeight: 110, borderRadius: 21, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
