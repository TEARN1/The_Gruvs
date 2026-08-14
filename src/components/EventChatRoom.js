/**
 * EventChatRoom — Full real-time event chat.
 * Features: presence indicator, reply threading, pin messages, moderator delete,
 *           optimistic sends, animated entry, emoji reactions header.
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Image, Modal, Animated, ActivityIndicator,
  Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ChatManager } from '../services/dataFlow';
import { useBackClose } from '../hooks/useBackClose';

const avatarBg = (u = '') =>
  ["#0891b2", "#7c3aed", "#059669", "#d97706", "#db2777"][(u?.charCodeAt(0) || 0) % 5];

const timeStr = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
};

// ── Presence pill ─────────────────────────────────────────────────────────────
const PresencePill = memo(({ users, primary, muted }) => {
  if (!users.length) return null;
  const shown = users.slice(0, 3);
  const extra = users.length - 3;
  return (
    <View style={pp.row}>
      <View style={[pp.dot, { backgroundColor: "#10b981" }]} />
      {shown.map((u, i) => (
        u.avatar_url
          ? <Image key={i} source={{ uri: u.avatar_url }} style={[pp.avatar, { marginLeft: i === 0 ? 0 : -6 }]} />
          : <View key={i} style={[pp.avatar, { backgroundColor: avatarBg(u.username), marginLeft: i === 0 ? 0 : -6, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{(u.username || '?')[0].toUpperCase()}</Text>
            </View>
      ))}
      <Text style={[pp.label, { color: muted }]}>
        {users.length === 1 ? users[0].username : `${users.length} vibing now`}{extra > 0 ? ` +${extra}` : ''}
      </Text>
    </View>
  );
});
const pp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  avatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#000' },
  label: { fontSize: 11, fontWeight: '600' },
});

// ── Single message bubble ─────────────────────────────────────────────────────
const MessageBubble = memo(({ msg, isMine, canModerate, primary, textColor, muted, surface, bg, onReply, onDelete, onPin, replyTarget }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const slideIn = useRef(new Animated.Value(isMine ? 30 : -30)).current;

  useEffect(() => {
    Animated.spring(slideIn, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
  }, []);

  const author = msg.profiles || {};

  return (
    <Animated.View style={[mb.row, isMine && mb.rowMine, { transform: [{ translateX: slideIn }] }]}>
      {!isMine && (
        author.avatar_url
          ? <Image source={{ uri: author.avatar_url }} style={mb.avatar} />
          : <View style={[mb.avatar, { backgroundColor: avatarBg(author.username), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{(author.username || '?')[0].toUpperCase()}</Text>
            </View>
      )}

      <View style={{ maxWidth: '78%' }}>
        {/* Reply reference */}
        {replyTarget && (
          <View style={[mb.replyRef, { borderLeftColor: primary, backgroundColor: `${primary}10` }]}>
            <Text style={[mb.replyUser, { color: primary }]}>@{replyTarget.profiles?.username}</Text>
            <Text style={[mb.replyText, { color: muted }]} numberOfLines={1}>{replyTarget.message}</Text>
          </View>
        )}

        {/* Pinned badge */}
        {msg.pinned && (
          <View style={mb.pinnedBadge}>
            <Feather name="bookmark" size={10} color={primary} />
            <Text style={[mb.pinnedText, { color: primary }]}>Pinned</Text>
          </View>
        )}

        <TouchableOpacity
          onLongPress={() => setMenuVisible(true)}
          activeOpacity={0.85}
          style={[
            mb.bubble,
            isMine
              ? { backgroundColor: primary, borderBottomRightRadius: 4 }
              : { backgroundColor: surface, borderBottomLeftRadius: 4 },
            msg.pinned && { borderWidth: 1, borderColor: `${primary}50` },
          ]}
        >
          {!isMine && (
            <Text style={[mb.username, { color: primary }]}>
              {author.username || 'Viber'}
              {author.is_verified && '  ✓'}
            </Text>
          )}
          <Text style={[mb.text, { color: isMine ? '#000' : textColor }]}>{msg.message}</Text>
          <Text style={[mb.time, { color: isMine ? 'rgba(0,0,0,0.5)' : muted }]}>{timeStr(msg.created_at)}</Text>
        </TouchableOpacity>
      </View>

      {/* Context menu */}
      {menuVisible && (
        <Modal transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity style={mb.menuBackdrop} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={[mb.menu, { backgroundColor: bg, borderColor: `${primary}25` }]}>
              <TouchableOpacity style={mb.menuItem} onPress={() => { onReply(msg); setMenuVisible(false); }}>
                <Feather name="corner-up-left" size={15} color={primary} />
                <Text style={[mb.menuLabel, { color: textColor }]}>Reply</Text>
              </TouchableOpacity>
              {canModerate && (
                <TouchableOpacity style={mb.menuItem} onPress={() => { onPin(msg); setMenuVisible(false); }}>
                  <Feather name="bookmark" size={15} color={primary} />
                  <Text style={[mb.menuLabel, { color: textColor }]}>{msg.pinned ? 'Unpin' : 'Pin message'}</Text>
                </TouchableOpacity>
              )}
              {(isMine || canModerate) && (
                <TouchableOpacity style={mb.menuItem} onPress={() => { onDelete(msg.id); setMenuVisible(false); }}>
                  <Feather name="trash-2" size={15} color="#ef4444" />
                  <Text style={[mb.menuLabel, { color: "#ef4444" }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </Animated.View>
  );
});
const mb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10, paddingHorizontal: 12 },
  rowMine: { flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%' },
  username: { fontSize: 11, fontWeight: '900', marginBottom: 3 },
  text: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  replyRef: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 },
  replyUser: { fontSize: 10, fontWeight: '900' },
  replyText: { fontSize: 11, lineHeight: 15 },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  pinnedText: { fontSize: 10, fontWeight: '800' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menu: { borderRadius: 16, paddingVertical: 6, minWidth: 180, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  menuLabel: { fontSize: 14, fontWeight: '700' },
});

// ── Main EventChatRoom ────────────────────────────────────────────────────────
export const EventChatRoom = ({ visible, onClose, eventId, eventTitle, canModerate = false }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#1a1f21";

  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // message object
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const slideAnim = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
      loadMessages();
    } else {
      Animated.timing(slideAnim, { toValue: 700, duration: 250, useNativeDriver: true }).start();
      setMessages([]); setPresence([]); setReplyTo(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !eventId) return;
    const unsub = ChatManager.subscribe(
      eventId,
      ({ type, message }) => {
        if (type === 'new') {
          setMessages(prev => {
            // Avoid duplicate if optimistic send already added it
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
          // Update pinned banner if needed
          if (message.pinned) setPinnedMessage(message);
        } else if (type === 'update') {
          setMessages(prev => prev.map(m => m.id === message.id ? { ...m, ...message } : m));
          if (message.pinned) setPinnedMessage(message);
          else if (pinnedMessage?.id === message.id) setPinnedMessage(null);
        }
      } ,
      (users) => setPresence(users)
    );

    if (user) {
      ChatManager.joinPresence(eventId, user.id, user.user_metadata?.username || 'Viber', user.user_metadata?.avatar_url || null);
    }

    return () => {
      unsub();
      if (user) ChatManager.leavePresence(eventId);
    };
  }, [visible, eventId, user?.id]);

  const loadMessages = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const msgs = await ChatManager.fetchMessages(eventId);
      setMessages(msgs);
      const pinned = msgs.findLast?.(m => m.pinned) || msgs.filter(m => m.pinned).pop() || null;
      setPinnedMessage(pinned);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch { /* chat unavailable */ }
    finally { setLoading(false); }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || sending) return;
    const text = input.trim();
    const replyId = replyTo?.id || null;
    setInput('');
    setReplyTo(null);
    setSending(true);

    // Optimistic message
    const optimistic = {
      id: `opt_${Date.now()}`,
      message: text,
      created_at: new Date().toISOString(),
      user_id: user?.id,
      reply_to: replyId,
      pinned: false,
      deleted: false,
      profiles: { id: user?.id, username: user.user_metadata?.username || 'You', avatar_url: user.user_metadata?.avatar_url || null },
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    try {
      const saved = await ChatManager.send(eventId, user.id, text, replyId);
      // Replace optimistic with real record
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...optimistic, ...saved } : m));
    } catch (e) {
      // Roll back optimistic message
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      Alert.alert('Could not send', e.message || 'Check your connection.');
    } finally { setSending(false); }
  }, [input, user, sending, eventId, replyTo]);

  const handleDelete = useCallback(async (messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    try {
      await ChatManager.deleteMessage(messageId);
    } catch {
      // Re-fetch on failure
      const msgs = await ChatManager.fetchMessages(eventId);
      setMessages(msgs);
    }
  }, [eventId]);

  const handlePin = useCallback(async (msg) => {
    const next = !msg.pinned;
    try {
      await ChatManager.setPinned(msg.id, next, user?.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pinned: next, pinned_by: next ? user?.id : null } : m));
      setPinnedMessage(next ? { ...msg, pinned: true } : null);
    } catch { /* pin failed */ }
  }, [user?.id]);

  const messageMap = Object.fromEntries(messages.map(m => [m.id, m]));

  const renderItem = useCallback(({ item }) => (
    <MessageBubble
      msg={item}
      isMine={item.user_id === user?.id}
      canModerate={canModerate}
      primary={primary}
      textColor={textColor}
      muted={muted}
      surface={surface}
      bg={bg}
      onReply={(m) => { setReplyTo(m); inputRef.current?.focus(); }}
      onDelete={handleDelete}
      onPin={handlePin}
      replyTarget={item.reply_to ? messageMap[item.reply_to] : null}
    />
  ), [user?.id, canModerate, primary, textColor, muted, surface, bg, handleDelete, handlePin, messageMap]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={cr.backdrop}>
        <Animated.View style={[cr.sheet, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={[cr.header, { borderBottomColor: `${primary}15` }]}>
            <View style={{ flex: 1 }}>
              <Text style={[cr.title, { color: textColor }]} numberOfLines={1}>
                {eventTitle || 'Event Chat'}
              </Text>
              <PresencePill users={presence} primary={primary} muted={muted} />
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Pinned message banner */}
          {pinnedMessage && (
            <View style={[cr.pinnedBanner, { backgroundColor: `${primary}12`, borderColor: `${primary}30` }]}>
              <Feather name="bookmark" size={13} color={primary} />
              <Text style={[cr.pinnedBannerText, { color: primary }]} numberOfLines={1}>
                {pinnedMessage.message}
              </Text>
              {canModerate && (
                <TouchableOpacity onPress={() => handlePin(pinnedMessage)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Feather name="x" size={13} color={muted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Messages */}
          {loading ? (
            <View style={cr.center}>
              <ActivityIndicator color={primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={cr.center}>
              <Text style={{ fontSize: 32, marginBottom: 10 }}>💬</Text>
              <Text style={{ color: muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                No messages yet.{'\n'}Be the first to break the vibe!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={item => String(item.id)}
              renderItem={renderItem}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* Reply preview */}
          {replyTo && (
            <View style={[cr.replyPreview, { backgroundColor: `${primary}12`, borderTopColor: `${primary}25` }]}>
              <View style={{ flex: 1 }}>
                <Text style={[cr.replyToLabel, { color: primary }]}>Replying to @{replyTo.profiles?.username}</Text>
                <Text style={[cr.replyToText, { color: muted }]} numberOfLines={1}>{replyTo.message}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={muted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[cr.inputRow, { borderTopColor: `${primary}15` }]}>
              {user ? (
                <>
                  <TextInput
                    ref={inputRef}
                    style={[cr.input, { color: textColor, backgroundColor: surface }]}
                    placeholder="Say something..."
                    placeholderTextColor={muted}
                    value={input}
                    onChangeText={setInput}
                    maxLength={500}
                    multiline
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    style={[cr.sendBtn, { backgroundColor: input.trim() ? primary : `${primary}25` }]}
                    onPress={handleSend}
                    disabled={!input.trim() || sending}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Feather name="send" size={17} color={input.trim() ? '#000' : muted} />
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[cr.signInNote, { color: muted }]}>Sign in to join the chat</Text>
              )}
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const cr = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  pinnedBannerText: { flex: 1, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  replyPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  replyToLabel: { fontSize: 11, fontWeight: '900', marginBottom: 2 },
  replyToText: { fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 80 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  signInNote: { flex: 1, textAlign: 'center', fontSize: 13, paddingVertical: 14 },
});
