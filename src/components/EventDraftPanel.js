/**
 * EventDraftPanel — "Plan together": a crew fills ONE shared event draft in
 * real time and launches it as a real event. Renders inside CrewDetailModal.
 *
 * The server (event_drafts.sql) owns all the rules — attribution, field
 * claims, the readiness checklist, the 2-person launch quorum. This panel
 * only renders server state and calls the RPCs via DraftManager.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { DraftManager } from '../services/dataFlow';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';

const FIELD_ROWS = [
  { key: 'title', label: 'Event name', placeholder: 'What are we calling it?' },
  { key: 'event_date', label: 'Date', placeholder: 'YYYY-MM-DD' },
  { key: 'event_time', label: 'Time', placeholder: 'e.g. 21:00' },
  { key: 'venue_name', label: 'Venue', placeholder: 'Where is it happening?' },
  { key: 'location', label: 'Area / address', placeholder: 'City, area or address' },
  { key: 'category', label: 'Category', placeholder: 'e.g. Party, Gig, Braai' },
  { key: 'price', label: 'Entry', placeholder: 'e.g. Free / R50 at the door' },
  { key: 'capacity', label: 'Capacity', placeholder: 'Max people (optional)', numeric: true },
  { key: 'min_age', label: 'Min age', placeholder: 'e.g. 18 (optional)', numeric: true },
  { key: 'description', label: 'Description', placeholder: 'Tell people what to expect…', multiline: true },
];

// One editable row of the shared form. Saves on blur; shows who set it last.
const DraftFieldRow = ({ row, draft, nameOf, onSave, onClaim, colors }) => {
  const { text, muted, primary } = colors;
  const meta = draft.field_meta?.[row.key];
  const [val, setVal] = useState(draft[row.key] == null ? '' : String(draft[row.key]));
  const [dirty, setDirty] = useState(false);
  const focusedRef = useRef(false);

  // Live co-editing: adopt remote values unless this user is mid-edit.
  useEffect(() => {
    if (!focusedRef.current && !dirty) {
      setVal(draft[row.key] == null ? '' : String(draft[row.key]));
    }
  }, [draft[row.key]]); // eslint-disable-line react-hooks/exhaustive-deps

  const attribution = meta?.by ? `set by ${nameOf(meta.by)}` : null;
  const claimedBy = meta?.claimed_by && meta?.claimed_at
    && (Date.now() - new Date(meta.claimed_at).getTime()) < 15 * 60 * 1000
    ? meta.claimed_by : null;

  return (
    <View style={s.fieldRow}>
      <View style={s.rowBetween}>
        <Text style={[s.fieldLabel, { color: muted }]}>{row.label.toUpperCase()}</Text>
        {attribution && <Text style={{ color: `${primary}cc`, fontSize: 10, fontWeight: '700' }}>{attribution}</Text>}
      </View>
      <TextInput
        value={val}
        onChangeText={(t) => { setVal(t); setDirty(true); }}
        onFocus={() => { focusedRef.current = true; onClaim(row.key); }}
        onBlur={() => {
          focusedRef.current = false;
          if (dirty) { setDirty(false); onSave(row.key, val); }
        }}
        placeholder={row.placeholder}
        placeholderTextColor={muted}
        keyboardType={row.numeric ? 'number-pad' : 'default'}
        multiline={!!row.multiline}
        style={[s.fieldInput, {
          color: text, borderColor: `${primary}30`,
          height: row.multiline ? 72 : undefined,
          textAlignVertical: row.multiline ? 'top' : 'center',
        }]}
      />
      {claimedBy ? (
        <Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>
          {nameOf(claimedBy)} is handling this one
        </Text>
      ) : null}
    </View>
  );
};

// Shared prep tasks (feature 51): add, check off, hand out — live for everyone.
const TaskSection = ({ draftId, members, nameOf, colors }) => {
  const { text, muted, accent } = colors;
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [assignFor, setAssignFor] = useState(null); // task id with picker open

  const load = useCallback(() => { DraftManager.fetchTasks(draftId).then(setTasks); }, [draftId]);

  useEffect(() => {
    load();
    const off = DraftManager.subscribeTasks(draftId, load);
    return off;
  }, [draftId, load]);

  const add = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    try { await DraftManager.addTask(draftId, title); load(); }
    catch (e) { toast(e?.message || 'Could not add task.', 'error'); }
  };

  const toggle = async (t) => {
    try {
      const updated = await DraftManager.toggleTask(t.id, !t.done_at);
      setTasks(prev => prev.map(x => (x.id === t.id ? updated : x)));
    } catch (e) { toast(e?.message || 'Could not update task.', 'error'); }
  };

  const assign = async (t, userId) => {
    setAssignFor(null);
    try {
      const updated = await DraftManager.assignTask(t.id, userId);
      setTasks(prev => prev.map(x => (x.id === t.id ? updated : x)));
    } catch (e) { toast(e?.message || 'Could not assign task.', 'error'); }
  };

  const remove = async (t) => {
    try { await DraftManager.deleteTask(t.id); setTasks(prev => prev.filter(x => x.id !== t.id)); }
    catch (e) { toast(e?.message || 'Could not remove task.', 'error'); }
  };

  const doneCount = tasks.filter(t => t.done_at).length;

  return (
    <View style={{ marginTop: 12 }}>
      <View style={s.rowBetween}>
        <Text style={[s.fieldLabel, { color: muted }]}>PREP TASKS</Text>
        {tasks.length > 0 && (
          <Text style={{ color: muted, fontSize: 10, fontWeight: '800' }}>{doneCount}/{tasks.length} done</Text>
        )}
      </View>

      {tasks.map(t => (
        <View key={t.id}>
          <View style={s.taskRow}>
            <TouchableOpacity onPress={() => toggle(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name={t.done_at ? 'check-square' : 'square'} size={18}
                color={t.done_at ? '#10b981' : muted} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{
                color: t.done_at ? muted : text, fontSize: 13, fontWeight: '600',
                textDecorationLine: t.done_at ? 'line-through' : 'none',
              }}>{t.title}</Text>
              {t.done_at
                ? <Text style={{ color: muted, fontSize: 10 }}>done by {nameOf(t.done_by)}</Text>
                : t.assigned_to
                  ? <Text style={{ color: `${accent}cc`, fontSize: 10 }}>{nameOf(t.assigned_to)} is on it</Text>
                  : null}
            </View>
            {!t.done_at && (
              <TouchableOpacity onPress={() => setAssignFor(assignFor === t.id ? null : t.id)}
                style={[s.assignChip, { borderColor: `${accent}44` }]}>
                <Feather name="user-plus" size={12} color={accent} />
              </TouchableOpacity>
            )}
            {(t.created_by === user?.id) && (
              <TouchableOpacity onPress={() => remove(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color={muted} />
              </TouchableOpacity>
            )}
          </View>
          {assignFor === t.id && (
            <View style={s.assignRow}>
              {(members || []).map(m => (
                <TouchableOpacity key={m.id} onPress={() => assign(t, m.id)}
                  style={[s.assignChip, { borderColor: `${accent}66`, paddingHorizontal: 10 }]}>
                  <Text style={{ color: accent, fontSize: 11, fontWeight: '800' }}>
                    {m.id === user?.id ? 'me' : `@${m.username || 'member'}`}
                  </Text>
                </TouchableOpacity>
              ))}
              {t.assigned_to && (
                <TouchableOpacity onPress={() => assign(t, null)}
                  style={[s.assignChip, { borderColor: `${muted}66`, paddingHorizontal: 10 }]}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '800' }}>unassign</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <TextInput
          value={newTitle} onChangeText={setNewTitle} maxLength={200}
          placeholder="Add a task (e.g. bring the speaker)" placeholderTextColor={muted}
          onSubmitEditing={add} returnKeyType="done"
          style={[s.fieldInput, { color: text, borderColor: `${accent}30`, flex: 1 }]}
        />
        <TouchableOpacity onPress={add} disabled={!newTitle.trim()}
          style={[s.addTaskBtn, { backgroundColor: newTitle.trim() ? accent : `${accent}30` }]}>
          <Feather name="plus" size={18} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// The full shared-draft sheet: fields + checklist + arm/launch.
const DraftSheet = ({ visible, draftId, crew, members, onClose, onChanged }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const accent = crew?.color || primary;

  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  const nameOf = useCallback((uid) => {
    if (uid === user?.id) return 'you';
    const m = (members || []).find(p => p.id === uid)
      || (draft?.event_draft_members || []).map(r => r.profiles).find(p => p?.id === uid);
    return m?.username ? `@${m.username}` : 'a member';
  }, [members, draft, user?.id]);

  const load = useCallback(async () => {
    if (!draftId) return;
    const d = await DraftManager.get(draftId);
    setDraft(d);
  }, [draftId]);

  useEffect(() => {
    if (!visible || !draftId) return;
    load();
    // Confirms live in a child table, so re-fetch the whole draft on any change.
    const off = DraftManager.subscribe(draftId, () => load());
    return off;
  }, [visible, draftId, load]);

  const save = async (field, value) => {
    try {
      const updated = await DraftManager.setField(draftId, field, value === '' ? null : value);
      setDraft(prev => ({ ...prev, ...updated }));
      onChanged?.();
    } catch (e) { toast(e?.message || 'Could not save that.', 'error'); load(); }
  };

  const claim = (field) => { DraftManager.claimField(draftId, field).catch(() => {}); };

  const confirms = draft?.event_draft_confirms || [];
  const iConfirmed = confirms.some(c => c.user_id === user?.id);
  const memberCount = (draft?.event_draft_members || []).length || 1;
  const needed = Math.min(2, memberCount);
  const checklist = DraftManager.checklist(draft);
  const ready = checklist.filter(c => !c.optional).every(c => c.done);
  const armed = confirms.length >= needed;

  const confirm = async () => {
    try {
      await DraftManager.confirmLaunch(draftId);
      load();
    } catch (e) { toast(e?.message || 'Could not confirm.', 'error'); }
  };

  const launch = async () => {
    setBusy(true);
    try {
      await DraftManager.launch(draftId);
      toast('Your event is LIVE!', 'success');
      onChanged?.(); onClose();
    } catch (e) { toast(e?.message || 'Not ready to launch yet.', 'error'); load(); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${accent}40`, maxHeight: '92%' }]}>
          <View style={s.sheetHandle} />
          <View style={s.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <MaterialCommunityIcons name="rocket-launch-outline" size={20} color={accent} />
              <Text style={[s.sheetTitle, { color: text }]} numberOfLines={1}>
                {draft?.title || 'Untitled plan'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={text} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: muted, fontSize: 11, marginBottom: 8 }}>
            Everyone in {crew?.name || 'the crew'} can fill this together — edits show up live.
          </Text>

          {!draft ? <ActivityIndicator color={accent} style={{ marginVertical: 30 }} /> : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {FIELD_ROWS.map(row => (
                <DraftFieldRow
                  key={row.key} row={row} draft={draft} nameOf={nameOf}
                  onSave={save} onClaim={claim}
                  colors={{ text, muted, primary: accent }}
                />
              ))}

              <TaskSection
                draftId={draftId} members={members} nameOf={nameOf}
                colors={{ text, muted, accent }}
              />

              {/* Readiness burn-down (server re-checks all of this at launch) */}
              <Text style={[s.fieldLabel, { color: muted, marginTop: 12 }]}>READY TO LAUNCH?</Text>
              {checklist.map(c => (
                <View key={c.key} style={s.checkRow}>
                  <Feather name={c.done ? 'check-circle' : 'circle'} size={15}
                    color={c.done ? '#10b981' : c.optional ? muted : '#f59e0b'} />
                  <Text style={{ color: c.done ? text : muted, fontSize: 13 }}>
                    {c.label}{c.optional ? ' (optional)' : ''}
                  </Text>
                </View>
              ))}

              {/* Arm + launch. Any edit resets confirmations server-side. */}
              <View style={[s.launchBox, { borderColor: `${accent}40`, backgroundColor: `${accent}10` }]}>
                <Text style={{ color: text, fontWeight: '800', fontSize: 13 }}>
                  {confirms.length}/{needed} confirmed
                </Text>
                <Text style={{ color: muted, fontSize: 11, marginBottom: 10 }}>
                  {needed > 1
                    ? 'Two of you must confirm the final version before launch. Editing anything resets confirmations.'
                    : 'Confirm the final version, then launch.'}
                </Text>
                {!iConfirmed ? (
                  <TouchableOpacity onPress={confirm} disabled={!ready}
                    style={[s.cta, { backgroundColor: ready ? accent : `${accent}30` }]}>
                    <Text style={s.ctaText}>{ready ? 'Confirm this version' : 'Finish the checklist first'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={launch} disabled={!armed || busy}
                    style={[s.cta, { backgroundColor: armed ? '#10b981' : `${accent}30` }]}>
                    {busy ? <ActivityIndicator color="#000" /> : armed ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Feather name="send" size={16} color="#000" />
                        <Text style={s.ctaText}>Launch the event</Text>
                      </View>
                    ) : (
                      <Text style={s.ctaText}>
                        {`Waiting for ${needed - confirms.length} more confirmation…`}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// The strip inside the crew modal: existing plans + start a new one.
export const EventDraftPanel = ({ crew, members }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const accent = crew?.color || primary;

  const [drafts, setDrafts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [pastEvents, setPastEvents] = useState([]);
  const [showRunBack, setShowRunBack] = useState(false);

  const refresh = useCallback(async () => {
    if (!crew?.id) return;
    const all = await DraftManager.fetchMine();
    setDrafts(all.filter(d => d.crew_id === crew.id && d.status === 'draft'));
  }, [crew?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (showRunBack && user?.id && pastEvents.length === 0) {
      DraftManager.fetchRunBackCandidates(user.id).then(setPastEvents);
    }
  }, [showRunBack, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPlan = async () => {
    setCreating(true);
    try {
      const d = await DraftManager.create(crew.id, null);
      // Pull the whole crew into the plan (server dedups + enforces blocks/caps).
      await Promise.allSettled(
        (members || []).filter(m => m.id !== user?.id)
          .map(m => DraftManager.addMember(d.id, m.id))
      );
      await refresh();
      setOpenId(d.id);
    } catch (e) { toast(e?.message || 'Could not start a plan.', 'error'); }
    finally { setCreating(false); }
  };

  const runBack = async (ev) => {
    setCreating(true);
    try {
      const d = await DraftManager.forkEvent(ev.id, crew.id);
      await Promise.allSettled(
        (members || []).filter(m => m.id !== user?.id)
          .map(m => DraftManager.addMember(d.id, m.id))
      );
      await refresh();
      setShowRunBack(false);
      setOpenId(d.id);
      toast('Pre-filled from last time — just pick a new date.', 'success');
    } catch (e) { toast(e?.message || 'Could not run it back.', 'error'); }
    finally { setCreating(false); }
  };

  if (!crew) return null;

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[s.fieldLabel, { color: muted }]}>PLAN TOGETHER</Text>

      {drafts.map(d => {
        const done = DraftManager.checklist(d).filter(c => !c.optional && c.done).length;
        return (
          <TouchableOpacity key={d.id} onPress={() => setOpenId(d.id)}
            style={[s.draftCard, { borderColor: `${accent}55`, backgroundColor: `${accent}10` }]}>
            <MaterialCommunityIcons name="clipboard-edit-outline" size={20} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
                {d.title || 'Untitled plan'}
              </Text>
              <Text style={{ color: muted, fontSize: 11 }}>
                {done}/3 ready{d.event_date ? ` • ${d.event_date}` : ''}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={muted} />
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity onPress={startPlan} disabled={creating}
        style={[s.startBtn, { borderColor: `${accent}55` }]}>
        {creating ? <ActivityIndicator color={accent} size="small" /> : (
          <>
            <Feather name="plus-circle" size={15} color={accent} />
            <Text style={{ color: accent, fontWeight: '900', fontSize: 12 }}>Plan an event together</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Run it back: fork a past hosted event into a fresh draft */}
      <TouchableOpacity onPress={() => setShowRunBack(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, justifyContent: 'center' }}>
        <MaterialCommunityIcons name="replay" size={14} color={muted} />
        <Text style={{ color: muted, fontWeight: '800', fontSize: 11 }}>
          {showRunBack ? 'Hide past events' : 'Run back a past event'}
        </Text>
      </TouchableOpacity>
      {showRunBack && (
        pastEvents.length === 0 ? (
          <Text style={{ color: muted, fontSize: 11, textAlign: 'center', paddingBottom: 8 }}>
            No past hosted events yet — your first launch starts the history.
          </Text>
        ) : pastEvents.map(ev => (
          <TouchableOpacity key={ev.id} onPress={() => runBack(ev)} disabled={creating}
            style={[s.draftCard, { borderColor: `${accent}33` }]}>
            <MaterialCommunityIcons name="history" size={18} color={muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{ev.title}</Text>
              <Text style={{ color: muted, fontSize: 11 }} numberOfLines={1}>
                {[ev.event_date, ev.venue_name].filter(Boolean).join(' • ')}
              </Text>
            </View>
            <Text style={{ color: accent, fontWeight: '900', fontSize: 11 }}>RUN IT BACK</Text>
          </TouchableOpacity>
        ))
      )}

      <DraftSheet
        visible={!!openId} draftId={openId} crew={crew} members={members}
        onClose={() => setOpenId(null)} onChanged={refresh}
      />
    </View>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, padding: 18, paddingBottom: 28 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontWeight: '900', flexShrink: 1 },
  fieldRow: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  launchBox: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 14, marginBottom: 8 },
  cta: { borderRadius: 22, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 14 },
  draftCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  assignChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  assignRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 28, paddingBottom: 6 },
  addTaskBtn: { width: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
