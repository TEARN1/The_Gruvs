/**
 * EventPollSection — Create polls (organiser/co-host), animated bar chart results,
 * atomic single/multi-choice voting, real-time result updates.
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

// ── Animated progress bar ─────────────────────────────────────────────────────
const VoteBar = memo(({ pct, primary, label, count, selected }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: pct / 100, useNativeDriver: false, damping: 14, stiffness: 100 }).start();
  }, [pct]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={vb.row}>
      <View style={vb.track}>
        <Animated.View style={[vb.fill, { width, backgroundColor: selected ? primary : `${primary}40` }]} />
        <Text style={[vb.label, { color: selected ? '#000' : '#fff' }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[vb.pct, { color: selected ? primary : 'rgba(255,255,255,0.55)' }]}>{Math.round(pct)}%</Text>
      <Text style={[vb.count, { color: 'rgba(255,255,255,0.35)' }]}>{count}</Text>
    </View>
  );
});
const vb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  track: { flex: 1, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', justifyContent: 'center' },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: 10 },
  label: { paddingHorizontal: 12, fontSize: 13, fontWeight: '700', zIndex: 1 },
  pct: { width: 38, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  count: { width: 24, fontSize: 10, textAlign: 'right' },
});

// ── Poll card ─────────────────────────────────────────────────────────────────
const PollCard = memo(({ poll, userId, canManage, primary, textColor, muted, surface, onVoted, onClose }) => {
  const [voted, setVoted] = useState(poll._userVotes || []);
  const [counts, setCounts] = useState(() => {
    const map = {};
    (poll.options || []).forEach((_, i) => { map[i] = 0; });
    (poll.event_poll_votes || []).forEach(v => {
      (v.option_ids || []).forEach(i => { map[i] = (map[i] || 0) + 1; });
    });
    return map;
  });
  const [voting, setVoting] = useState(false);
  const totalVotes = Object.values(counts).reduce((s, n) => s + n, 0);
  const hasVoted = voted.length > 0;
  const isMulti = poll.allow_multi_choice;
  const [pending, setPending] = useState([...voted]); // staged choices before submit

  const togglePending = (idx) => {
    if (hasVoted) return;
    if (isMulti) {
      setPending(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    } else {
      setPending([idx]);
    }
  };

  const submit = async () => {
    if (!pending.length || voting || hasVoted) return;
    setVoting(true);
    try {
      const { data, error } = await supabase.rpc('cast_poll_vote', {
        p_poll_id: poll.id,
        p_user_id: userId,
        p_option_ids: JSON.stringify(pending),
      });
      if (error) throw error;
      setVoted(pending);
      // Update counts from returned data
      if (data?.counts) {
        const newCounts = {};
        (poll.options || []).forEach((_, i) => { newCounts[i] = data.counts[i] || 0; });
        setCounts(newCounts);
      } else {
        setCounts(prev => {
          const next = { ...prev };
          pending.forEach(i => { next[i] = (next[i] || 0) + 1; });
          return next;
        });
      }
      onVoted?.();
    } catch (e) {
      Alert.alert('Vote failed', e.message || 'Try again.');
    } finally { setVoting(false); }
  };

  return (
    <View style={[pc.card, { backgroundColor: surface, borderColor: `${primary}20` }]}>
      <View style={pc.cardHeader}>
        <View style={[pc.badge, { backgroundColor: `${primary}18` }]}>
          <Feather name="bar-chart-2" size={11} color={primary} />
          <Text style={[pc.badgeText, { color: primary }]}>POLL</Text>
        </View>
        {poll.ends_at && (
          <Text style={[pc.ends, { color: muted }]}>
            Ends {new Date(poll.ends_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
          </Text>
        )}
        {canManage && onClose && (
          <TouchableOpacity onPress={() => onClose(poll.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Feather name="trash-2" size={14} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[pc.question, { color: textColor }]}>{poll.question}</Text>
      <Text style={[pc.meta, { color: muted }]}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</Text>

      {(poll.options || []).map((opt, idx) => {
        const c = counts[idx] || 0;
        const pct = totalVotes > 0 ? (c / totalVotes) * 100 : 0;
        const isSelected = voted.includes(idx);
        const isPending = pending.includes(idx);

        if (hasVoted) {
          return <VoteBar key={idx} pct={pct} primary={primary} label={opt} count={c} selected={isSelected} />;
        }

        return (
          <TouchableOpacity
            key={idx}
            style={[pc.option, { borderColor: isPending ? primary : `${primary}25`, backgroundColor: isPending ? `${primary}15` : 'transparent' }]}
            onPress={() => togglePending(idx)}
            activeOpacity={0.8}
          >
            <View style={[pc.optionDot, isPending && { backgroundColor: primary, borderColor: primary }]}>
              {isPending && <Feather name={isMulti ? 'check' : 'circle'} size={10} color="#000" />}
            </View>
            <Text style={[pc.optionText, { color: isPending ? primary : textColor }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}

      {!hasVoted && pending.length > 0 && (
        <TouchableOpacity
          style={[pc.voteBtn, { backgroundColor: voting ? `${primary}50` : primary }]}
          onPress={submit}
          disabled={voting}
        >
          {voting
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={pc.voteBtnText}>Cast Vote{isMulti && pending.length > 1 ? ` (${pending.length})` : ''}</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
});
const pc = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ends: { flex: 1, fontSize: 11 },
  question: { fontSize: 16, fontWeight: '900', lineHeight: 22, marginBottom: 4 },
  meta: { fontSize: 11, marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8 },
  optionDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  voteBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  voteBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
});

// ── Create poll form ──────────────────────────────────────────────────────────
const CreatePollForm = ({ eventId, userId, primary, textColor, muted, surface, onCreated, onCancel }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiChoice, setMultiChoice] = useState(false);
  const [saving, setSaving] = useState(false);

  const addOption = () => { if (options.length < 6) setOptions(prev => [...prev, '']); };
  const removeOption = (i) => { if (options.length > 2) setOptions(prev => prev.filter((_, idx) => idx !== i)); };
  const updateOption = (i, v) => setOptions(prev => prev.map((o, idx) => idx === i ? v : o));

  const handleCreate = async () => {
    if (!userId) return Alert.alert('Sign in to create a poll');
    const validOpts = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim()) return Alert.alert('Question required');
    if (validOpts.length < 2) return Alert.alert('At least 2 options required');
    setSaving(true);
    try {
      const { error } = await supabase.from('event_polls').insert({
        event_id: eventId,
        created_by: userId,
        question: question.trim(),
        options: validOpts,
        allow_multi_choice: multiChoice,
      });
      if (error) throw error;
      onCreated?.();
    } catch (e) {
      Alert.alert('Could not create poll', e.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={[cf.form, { backgroundColor: surface, borderColor: `${primary}25` }]}>
      <Text style={[cf.formTitle, { color: primary }]}>New Poll</Text>

      <TextInput
        style={[cf.input, { color: textColor, borderColor: `${primary}30` }]}
        placeholder="Ask your question..."
        placeholderTextColor={muted}
        value={question}
        onChangeText={setQuestion}
        maxLength={200}
      />

      {options.map((opt, i) => (
        <View key={i} style={cf.optRow}>
          <TextInput
            style={[cf.optInput, { color: textColor, borderColor: `${primary}25`, flex: 1 }]}
            placeholder={`Option ${i + 1}`}
            placeholderTextColor={muted}
            value={opt}
            onChangeText={v => updateOption(i, v)}
            maxLength={100}
          />
          {options.length > 2 && (
            <TouchableOpacity onPress={() => removeOption(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {options.length < 6 && (
        <TouchableOpacity style={[cf.addOptBtn, { borderColor: `${primary}30` }]} onPress={addOption}>
          <Feather name="plus" size={13} color={primary} />
          <Text style={{ color: primary, fontSize: 12, fontWeight: '800' }}>Add option</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={cf.multiRow} onPress={() => setMultiChoice(v => !v)}>
        <View style={[cf.checkbox, { borderColor: primary, backgroundColor: multiChoice ? primary : 'transparent' }]}>
          {multiChoice && <Feather name="check" size={11} color="#000" />}
        </View>
        <Text style={{ color: textColor, fontSize: 13 }}>Allow multiple choices</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <TouchableOpacity style={[cf.btn, { backgroundColor: saving ? `${primary}50` : primary, flex: 1 }]} onPress={handleCreate} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={cf.btnText}>Post Poll</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={[cf.btn, { borderWidth: 1, borderColor: `${primary}30`, backgroundColor: 'transparent' }]} onPress={onCancel}>
          <Text style={{ color: muted, fontWeight: '700' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
const cf = StyleSheet.create({
  form: { borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1 },
  formTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  addOptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 12 },
  multiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 16 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 14 },
});

// ── Main EventPollSection ─────────────────────────────────────────────────────
export const EventPollSection = ({ eventId, canPost = false }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadPolls = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data, error } = await supabase
        .from('event_polls')
        .select('*, event_poll_votes(user_id, option_ids)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = (data || []).map(p => ({
        ...p,
        _userVotes: user
          ? (p.event_poll_votes || []).find(v => v.user_id === user.id)?.option_ids || []
          : [],
      }));
      setPolls(enriched);
    } catch { /* polls unavailable */ }
    finally { setLoading(false); }
  }, [eventId, user?.id]);

  useEffect(() => { loadPolls(); }, [loadPolls]);

  // Realtime: new polls appear live
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase.channel(`event_polls:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_polls', filter: `event_id=eq.${eventId}` },
        () => loadPolls())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_poll_votes' },
        () => loadPolls())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [eventId, loadPolls]);

  const handleDeletePoll = async (pollId) => {
    if (!user?.id) return;
    Alert.alert('Delete Poll', 'Remove this poll permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setPolls(prev => prev.filter(p => p.id !== pollId));
          const { error } = await supabase.from('event_polls').delete().eq('id', pollId).eq('created_by', user.id);
          if (error) { setPolls(prev => [...prev]); } // state will correct on next load
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginVertical: 20 }} />;

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: textColor, fontSize: 17, fontWeight: '900' }}>Polls</Text>
          <Text style={{ color: muted, fontSize: 12 }}>{polls.length} active poll{polls.length !== 1 ? 's' : ''}</Text>
        </View>
        {canPost && !creating && (
          <TouchableOpacity
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
            onPress={() => setCreating(true)}
          >
            <Feather name="plus" size={14} color={primary} />
            <Text style={{ color: primary, fontSize: 12, fontWeight: '900' }}>New Poll</Text>
          </TouchableOpacity>
        )}
      </View>

      {creating && (
        <CreatePollForm
          eventId={eventId}
          userId={user?.id}
          primary={primary}
          textColor={textColor}
          muted={muted}
          surface={surface}
          onCreated={() => { setCreating(false); loadPolls(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {polls.length === 0 && !creating && (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 28, marginBottom: 8 }}>📊</Text>
          <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>
            {canPost ? 'No polls yet — create one to get the crowd involved.' : 'No polls yet for this event.'}
          </Text>
        </View>
      )}

      {polls.map(poll => (
        <PollCard
          key={poll.id}
          poll={poll}
          userId={user?.id}
          canManage={canPost}
          primary={primary}
          textColor={textColor}
          muted={muted}
          surface={surface}
          onVoted={loadPolls}
          onClose={canPost ? handleDeletePoll : undefined}
        />
      ))}
    </View>
  );
};
