/**
 * AIAssistantModal — Full-screen AI chat for The Gruvs.
 * Users can ask about events, vibers, get recommendations, draft messages.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { chat, submitFeedback, AIFeature } from '../services/claudeService';

const QUICK_PROMPTS = [
  { label: "What's on tonight? 🔥", query: "What events are happening tonight near me?" },
  { label: 'Who to follow? 👥', query: 'Who should I follow based on my interests?' },
  { label: "Trending this week 📈", query: "What are the most trending events this week?" },
  { label: 'Help me grow 🚀', query: 'Give me tips to grow my Vibe Score quickly.' },
];

const MSG_ROLE = { USER: 'user', AI: 'assistant' };

export const AIAssistantModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState('');
  const flatRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  // Build session context from user profile + recent events
  const buildContext = useCallback(async () => {
    if (!user) return '';
    try {
      const [{ data: mem }, { data: events }] = await Promise.all([
        supabase.from('ai_user_memory').select('summary').eq('user_id', user.id).single(),
        supabase.from('events')
          .select('title, city, category, event_date, trending_score')
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('trending_score', { ascending: false })
          .limit(10),
      ]);
      const userPart = profile
        ? `USER: ${profile.display_name || profile.username}, interests: ${(profile.interests || []).join(', ')}, city: ${profile.city || 'unknown'}, vibe score: ${profile.vibe_score || 0}`
        : '';
      const memPart = mem?.summary ? `\nLEARNED PREFERENCES: ${mem.summary}` : '';
      const eventPart = events?.length
        ? `\nTOP UPCOMING EVENTS:\n${events.map(e => `- ${e.title} (${e.city}, ${e.category}, ${e.event_date})`).join('\n')}`
        : '';
      return `${userPart}${memPart}${eventPart}`;
    } catch { return ''; }
  }, [user, profile]);

  useEffect(() => {
    if (visible) {
      buildContext().then(setSessionContext);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (messages.length === 0) {
        setMessages([{
          id: 'welcome',
          role: MSG_ROLE.AI,
          text: `Hey${profile?.display_name ? ' ' + profile.display_name : ''}! 👋 I'm your Gruvs AI. Ask me about events, who to follow, or how to grow your vibe. What's on your mind?`,
        }]);
      }
    }
  }, [visible]);

  const scrollToBottom = () => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: MSG_ROLE.USER, text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    scrollToBottom();

    // Build message history for Claude (last 10 turns)
    const history = [...messages, userMsg]
      .filter(m => m.role !== 'system')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.text }));

    const result = await chat(history, {
      feature: AIFeature.ASSISTANT,
      userId: user?.id,
      systemExtra: sessionContext,
    });

    const aiMsg = {
      id: (Date.now() + 1).toString(),
      role: MSG_ROLE.AI,
      text: result.text || "I'm having trouble connecting right now. Try again in a moment.",
      interactionId: result.id,
      error: !!result.error,
    };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
    scrollToBottom();
  };

  const handleFeedback = async (msg, thumbs) => {
    if (!msg.interactionId) return;
    await submitFeedback(msg.interactionId, thumbs);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, feedback: thumbs } : m));
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === MSG_ROLE.USER;
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: `${primary}25`, borderColor: `${primary}40` }]}>
            <Text style={{ fontSize: 12 }}>✦</Text>
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: primary }]
            : [styles.bubbleAI, { backgroundColor: surface, borderColor: `${primary}20` }],
        ]}>
          <Text style={[styles.bubbleText, { color: isUser ? '#000' : textColor }]}>
            {item.text}
          </Text>
          {/* Feedback buttons for AI messages */}
          {!isUser && item.interactionId && (
            <View style={styles.feedbackRow}>
              <TouchableOpacity onPress={() => handleFeedback(item, 1)} style={styles.feedbackBtn}>
                <Feather name="thumbs-up" size={12} color={item.feedback === 1 ? primary : muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleFeedback(item, -1)} style={styles.feedbackBtn}>
                <Feather name="thumbs-down" size={12} color={item.feedback === -1 ? '#ef4444' : muted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: `${primary}20` }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
              <Text style={{ fontSize: 16 }}>✦</Text>
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: primary }]}>Gruvs AI</Text>
              <Text style={[styles.headerSub, { color: muted }]}>Your personal vibe assistant</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={20} color={muted} />
          </TouchableOpacity>
        </View>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <View style={styles.quickRow}>
            {QUICK_PROMPTS.map(q => (
              <TouchableOpacity
                key={q.label}
                style={[styles.quickChip, { borderColor: `${primary}35`, backgroundColor: `${primary}08` }]}
                onPress={() => sendMessage(q.query)}
              >
                <Text style={[styles.quickText, { color: primary }]}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />

        {/* Typing indicator */}
        {loading && (
          <View style={[styles.typingRow, { backgroundColor: surface, borderColor: `${primary}20` }]}>
            <Text style={{ fontSize: 12 }}>✦</Text>
            <ActivityIndicator size="small" color={primary} style={{ marginLeft: 8 }} />
            <Text style={[styles.typingText, { color: muted }]}>Gruvs AI is thinking...</Text>
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.inputRow, { borderTopColor: `${primary}20`, backgroundColor: bg }]}>
            <TextInput
              style={[styles.input, { color: textColor, backgroundColor: surface, borderColor: `${primary}25` }]}
              placeholder="Ask anything about The Gruvs..."
              placeholderTextColor={muted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? primary : `${primary}30` }]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || loading}
            >
              <Feather name="send" size={16} color={input.trim() ? '#000' : muted} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle:  { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  headerSub:    { fontSize: 11, fontWeight: '600', marginTop: 1 },
  closeBtn:     { padding: 6 },
  quickRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  quickChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  quickText:    { fontSize: 12, fontWeight: '700' },
  msgList:      { padding: 16, gap: 14, paddingBottom: 8 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowUser:   { flexDirection: 'row-reverse' },
  aiAvatar:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  bubble:       { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  bubbleUser:   { borderRadius: 18, borderTopRightRadius: 4 },
  bubbleAI:     { borderTopLeftRadius: 4 },
  bubbleText:   { fontSize: 14, lineHeight: 20 },
  feedbackRow:  { flexDirection: 'row', gap: 8, marginTop: 6 },
  feedbackBtn:  { padding: 2 },
  typingRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 14, borderWidth: 1 },
  typingText:   { fontSize: 12, marginLeft: 6 },
  inputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1 },
  input:        { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
