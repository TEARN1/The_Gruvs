import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from './GlassView';

export const DirectMessageModal = ({ visible, onClose, recipient }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const primary = currentTheme?.primary || '#00f2ff';

  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const channelRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!user || !recipient) return;
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},recipient_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  }, [user, recipient]);

  const markAsRead = useCallback(async () => {
    if (!user || !recipient) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('sender_id', recipient.id)
      .is('read_at', null);
  }, [user, recipient]);

  useEffect(() => {
    if (!visible || !user || !recipient) return;

    fetchMessages();
    markAsRead();

    const channel = supabase
      .channel(`dm_${user.id}_${recipient.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${user.id},recipient_id=eq.${recipient.id}`,
        },
        () => fetchMessages()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${recipient.id},recipient_id=eq.${user.id}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [visible, user, recipient, fetchMessages, markAsRead]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !user || !recipient || sending) return;
    setSending(true);
    setBody('');
    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: recipient.id,
      body: trimmed,
    });
    setSending(false);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        <View
          style={[
            styles.bubble,
            isMine
              ? [styles.bubbleMine, { backgroundColor: primary }]
              : styles.bubbleTheirs,
          ]}
        >
          <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {item.body}
          </Text>
        </View>
        <Text style={[styles.timeText, isMine ? styles.timeRight : styles.timeLeft]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="message-circle" size={48} color="#2a3335" />
      <Text style={styles.emptyText}>Start the conversation...</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <GlassView style={styles.header} glow={false}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color="#e0e6e8" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {recipient?.avatar_url ? (
              <Image source={{ uri: recipient.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.avatarFallback]}>
                <Feather name="user" size={18} color="#e0e6e8" />
              </View>
            )}
            <View style={[styles.onlineDot, { backgroundColor: primary }]} />
            <Text style={styles.headerUsername} numberOfLines={1}>
              {recipient?.username || 'User'}
            </Text>
          </View>

          <View style={styles.headerRight} />
        </GlassView>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={messages.length === 0 ? styles.flatListEmpty : styles.flatListContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        <GlassView style={styles.inputBar}>
          <TextInput
            style={[styles.input, { borderColor: primary + '40' }]}
            placeholder="Message..."
            placeholderTextColor="#4a6065"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
            returnKeyType="default"
            selectionColor={primary}
            color="#e0e6e8"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: body.trim() ? primary : '#1e2a2d' }]}
            onPress={handleSend}
            disabled={!body.trim() || sending}
            activeOpacity={0.75}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#0d1112" />
            ) : (
              <Feather name="send" size={18} color={body.trim() ? '#0d1112' : '#4a6065'} />
            )}
          </TouchableOpacity>
        </GlassView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d1112',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#111a1c',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a2d',
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e2a2d',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginLeft: -14,
    marginBottom: -22,
    borderWidth: 1.5,
    borderColor: '#0d1112',
    alignSelf: 'flex-end',
  },
  headerUsername: {
    color: '#e0e6e8',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    maxWidth: 180,
  },
  headerRight: {
    width: 36,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatListContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  flatListEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#4a6065',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  msgRow: {
    marginBottom: 12,
    maxWidth: '78%',
  },
  msgRowRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgRowLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#1e2a2d',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: '#0d1112',
    fontWeight: '500',
  },
  bubbleTextTheirs: {
    color: '#c8d8db',
  },
  timeText: {
    fontSize: 11,
    color: '#4a6065',
    marginTop: 3,
  },
  timeRight: {
    textAlign: 'right',
  },
  timeLeft: {
    textAlign: 'left',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#111a1c',
    borderTopWidth: 1,
    borderTopColor: '#1e2a2d',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: '#0d1112',
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#e0e6e8',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
