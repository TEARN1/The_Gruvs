/**
 * DirectMessageModal — Advanced real-time 1-on-1 messaging.
 * Features: DB-backed message requests, read receipts (✓/✓✓/coloured ✓✓),
 * typing indicator via Presence, soft-delete, emoji reactions, block sender.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Modal, FlatList, TextInput, TouchableOpacity,
  Image, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Alert, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { MessageManager, BlockManager, PresenceManager } from '../services/dataFlow';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ViberProfileModal } from './ViberProfileModal';

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

// ── Read receipt ticks ─────────────────────────────────────────────────────────
const Ticks = ({ msg, userId, primary }) => {
  if (msg.sender_id !== userId) return null;
  if (msg.read_at)      return <Text style={{ fontSize: 11, color: primary, marginLeft: 4 }}>✓✓</Text>;
  if (msg.delivered_at) return <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>✓✓</Text>;
  return <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>✓</Text>;
};

// ── Animated typing dots ───────────────────────────────────────────────────────
const TypingDots = ({ primary }) => {
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
    <View style={{ flexDirection: 'row', gap: 4, padding: 10, paddingHorizontal: 14, backgroundColor: '#1e2a2d', borderRadius: 18, alignSelf: 'flex-start', marginBottom: 8 }}>
      {anims.map((d, i) => <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: primary, opacity: d }} />)}
    </View>
  );
};

// ── Message Request Banner ─────────────────────────────────────────────────────
const RequestBanner = ({ sender, onAccept, onDecline, primary, textColor, muted }) => (
  <View style={[rb.wrap, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]}>
    {sender?.avatar_url
      ? <Image source={{ uri: sender.avatar_url }} style={rb.avatar} />
      : <View style={[rb.avatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
          <Feather name="user" size={22} color={primary} />
        </View>
    }
    <Text style={[rb.name, { color: textColor }]}>@{sender?.username || 'Viber'} wants to link up</Text>
    <Text style={[rb.sub, { color: muted }]}>Accept to reply and start the conversation.</Text>
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
  wrap:       { margin: 14, padding: 18, borderRadius: 18, borderWidth: 1, alignItems: 'center', gap: 8 },
  avatar:     { width: 60, height: 60, borderRadius: 30 },
  name:       { fontSize: 15, fontWeight: '900' },
  sub:        { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  actions:    { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  btn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14 },
  declineBtn: { borderWidth: 1, borderColor: '#ef444450' },
  acceptBtn:  {},
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
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2225', borderRadius: 24, borderWidth: 1, padding: 6, gap: 4 },
  btn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
});

// ── Main component ─────────────────────────────────────────────────────────────
export const DirectMessageModal = ({ visible, onClose, recipient, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user }         = useAuth();
  const insets           = useSafeAreaInsets();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [messages,      setMessages]      = useState([]);
  const [body,          setBody]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [sending,       setSending]       = useState(false);
  const [isTyping,      setIsTyping]      = useState(false);
  const [requestStatus, setRequestStatus] = useState('none'); // 'none'|'pending'|'accepted'|'declined'
  const [selectedMsgId, setSelectedMsgId] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionMsgId, setReactionMsgId] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const flatRef       = useRef(null);
  const channelRef    = useRef(null);
  const presenceRef   = useRef(null);
  const typingTimeout = useRef(null);

  // ── Fetch messages + determine request status ────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!user || !recipient) return;
    const msgs = await MessageManager.fetchThread(user.id, recipient.id);
    setMessages(msgs.filter(m => !m.deleted_at));

    // Determine request status from DB fields
    const myMsg      = msgs.find(m => m.sender_id === user.id);
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

    // Typing subscription
    const unsubTyping = MessageManager.subscribeToTyping(user.id, (p) => {
      if (p.senderId === recipient.id) setIsTyping(p.isTyping);
    });

    const chanKey = `dm_${[user.id, recipient.id].sort().join('_')}_${Math.random().toString(36).substr(2,9)}`;
    const channel = supabase
      .channel(chanKey)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, async (payload) => {
        if (payload.new.sender_id !== recipient.id) return;
        if (payload.new.deleted_at) return;
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        setRequestStatus('accepted');
        // Mark as read instantly since modal is open
        await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id);
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();
    channelRef.current = channel;

    // ── Presence for typing indicator ────────────────────────────────────────
    const presKey  = `presence_${chanKey}_${Math.random().toString(36).substr(2,9)}`;
    const presence = supabase.channel(presKey, { config: { presence: { key: user.id } } });
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
      supabase.removeChannel(channel);
      unsubTyping();
      clearTimeout(typingTimeout.current);
      channelRef.current  = null;
    };
  }, [visible, user, recipient, fetchMessages]);

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

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !user || !recipient || sending) return;
    setSending(true);
    setBody('');
    broadcastTyping(false);

    const newMsg = await MessageManager.send(user.id, recipient.id, trimmed);
    if (newMsg) {
      setMessages(prev => [...prev, newMsg]);
      if (requestStatus === 'none') setRequestStatus('pending');
    }
    setSending(false);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  };

  const handleImageUpload = async () => {
    if (inputLocked || requestStatus === 'incoming_request') return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setMediaLoading(true);
        const uri = result.assets[0].uri;
        const ext = uri.split('.').pop();
        const path = `dms/${user.id}_${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri, name: `file.${ext}`, type: `image/${ext}` });
        
        const { error } = await supabase.storage.from('chat_media').upload(path, formData);
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(path);
          const newMsg = await MessageManager.send(user.id, recipient.id, '', { type: 'image', mediaUrl: publicUrl });
          if (newMsg) setMessages(prev => [...prev, newMsg]);
        }
        setMediaLoading(false);
      }
    } catch { setMediaLoading(false); }
  };

  // ── Accept request ────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    setRequestStatus('accepted');
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    await MessageManager.acceptRequest(recipient.id, user.id);
    const welcomeMsg = await MessageManager.send(user.id, recipient.id, "🔒 Locked in! Let's talk.");
    if (welcomeMsg) setMessages(prev => [...prev, welcomeMsg]);
    await fetchMessages();
  };

  // ── Decline / block ───────────────────────────────────────────────────────────
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
    await MessageManager.reactToMessage(msgId, emoji);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reaction: emoji } : m));
  };

  // ── Render message bubble ─────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => {
    const isMine    = item.sender_id === user?.id;
    const showDate  = index === 0 || fmtDate(item.created_at) !== fmtDate(messages[index - 1]?.created_at);
    const isSelected = selectedMsgId === item.id;

    return (
      <>
        {showDate && <DateSep label={fmtDate(item.created_at)} muted={muted} />}
        <TouchableOpacity
          onLongPress={() => {
            setSelectedMsgId(isSelected ? null : item.id);
            if (isMine) {
              setReactionMsgId(null);
            } else {
              setReactionMsgId(item.id);
              setShowReactions(true);
            }
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
          }}
          activeOpacity={0.85}
          style={[dm.bubble, isMine ? dm.bubbleMine : dm.bubbleTheirs]}
        >
          <View style={[
            dm.bubbleInner,
            isMine
              ? { backgroundColor: primary, borderBottomRightRadius: 4 }
              : { backgroundColor: '#1e2a2d', borderBottomLeftRadius: 4 },
          ]}>
            {item.message_type === 'image' && item.media_url && (
              <Image source={{ uri: item.media_url }} style={dm.bubbleImage} resizeMode="cover" />
            )}
            {item.body ? <Text style={[dm.bodyText, { color: isMine ? '#000' : textColor }]}>{item.body}</Text> : null}
            {item.reaction && (
              <View style={dm.reactionBubble}>
                <Text style={{ fontSize: 14 }}>{item.reaction}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 2 }}>
              <Text style={[dm.timeText, { color: isMine ? 'rgba(0,0,0,0.5)' : muted }]}>{fmtTime(item.created_at)}</Text>
              <Ticks msg={item} userId={user?.id} primary={primary} />
            </View>
          </View>

          {/* Long-press actions for own messages */}
          {isSelected && isMine && (
            <TouchableOpacity style={[dm.deleteBtn, { backgroundColor: '#ef444420' }]} onPress={() => handleDelete(item.id)}>
              <Feather name="trash-2" size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

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
  };

  const isIAmRecipient = messages.length > 0 && messages[0]?.recipient_id === user?.id && requestStatus !== 'accepted';
  const inputLocked = requestStatus === 'pending' || requestStatus === 'declined';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[dm.root, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        {/* Header */}
        <View style={[dm.header, { borderBottomColor: `${primary}18`, paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={dm.backBtn}>
            <Feather name="arrow-left" size={22} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity style={dm.headerInfo} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
            {recipient?.avatar_url
              ? <Image source={{ uri: recipient.avatar_url }} style={dm.headerAvatar} />
              : <View style={[dm.headerAvatar, { backgroundColor: `${primary}25`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="user" size={16} color={primary} />
                </View>
            }
            <View>
              <Text style={[dm.headerName, { color: textColor }]}>@{recipient?.username || 'Viber'}</Text>
              {isTyping
                ? <Text style={[dm.headerSub, { color: primary }]}>typing...</Text>
                : recipient?.is_online
                ? <Text style={[dm.headerSub, { color: '#10b981' }]}>● Online</Text>
                : <Text style={[dm.headerSub, { color: muted }]}>Offline</Text>
              }
            </View>
          </TouchableOpacity>
        </View>

        {/* Request banner — shown to recipient of a pending request */}
        {isIAmRecipient && requestStatus === 'incoming_request' && (
          <RequestBanner
            sender={recipient}
            onAccept={handleAccept}
            onDecline={handleDecline}
            primary={primary}
            textColor={textColor}
            muted={muted}
          />
        )}

        {/* Message list */}
        {loading
          ? <ActivityIndicator color={primary} size="large" style={{ flex: 1 }} />
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
                    {requestStatus === 'pending' ? 'Waiting for them to accept...' : 'Start the conversation'}
                  </Text>
                </View>
              }
            />
        }

        {/* Typing indicator */}
        {isTyping && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            <TypingDots primary={primary} />
          </View>
        )}

        {/* Input */}
        <View style={[dm.inputRow, { borderTopColor: `${primary}18`, paddingBottom: insets.bottom || 12 }]}>
          <TouchableOpacity 
            style={[dm.attachBtn, { backgroundColor: `${primary}15` }]}
            onPress={handleImageUpload}
            disabled={inputLocked || requestStatus === 'incoming_request' || mediaLoading}
          >
            {mediaLoading 
              ? <ActivityIndicator size="small" color={primary} />
              : <Feather name="camera" size={18} color={primary} />
            }
          </TouchableOpacity>
          <TextInput
            style={[dm.input, { color: textColor, backgroundColor: '#1e2a2d', opacity: inputLocked ? 0.5 : 1 }]}
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
      </KeyboardAvoidingView>
      <ViberProfileModal
        visible={profileModalVisible}
        user={recipient}
        userId={recipient?.id}
        onClose={() => setProfileModalVisible(false)}
        onNavigateToEvent={onNavigateToEvent}
      />
    </Modal>
  );
};

const dm = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:       { padding: 4 },
  headerInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar:  { width: 38, height: 38, borderRadius: 19 },
  headerName:    { fontSize: 15, fontWeight: '800' },
  headerSub:     { fontSize: 11, fontWeight: '600', marginTop: 2 },
  bubble:        { marginBottom: 6 },
  bubbleMine:    { alignItems: 'flex-end', paddingRight: 16 },
  bubbleTheirs:  { alignItems: 'flex-start', paddingLeft: 16 },
  bubbleInner:   { maxWidth: '78%', borderRadius: 18, padding: 12 },
  bodyText:      { fontSize: 14, lineHeight: 20 },
  timeText:      { fontSize: 10, marginTop: 2 },
  reactionBubble:{ position: 'absolute', bottom: -10, right: 6, backgroundColor: '#1a2225', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  deleteBtn:     { marginTop: 4, padding: 8, borderRadius: 10, alignSelf: 'flex-end' },
  reactionPickerWrap: {},
  inputRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1 },
  attachBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  input:         { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 120 },
  sendBtn:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bubbleImage:   { width: 220, height: 160, borderRadius: 12, marginBottom: 8 },
});
