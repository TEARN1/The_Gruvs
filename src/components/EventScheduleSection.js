import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';
import { SessionReminders } from '../services/sessionReminders';
import { feature } from '../constants/launchConfig';

// ─── Poll creation modal ──────────────────────────────────────────────────────
const CreatePollModal = ({ visible, onClose, eventId, scheduleSlot, primary, bg, textColor, muted }) => {
  useBackClose(visible, onClose);
  const { user } = useAuth();
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);

  const reset = () => { setQuestion(''); setOptions(['', '']); };

  const addOption = () => {
    if (options.length >= 8) return;
    setOptions(prev => [...prev, '']);
  };

  const updateOption = (idx, val) => setOptions(prev => prev.map((o, i) => i === idx ? val : o));

  const removeOption = (idx) => {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!question.trim()) return toast.show('Add a question first.', 'error');
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) return toast.show('Need at least 2 options.', 'error');
    if (!user?.id) return toast.show('Sign in to create a poll.', 'error');

    setLoading(true);
    try {
      const pollPayload = {
        event_id: eventId,
        author_id: user?.id,
        question: question.trim(),
        options: validOptions,
        schedule_slot: scheduleSlot || null,
        votes: {},
        created_at: new Date().toISOString(),
      };
      const ok = await resilient(
        [
          () => supabase.from('event_polls').insert(pollPayload),
          () => supabase.from('event_polls').upsert(pollPayload),
          () => supabase.rpc('create_event_poll', { p_event_id: eventId, p_author_id: user?.id, p_question: question.trim(), p_options: validOptions }),
        ],
        { attemptsPerTier: 2, baseMs: 400, label: `EventSchedule.createPoll:${eventId}`, fallbackValue: null }
      );
      if (ok === null) {
        toast.show('Could not create poll — try again.', 'error');
      } else {
        toast.show('Poll created! 🗳️', 'success');
        reset();
        onClose(true);
      }
    } catch (e) {
      toast.show('Could not create poll: ' + (e?.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(false); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={cp.overlay}>
        <View style={[cp.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={[cp.pill, { backgroundColor: `${primary}50` }]} />
          <View style={cp.header}>
            <Text style={[cp.title, { color: primary }]}>CREATE A POLL</Text>
            {scheduleSlot && (
              <Text style={[cp.slotLabel, { color: muted }]}>
                for {scheduleSlot.time} — {scheduleSlot.title}
              </Text>
            )}
            <TouchableOpacity onPress={() => { reset(); onClose(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: '80%' }}>
            <Text style={[cp.label, { color: muted }]}>Your question *</Text>
            <TextInput
              style={[cp.input, { color: textColor, borderColor: `${primary}35` }]}
              placeholder={scheduleSlot?.performer
                ? `e.g. What should ${scheduleSlot.performer} play first?`
                : 'e.g. Which artist should perform next?'}
              placeholderTextColor={muted}
              value={question}
              onChangeText={setQuestion}
              maxLength={140}
              multiline
            />

            <Text style={[cp.label, { color: muted }]}>Options (2–8)</Text>
            {options.map((opt, idx) => (
              <View key={idx} style={cp.optionRow}>
                <TextInput
                  style={[cp.optionInput, { color: textColor, borderColor: `${primary}35`, flex: 1 }]}
                  placeholder={`Option ${idx + 1}…`}
                  placeholderTextColor={muted}
                  value={opt}
                  onChangeText={v => updateOption(idx, v)}
                  maxLength={80}
                />
                {options.length > 2 && (
                  <TouchableOpacity onPress={() => removeOption(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="minus-circle" size={18} color="rgba(239,68,68,0.7)" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {options.length < 8 && (
              <TouchableOpacity style={[cp.addOptBtn, { borderColor: `${primary}35` }]} onPress={addOption}>
                <Feather name="plus" size={14} color={primary} />
                <Text style={{ color: primary, fontWeight: '700', fontSize: 13 }}>Add option</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[cp.createBtn, { backgroundColor: primary }, loading && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={cp.createBtnText}>LAUNCH POLL 🗳️</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Individual poll card ─────────────────────────────────────────────────────
const PollCard = ({ poll, primary, textColor, muted, userId, onVote }) => {
  const totalVotes = Object.values(poll.votes || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const userVote = Object.entries(poll.votes || {}).find(([, voters]) => voters?.includes(userId))?.[0];

  const getCount = (opt) => (poll.votes?.[opt]?.length || 0);
  const getPct = (opt) => totalVotes > 0 ? Math.round((getCount(opt) / totalVotes) * 100) : 0;

  return (
    <View style={[pc.card, { borderColor: `${primary}20`, backgroundColor: `${primary}06` }]}>
      <Text style={[pc.question, { color: textColor }]}>{poll.question}</Text>
      <View style={{ gap: 8, marginTop: 10 }}>
        {(poll.options || []).map((opt, idx) => {
          const pct = getPct(opt);
          const voted = userVote === opt;
          return (
            <TouchableOpacity
              key={idx}
              style={[pc.optBtn, { borderColor: voted ? primary : `${primary}25` }]}
              onPress={() => onVote(poll.id, opt, poll.votes)}
              activeOpacity={0.75}
            >
              <View style={[pc.optFill, { width: `${pct}%`, backgroundColor: voted ? `${primary}35` : `${primary}12` }]} />
              <View style={pc.optContent}>
                <Text style={[pc.optText, { color: voted ? primary : textColor }]}>{opt}</Text>
                <Text style={[pc.optPct, { color: voted ? primary : muted }]}>{pct}%</Text>
              </View>
              {voted && <Feather name="check-circle" size={14} color={primary} style={{ marginRight: 10 }} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[pc.meta, { color: muted }]}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</Text>
    </View>
  );
};

// ─── Main section component ───────────────────────────────────────────────────
export const EventScheduleSection = ({ event, primary, textColor, muted, bg }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [createPollVisible, setCreatePollVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // slot the poll is attached to
  const [expandedSlot, setExpandedSlot] = useState(null);
  // "My Agenda" — session_idx values the signed-in user has opted into.
  const [myAgenda, setMyAgenda] = useState(new Set());
  const [agendaOnly, setAgendaOnly] = useState(false);

  const schedule = event?.schedule || [];
  const _multiDay = new Set(schedule.map(x => x.day || 1)).size > 1 || (!!event?.end_date && event.end_date !== event?.event_date);
  const _dayDate = (n) => { if (!event?.event_date) return ''; const base = new Date(event.event_date); base.setDate(base.getDate() + (n - 1)); return base.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  // Absolute Date for a slot, mirroring _dayDate's day-offset math but keeping
  // the time-of-day too — this is what gets stored as session_time so the
  // server-side dispatcher can fire a reminder without parsing schedule JSON.
  const _slotDateTime = (slot) => {
    if (!event?.event_date) return null;
    const base = new Date(event.event_date);
    base.setDate(base.getDate() + ((slot.day || 1) - 1));
    const [h, m] = String(slot.time || '').split(':').map(Number);
    if (Number.isFinite(h)) base.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
    return base;
  };
  const scheduleByDay = (() => {
    let last = null;
    return schedule.map((x, i) => ({ slot: x, idx: i })).sort((a, b) => (a.slot.day || 1) - (b.slot.day || 1)).map(({ slot, idx }) => {
      const day = slot.day || 1;
      const dayHeader = (_multiDay && day !== last) ? { day, date: _dayDate(day) } : null;
      last = day;
      return { slot, idx, dayHeader };
    });
  })();
  const eventId = event?.id;

  const loadPolls = useCallback(async () => {
    if (!eventId) return;
    setPollsLoading(true);
    const { data, error } = await supabase
      .from('event_polls')
      .select('*, profiles(username, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    setPollsLoading(false);
    if (!error) setPolls(data || []);
  }, [eventId]);

  useEffect(() => { loadPolls(); }, [loadPolls]);

  useEffect(() => {
    if (!eventId || !user?.id || !feature('eventInfoPanel')) { setMyAgenda(new Set()); return; }
    SessionReminders.getMySelections(user.id, eventId).then(setMyAgenda);
  }, [eventId, user?.id]);

  const toggleAgenda = async (slot, idx) => {
    if (!user?.id) { toast.show('Sign in to build your agenda.', 'error'); return; }
    const dt = _slotDateTime(slot);
    const wasSelected = myAgenda.has(idx);
    // Optimistic — the toggle should feel instant, same as the poll vote above.
    setMyAgenda((prev) => {
      const next = new Set(prev);
      wasSelected ? next.delete(idx) : next.add(idx);
      return next;
    });
    const nowSelected = await SessionReminders.toggle(user.id, eventId, idx, dt?.toISOString());
    if (nowSelected !== !wasSelected) {
      // Server disagreed with the optimistic flip (e.g. a network error) —
      // resync from the DB rather than leave a wrong toggle showing.
      SessionReminders.getMySelections(user.id, eventId).then(setMyAgenda);
      toast.show('Could not update your agenda — try again.', 'error');
    } else if (nowSelected) {
      toast.show(dt ? "Added — we'll remind you 15 min before." : 'Added to your agenda.', 'success');
    }
  };

  // Real-time: reflect new polls and vote changes immediately
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`polls:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_polls', filter: `event_id=eq.${eventId}` }, loadPolls)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, loadPolls]);

  const handleVote = async (pollId, option, currentVotes) => {
    if (!user?.id) { toast.show('Sign in to vote.', 'error'); return; }

    const votes = { ...(currentVotes || {}) };

    // Remove existing vote by this user across all options
    Object.keys(votes).forEach(opt => {
      votes[opt] = (votes[opt] || []).filter(uid => uid !== user.id);
    });

    // Toggle: if user clicked their current option, their vote is removed; otherwise add
    const alreadyVoted = Object.entries(currentVotes || {}).some(([opt, voters]) => opt === option && voters?.includes(user.id));
    if (!alreadyVoted) {
      votes[option] = [...(votes[option] || []), user.id];
    }

    setPolls(prev => prev.map(p => p.id === pollId ? { ...p, votes } : p));

    try {
      const ok = await resilient(
        [
          () => supabase.from('event_polls').update({ votes }).eq('id', pollId),
          async () => { const { error } = await supabase.from('event_polls').update({ votes }).eq('id', pollId); if (error) throw error; },
          () => supabase.rpc('cast_poll_vote', { p_poll_id: pollId, p_votes: votes }),
        ],
        { attemptsPerTier: 2, baseMs: 300, label: `EventSchedule.vote:${pollId}`, fallbackValue: null }
      );
      if (ok === null) {
        toast.show('Vote failed — try again', 'error');
        loadPolls();
      }
    } catch {
      toast.show('Vote failed — check your connection', 'error');
      loadPolls();
    }
  };

  const pollsForSlot = (slotTitle) =>
    polls.filter(p => p.schedule_slot?.title === slotTitle);

  const generalPolls = polls.filter(p => !p.schedule_slot);

  if (schedule.length === 0 && polls.length === 0) return null;

  return (
    <View style={ss.container}>
      {/* Header */}
      <View style={ss.headerRow}>
        <Text style={[ss.sectionTitle, { color: textColor }]}>Schedule</Text>
        <TouchableOpacity
          style={[ss.createPollBtn, { borderColor: primary, backgroundColor: `${primary}12` }]}
          onPress={() => { setSelectedSlot(null); setCreatePollVisible(true); }}
        >
          <Feather name="bar-chart-2" size={13} color={primary} />
          <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>Create Poll</Text>
        </TouchableOpacity>
      </View>

      {/* My Agenda filter — only worth showing once the user has picked something */}
      {schedule.length > 0 && myAgenda.size > 0 && (
        <TouchableOpacity
          onPress={() => setAgendaOnly((v) => !v)}
          style={[ss.agendaChip, { borderColor: agendaOnly ? primary : `${primary}30`, backgroundColor: agendaOnly ? primary : 'transparent' }]}
          accessibilityRole="button"
          accessibilityState={{ selected: agendaOnly }}
          accessibilityLabel={agendaOnly ? 'Showing my agenda only — tap to show full schedule' : 'Show only my agenda'}
        >
          <Feather name="bookmark" size={12} color={agendaOnly ? '#000' : primary} />
          <Text style={{ color: agendaOnly ? '#000' : primary, fontWeight: '800', fontSize: 11 }}>
            My agenda ({myAgenda.size})
          </Text>
        </TouchableOpacity>
      )}

      {/* Schedule slots */}
      {schedule.length > 0 && (
        <View style={{ gap: 10, marginBottom: 16 }}>
          {scheduleByDay.filter(({ idx }) => !agendaOnly || myAgenda.has(idx)).map(({ slot, idx, dayHeader }) => {
            const slotPolls = pollsForSlot(slot.title);
            const isExpanded = expandedSlot === idx;
            const inAgenda = myAgenda.has(idx);
            return (
              <React.Fragment key={idx}>
              {dayHeader && (
                <View style={ss.dayHeader}>
                  <Text style={[ss.dayHeaderText, { color: primary }]}>DAY {dayHeader.day}</Text>
                  <Text style={[ss.dayHeaderDate, { color: muted }]}>{dayHeader.date}</Text>
                </View>
              )}
              <View style={[ss.slotCard, { borderColor: `${primary}25`, backgroundColor: `${primary}06` }]}>
                {/* Plain View wrapper, not a touchable — the expand tap target
                    and the agenda-toggle tap target must be SIBLINGS, not
                    nested TouchableOpacitys. Nesting them fights the gesture
                    responder on native and produces an invalid nested
                    <button> on web (the exact class of bug already flagged
                    elsewhere in this app). */}
                <View style={ss.slotHeader}>
                  <TouchableOpacity
                    style={ss.slotHeaderTap}
                    onPress={() => setExpandedSlot(isExpanded ? null : idx)}
                    activeOpacity={0.75}
                  >
                    <View style={[ss.timePill, { backgroundColor: `${primary}20` }]}>
                      <Text style={[ss.timeText, { color: primary }]}>{slot.time || '—'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.slotTitle, { color: textColor }]}>{slot.title}</Text>
                      {!!slot.performer && <Text style={[ss.slotPerformer, { color: muted }]}>{slot.performer}</Text>}
                      {!!slot.notes && !isExpanded && (
                        <Text style={[ss.slotNotes, { color: muted }]} numberOfLines={1}>{slot.notes}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {slotPolls.length > 0 && (
                        <View style={[ss.pollBadge, { backgroundColor: `${primary}25` }]}>
                          <Text style={[ss.pollBadgeText, { color: primary }]}>{slotPolls.length} poll{slotPolls.length !== 1 ? 's' : ''}</Text>
                        </View>
                      )}
                      <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={muted} />
                    </View>
                  </TouchableOpacity>

                  {/* Add to My Agenda — a sibling tap target, so picking a
                      session doesn't also expand/collapse it. */}
                  {feature('eventInfoPanel') && (
                    <TouchableOpacity
                      onPress={() => toggleAgenda(slot, idx)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={[ss.agendaBtn, { backgroundColor: inAgenda ? primary : `${primary}12`, borderColor: inAgenda ? primary : `${primary}30` }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: inAgenda }}
                      accessibilityLabel={inAgenda ? `Remove ${slot.title} from my agenda` : `Add ${slot.title} to my agenda — remind me 15 minutes before`}
                    >
                      <Feather name="bookmark" size={14} color={inAgenda ? '#000' : primary} />
                    </TouchableOpacity>
                  )}
                </View>

                {isExpanded && (
                  <View style={ss.slotBody}>
                    {!!slot.notes && (
                      <Text style={[ss.slotNotes, { color: muted, marginBottom: 12 }]}>{slot.notes}</Text>
                    )}

                    {/* Slot polls */}
                    {slotPolls.length > 0 && (
                      <View style={{ gap: 10, marginBottom: 10 }}>
                        {slotPolls.map(poll => (
                          <PollCard
                            key={poll.id}
                            poll={poll}
                            primary={primary}
                            textColor={textColor}
                            muted={muted}
                            userId={user?.id}
                            onVote={handleVote}
                          />
                        ))}
                      </View>
                    )}

                    {/* Create poll for this slot */}
                    <TouchableOpacity
                      style={[ss.addPollBtn, { borderColor: `${primary}30` }]}
                      onPress={() => { setSelectedSlot(slot); setCreatePollVisible(true); }}
                    >
                      <Feather name="plus" size={13} color={primary} />
                      <Text style={{ color: primary, fontSize: 12, fontWeight: '700' }}>
                        Add poll for this slot
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              </React.Fragment>
            );
          })}
        </View>
      )}

      {/* General event polls (not tied to a slot) */}
      {generalPolls.length > 0 && (
        <View style={{ gap: 10, marginBottom: 16 }}>
          <Text style={[ss.subHeader, { color: muted }]}>General Polls</Text>
          {generalPolls.map(poll => (
            <PollCard
              key={poll.id}
              poll={poll}
              primary={primary}
              textColor={textColor}
              muted={muted}
              userId={user?.id}
              onVote={handleVote}
            />
          ))}
        </View>
      )}

      {pollsLoading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ActivityIndicator size="small" color={primary} />
          <Text style={{ color: muted, fontSize: 12 }}>Loading polls…</Text>
        </View>
      )}

      {/* Create poll modal */}
      <CreatePollModal
        visible={createPollVisible}
        onClose={(refresh) => { setCreatePollVisible(false); setSelectedSlot(null); if (refresh) loadPolls(); }}
        eventId={eventId}
        scheduleSlot={selectedSlot}
        primary={primary}
        bg={bg}
        textColor={textColor}
        muted={muted}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 2, paddingHorizontal: 2 },
  dayHeaderText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  dayHeaderDate: { fontSize: 11, fontWeight: '700' },
  container: { marginTop: 20, marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  createPollBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  slotCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  slotHeader: { flexDirection: 'row', alignItems: 'center' },
  slotHeaderTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  agendaBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  agendaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  timePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, minWidth: 52, alignItems: 'center' },
  timeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  slotTitle: { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  slotPerformer: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  slotNotes: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  pollBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pollBadgeText: { fontSize: 10, fontWeight: '800' },
  slotBody: { paddingHorizontal: 14, paddingBottom: 14 },
  addPollBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  subHeader: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});

// Poll card styles
const pc = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  question: { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  optBtn: {
    position: 'relative', borderWidth: 1, borderRadius: 12,
    overflow: 'hidden', flexDirection: 'row', alignItems: 'center',
    minHeight: 42,
  },
  optFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12 },
  optContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  optText: { fontSize: 13, fontWeight: '700', flex: 1, flexShrink: 1, minWidth: 0 },
  optPct: { fontSize: 12, fontWeight: '800', marginLeft: 8 },
  meta: { fontSize: 11, marginTop: 8, textAlign: 'right' },
});

// Create poll modal styles
const cp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 22, paddingBottom: 10, maxHeight: '90%' },
  pill: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1 },
  slotLabel: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, marginBottom: 18, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optionInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 13, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addOptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20,
  },
  createBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 6 },
  createBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
