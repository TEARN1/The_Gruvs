/**
 * AdminAIScreen — Owner-only AI command center.
 * Chat with Claude to manage the app: query stats, send notifications,
 * feature events, moderate users, post announcements.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { adminChat, runHealthCheck } from '../services/claudeService';

const OWNER_EMAIL = 'asemahlenkwali@gmail.com';

const QUICK_COMMANDS = [
  { label: '📊 Stats today',          query: 'How many new users signed up today and what is total user count?' },
  { label: '🔥 Top event this week',  query: 'What is the top trending event this week and why?' },
  { label: '⚠️ Churn risk users',     query: 'Show me users who are at risk of churning.' },
  { label: '🩺 Health check',         query: 'Run a full platform health audit and recommend the top 3 actions for the owner.' },
  { label: '📢 Write announcement',   query: 'Generate a new app update announcement for the Upgrades section.' },
];

// ── Admin tool executor ───────────────────────────────────────────────────────
async function executeTool(toolName, toolInput) {
  try {
    switch (toolName) {

      case 'query_stats': {
        const metric = toolInput.metric;
        const period = toolInput.period || 'today';
        const since  = period === 'week'  ? new Date(Date.now() - 7 * 86400000).toISOString()
                     : period === 'month' ? new Date(Date.now() - 30 * 86400000).toISOString()
                     : new Date(Date.now() - 86400000).toISOString();

        if (metric === 'users_today' || metric === 'new_signups') {
          const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since);
          return `New signups (${period}): ${count || 0}`;
        }
        if (metric === 'active_users') {
          const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen', since);
          return `Active users (${period}): ${count || 0}`;
        }
        if (metric === 'top_events') {
          const { data } = await supabase.from('events').select('title, vibe_count, going, city').order('trending_score', { ascending: false }).limit(5);
          return `Top events:\n${(data || []).map((e, i) => `${i + 1}. ${e.title} (${e.city}) — ${e.vibe_count} vibes, ${e.going} going`).join('\n')}`;
        }
        if (metric === 'churn_risk') {
          const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
          const { data } = await supabase.from('profiles').select('username, last_seen, vibe_score').lt('last_seen', cutoff).order('last_seen', { ascending: true }).limit(10);
          return `Churn-risk users (inactive 7+ days):\n${(data || []).map(u => `- @${u.username} (last seen: ${u.last_seen?.split('T')[0]}, score: ${u.vibe_score})`).join('\n')}`;
        }
        return 'Unknown metric requested.';
      }

      case 'send_notification': {
        const { segment, title, body } = toolInput;
        let query = supabase.from('profiles').select('id, push_token').not('push_token', 'is', null);
        if (segment?.startsWith('city:')) {
          query = query.ilike('city', `%${segment.replace('city:', '')}%`);
        } else if (segment === 'inactive_24h') {
          const cutoff = new Date(Date.now() - 86400000).toISOString();
          query = query.lt('last_seen', cutoff);
        } else if (segment === 'top_vibers') {
          query = query.order('vibe_score', { ascending: false }).limit(100);
        }
        const { data: users } = await query.limit(500);

        // Insert notification rows for each user
        if (users?.length) {
          const rows = users.map(u => ({
            recipient_id: u.id,
            type: 'admin_broadcast',
            title,
            body,
            data: { segment },
          }));
          await supabase.from('notifications').insert(rows);
        }
        return `Notification sent to ${users?.length || 0} users (segment: ${segment}).`;
      }

      case 'feature_event': {
        const { event_id, featured } = toolInput;
        const { data } = await supabase.from('events').update({ is_featured: featured }).eq('id', event_id).select('title').single();
        return `Event "${data?.title || event_id}" is now ${featured ? 'featured ⭐' : 'unfeatured'}.`;
      }

      case 'moderate_user': {
        const { username, action, reason } = toolInput;
        const { data: u } = await supabase.from('profiles').select('id').eq('username', username).single();
        if (!u) return `User @${username} not found.`;
        if (action === 'flag') {
          await supabase.from('reports').insert({ target_type: 'profile', target_id: u.id, reporter_id: u.id, reason: reason || 'Admin flagged', status: 'pending' });
          return `User @${username} flagged for review.`;
        }
        if (action === 'suspend') {
          await supabase.from('profiles').update({ is_discoverable: false, is_online: false }).eq('id', u.id);
          return `User @${username} suspended (hidden from discovery).`;
        }
        return `Unknown action: ${action}`;
      }

      case 'generate_announcement': {
        const { title, description, type = 'feature', version } = toolInput;
        const { data } = await supabase.from('app_updates').insert({
          title, description, type,
          version: version || `v${new Date().toISOString().split('T')[0]}`,
          released_at: new Date().toISOString(),
        }).select().single();
        return `Announcement published! ID: ${data?.id}. Title: "${title}". It will appear in the App Upgrades section immediately.`;
      }

      default:
        return `Tool "${toolName}" not implemented.`;
    }
  } catch (e) {
    return `Tool error: ${e.message}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export const AdminAIScreen = ({ onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages]   = useState([{
    id: 'welcome', role: 'assistant',
    text: `Welcome back, TEARN 👑\n\nI'm your admin AI. Ask me anything about the app, or give me a command:\n\n• "How many users signed up today?"\n• "Feature event [event-id]"\n• "Send a push to all Cape Town users about X"\n• "Generate an announcement for [feature]"\n\nWhat do you need?`,
  }]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const flatRef   = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const MAX_MESSAGES = 60;

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  // renderMessage must be before the early return so hook order is stable
  const renderMessage = useCallback(({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
            <Text style={{ fontSize: 10 }}>AI</Text>
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
        </View>
      </View>
    );
  }, [primary, surface, textColor]);

  // Guard: only owner
  if (user?.email !== OWNER_EMAIL) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="lock" size={40} color={muted} />
          <Text style={{ color: muted, marginTop: 12, fontSize: 14 }}>Owner access only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const runLLMSanityCheck = async () => {
    if (loading) return;

    const diagnosticText = 'Run a runtime AI diagnostic check. Confirm whether you can access current event data without guessing. If you cannot verify anything, say "I don\'t have enough verified data."';
    const userMsg = { id: Date.now().toString(), role: 'user', text: diagnosticText };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await runHealthCheck({ userId: user.id });
      if (!isMounted.current) return;
      setMessages(prev => {
        const next = [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: result.text || 'No response received from the AI.' }];
        return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      });
    } catch (e) {
      if (!isMounted.current) return;
      setMessages(prev => {
        const next = [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: `Diagnostic failed: ${e?.message || 'unknown error'}` }];
        return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      });
    } finally {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const history = [...messages, userMsg]
      .filter(m => m.role !== 'system')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.text }));

    try {
      let result = await adminChat(history, { userId: user.id });

      // If Claude wants to use a tool, execute it and feed result back
      if (result.toolUse) {
        const toolResult = await executeTool(result.toolUse.name, result.toolUse.input);
        const followUp = await adminChat([
          ...history,
          { role: 'assistant', content: [result.toolUse] },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: result.toolUse.id, content: toolResult }] },
        ], { userId: user.id });
        result = followUp;
      }

      if (!isMounted.current) return;
      setMessages(prev => {
        const next = [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: result.text || 'No response — check API key.' }];
        return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      });
    } catch (e) {
      if (!isMounted.current) return;
      setMessages(prev => {
        const next = [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: `Error: ${e?.message || 'Request failed — check your connection.'}` }];
        return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      });
    } finally {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: `${primary}20` }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: `${primary}20`, borderColor: primary }]}>
            <Text style={[styles.badgeText, { color: primary }]}>ADMIN</Text>
          </View>
          <View>
            <Text style={[styles.title, { color: primary }]}>AI Command Center</Text>
            <Text style={[styles.sub, { color: muted }]}>Powered by Claude · Owner only</Text>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
            <Feather name="x" size={20} color={muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick commands */}
      {messages.length <= 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {QUICK_COMMANDS.map(q => (
            <TouchableOpacity
              key={q.label}
              style={[styles.quickChip, { borderColor: `${primary}35`, backgroundColor: `${primary}08` }]}
              onPress={() => send(q.query)}
            >
              <Text style={[styles.quickText, { color: primary }]}>{q.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.quickChip, { borderColor: `${primary}35`, backgroundColor: `${primary}08` }]}
            onPress={runLLMSanityCheck}
            disabled={loading}
          >
            <Text style={[styles.quickText, { color: primary }]}>🧪 LLM sanity check</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.msgList}
        showsVerticalScrollIndicator={false}
        renderItem={renderMessage}
      />

      {loading && (
        <View style={[styles.typing, { backgroundColor: surface, borderColor: `${primary}20` }]}>
          <ActivityIndicator size="small" color={primary} />
          <Text style={[styles.typingText, { color: muted }]}>Processing...</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputRow, { borderTopColor: `${primary}20`, backgroundColor: bg }]}>
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor: surface, borderColor: `${primary}25` }]}
            placeholder="Issue a command or ask a question..."
            placeholderTextColor={muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={600}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? primary : `${primary}30` }]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Feather name="send" size={16} color={input.trim() ? '#000' : muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen:      { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5 },
  badgeText:   { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title:       { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  sub:         { fontSize: 11, marginTop: 1 },
  quickRow:    { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  quickChip:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  quickText:   { fontSize: 12, fontWeight: '700' },
  msgList:     { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowUser:  { flexDirection: 'row-reverse' },
  aiAvatar:    { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  bubble:      { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  bubbleUser:  { borderTopRightRadius: 4 },
  bubbleAI:    { borderTopLeftRadius: 4 },
  bubbleText:  { fontSize: 14, lineHeight: 20 },
  typing:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  typingText:  { fontSize: 12 },
  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1 },
  input:       { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
