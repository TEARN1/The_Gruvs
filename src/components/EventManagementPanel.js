/**
 * EventManagementPanel
 *
 * Full organizer control panel rendered inside EventDetailScreen for the event owner.
 * Shows category-specific tools:
 *   • Lineup — add/edit/remove performers, speakers, DJs, etc.
 *   • Stages — multi-stage management
 *   • Setlist — live track-by-track logging
 *   • Sessions — conference / workshop schedule
 *   • Vendors — stall / food market management
 *   • Teams — hackathon team tracking
 *   • Judge Scores — dance, fashion, hackathon, etc.
 *   • Live Updates — post host-only updates visible on the event page
 *
 * Uses eventManagementEngine for all DB operations.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Modal, Image, Alert, Platform,
  KeyboardAvoidingView, Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  getEventMgmtConfig,
  LineupManager, StageManager, SetlistManager,
  SessionManager, VendorManager, HackTeamManager,
  JudgeScoreManager, LiveUpdatesManager,
} from '../services/eventManagementEngine';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

// Aliases for consistent naming in this component
const TeamManager = HackTeamManager;
const LiveUpdateManager = {
  list:   (eventId) => LiveUpdatesManager.list(eventId),
  post:   (eventId, authorId, body, type) => LiveUpdatesManager.post(eventId, authorId, body, type),
  delete: (id) => LiveUpdatesManager.delete(id),
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const Row = ({ children, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
    {children}
  </View>
);

const Chip = ({ label, active, onPress, color }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
      backgroundColor: active ? `${color}25` : 'transparent',
      borderColor: active ? color : `${color}40`,
    }}
  >
    <Text style={{ color: active ? color : `${color}80`, fontSize: 12, fontWeight: '700' }}>
      {label}
    </Text>
  </TouchableOpacity>
);

const InputField = ({ label, value, onChangeText, placeholder, multiline, style, color, bg, textColor }) => (
  <View style={[{ marginBottom: 12 }, style]}>
    {label ? <Text style={{ color: `${textColor}80`, fontSize: 11, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text> : null}
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={`${textColor}40`}
      multiline={multiline}
      style={{
        backgroundColor: `${color}08`, borderRadius: 10, borderWidth: 1,
        borderColor: `${color}20`, paddingHorizontal: 12,
        paddingVertical: multiline ? 10 : 0, height: multiline ? 80 : 44,
        color: textColor, fontSize: 14,
      }}
    />
  </View>
);

const ActionBtn = ({ icon, label, onPress, color, loading }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={loading}
    style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: `${color}20`, borderRadius: 10, borderWidth: 1,
      borderColor: `${color}40`, paddingHorizontal: 14, paddingVertical: 9,
    }}
  >
    {loading
      ? <ActivityIndicator size="small" color={color} />
      : <Feather name={icon} size={15} color={color} />
    }
    <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{label}</Text>
  </TouchableOpacity>
);

// ── Lineup Tab ────────────────────────────────────────────────────────────────

const LineupTab = ({ event, config, primary, textColor, surface, muted }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', role: '', stage: '', bio: '', set_start: '', set_end: '', social_handle: '' });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await LineupManager.list(event.id)); } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ name: '', role: config.lineup_roles?.[0] || '', stage: '', bio: '', set_start: '', set_end: '', social_handle: '' }); setAdding(true); setEditTarget(null); };
  const openEdit = (item) => { setForm({ name: item.name, role: item.role || '', stage: item.stage || '', bio: item.bio || '', set_start: item.set_start || '', set_end: item.set_end || '', social_handle: item.social_handle || '' }); setEditTarget(item); setAdding(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.show('Enter a name', 'error');
    try {
      if (editTarget) {
        await LineupManager.update(editTarget.id, form);
        toast.show('Updated', 'success');
      } else {
        await LineupManager.create(event.id, form);
        toast.show('Added to lineup', 'success');
      }
      setAdding(false);
      load();
    } catch (e) { toast.show(e.message || 'Error saving', 'error'); }
  };

  const handleDelete = (id) => {
    Alert.alert('Remove', 'Remove this person from the lineup?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await LineupManager.delete(id); load(); } },
    ]);
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Row style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>
          {config.label} Lineup ({items.length})
        </Text>
        <ActionBtn icon="plus" label="Add" onPress={openAdd} color={primary} />
      </Row>

      {items.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Text style={{ fontSize: 32 }}>🎭</Text>
          <Text style={{ color: muted, marginTop: 8, fontSize: 13 }}>No lineup yet — add your first act</Text>
        </View>
      )}

      {items.map(item => (
        <View key={item.id} style={[s.card, { borderColor: `${primary}20`, backgroundColor: `${primary}06` }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>{item.name}</Text>
              {item.role ? <Text style={{ color: primary, fontSize: 12, marginTop: 2 }}>{item.role}</Text> : null}
              {item.set_start ? (
                <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                  {item.set_start}{item.set_end ? ` – ${item.set_end}` : ''}{item.stage ? ` · ${item.stage}` : ''}
                </Text>
              ) : null}
              {item.social_handle ? <Text style={{ color: muted, fontSize: 11 }}>{item.social_handle}</Text> : null}
            </View>
            <Row>
              <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 6 }}>
                <Feather name="edit-2" size={15} color={muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                <Feather name="trash-2" size={15} color="#ef4444" />
              </TouchableOpacity>
            </Row>
          </Row>
        </View>
      ))}

      {/* Add / Edit Modal */}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[s.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <View style={[s.modalSheet, { backgroundColor: '#0d1112' }]}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>
                  {editTarget ? 'Edit' : 'Add'} to Lineup
                </Text>
                <TouchableOpacity onPress={() => setAdding(false)}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
              </Row>
              <ScrollView showsVerticalScrollIndicator={false}>
                <InputField label="Name *" value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Artist / Speaker / Host" color={primary} textColor={textColor} bg="#0d1112" />
                <Text style={{ color: `${textColor}80`, fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>ROLE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <Row>
                    {(config.lineup_roles || ['Host', 'Guest', 'Performer']).map(r => (
                      <Chip key={r} label={r} active={form.role === r} onPress={() => setForm(p => ({ ...p, role: r }))} color={primary} />
                    ))}
                  </Row>
                </ScrollView>
                <InputField label="Stage / Room" value={form.stage} onChangeText={v => setForm(p => ({ ...p, stage: v }))} placeholder="Main Stage, Room A…" color={primary} textColor={textColor} bg="#0d1112" />
                <Row style={{ marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <InputField label="Set Start" value={form.set_start} onChangeText={v => setForm(p => ({ ...p, set_start: v }))} placeholder="20:00" color={primary} textColor={textColor} bg="#0d1112" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputField label="Set End" value={form.set_end} onChangeText={v => setForm(p => ({ ...p, set_end: v }))} placeholder="21:30" color={primary} textColor={textColor} bg="#0d1112" />
                  </View>
                </Row>
                <InputField label="Social Handle" value={form.social_handle} onChangeText={v => setForm(p => ({ ...p, social_handle: v }))} placeholder="@handle" color={primary} textColor={textColor} bg="#0d1112" />
                <InputField label="Bio" value={form.bio} onChangeText={v => setForm(p => ({ ...p, bio: v }))} placeholder="Short bio…" multiline color={primary} textColor={textColor} bg="#0d1112" />
                <TouchableOpacity onPress={handleSave} style={[s.saveBtn, { backgroundColor: primary }]}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── Sessions Tab ──────────────────────────────────────────────────────────────

const SessionsTab = ({ event, config, primary, textColor, surface, muted }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ title: '', speaker: '', type: 'talk', room: '', start_time: '', end_time: '', description: '' });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await SessionManager.list(event.id)); } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ title: '', speaker: '', type: config.session_types?.[0] || 'talk', room: '', start_time: '', end_time: '', description: '' }); setEditTarget(null); setAdding(true); };
  const openEdit = (item) => { setForm({ title: item.title, speaker: item.speaker || '', type: item.type || 'talk', room: item.room || '', start_time: item.start_time || '', end_time: item.end_time || '', description: item.description || '' }); setEditTarget(item); setAdding(true); };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.show('Enter a session title', 'error');
    try {
      if (editTarget) { await SessionManager.update(editTarget.id, form); toast.show('Updated', 'success'); }
      else { await SessionManager.create(event.id, form); toast.show('Session added', 'success'); }
      setAdding(false); load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Delete this session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await SessionManager.delete(id); load(); } },
    ]);
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Row style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>Sessions ({items.length})</Text>
        <ActionBtn icon="plus" label="Add Session" onPress={openAdd} color={primary} />
      </Row>

      {items.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Text style={{ fontSize: 32 }}>📋</Text>
          <Text style={{ color: muted, marginTop: 8, fontSize: 13 }}>No sessions yet — build your schedule</Text>
        </View>
      )}

      {items.map(item => (
        <View key={item.id} style={[s.card, { borderColor: `${primary}20`, backgroundColor: `${primary}06` }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>{item.title}</Text>
              {item.speaker ? <Text style={{ color: primary, fontSize: 12, marginTop: 1 }}>{item.speaker}</Text> : null}
              <Row style={{ marginTop: 4, gap: 6 }}>
                {item.type ? <Text style={{ color: muted, fontSize: 11, backgroundColor: `${primary}12`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{item.type}</Text> : null}
                {item.start_time ? <Text style={{ color: muted, fontSize: 11 }}>{item.start_time}{item.end_time ? ` – ${item.end_time}` : ''}</Text> : null}
                {item.room ? <Text style={{ color: muted, fontSize: 11 }}>📍 {item.room}</Text> : null}
              </Row>
            </View>
            <Row>
              <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 6 }}><Feather name="edit-2" size={15} color={muted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 6 }}><Feather name="trash-2" size={15} color="#ef4444" /></TouchableOpacity>
            </Row>
          </Row>
        </View>
      ))}

      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[s.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <View style={[s.modalSheet, { backgroundColor: '#0d1112' }]}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>{editTarget ? 'Edit' : 'Add'} Session</Text>
                <TouchableOpacity onPress={() => setAdding(false)}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
              </Row>
              <ScrollView>
                <InputField label="Title *" value={form.title} onChangeText={v => setForm(p => ({ ...p, title: v }))} placeholder="Session name" color={primary} textColor={textColor} bg="#0d1112" />
                <InputField label="Speaker / Facilitator" value={form.speaker} onChangeText={v => setForm(p => ({ ...p, speaker: v }))} placeholder="Name" color={primary} textColor={textColor} bg="#0d1112" />
                <Text style={{ color: `${textColor}80`, fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <Row>
                    {(config.session_types || ['talk', 'workshop', 'q_and_a', 'keynote', 'panel', 'break']).map(t => (
                      <Chip key={t} label={t.replace(/_/g, ' ')} active={form.type === t} onPress={() => setForm(p => ({ ...p, type: t }))} color={primary} />
                    ))}
                  </Row>
                </ScrollView>
                <InputField label="Room / Stage" value={form.room} onChangeText={v => setForm(p => ({ ...p, room: v }))} placeholder="Main Hall, Room A…" color={primary} textColor={textColor} bg="#0d1112" />
                <Row style={{ marginBottom: 12 }}>
                  <View style={{ flex: 1 }}><InputField label="Start" value={form.start_time} onChangeText={v => setForm(p => ({ ...p, start_time: v }))} placeholder="09:00" color={primary} textColor={textColor} bg="#0d1112" /></View>
                  <View style={{ flex: 1 }}><InputField label="End" value={form.end_time} onChangeText={v => setForm(p => ({ ...p, end_time: v }))} placeholder="10:00" color={primary} textColor={textColor} bg="#0d1112" /></View>
                </Row>
                <InputField label="Description" value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="What attendees can expect…" multiline color={primary} textColor={textColor} bg="#0d1112" />
                <TouchableOpacity onPress={handleSave} style={[s.saveBtn, { backgroundColor: primary }]}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── Vendors Tab ───────────────────────────────────────────────────────────────

const VendorsTab = ({ event, config, primary, textColor, surface, muted }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', stall_number: '', contact: '', description: '', is_confirmed: true });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await VendorManager.list(event.id)); } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ name: '', category: config.vendor_categories?.[0] || 'Food', stall_number: '', contact: '', description: '', is_confirmed: true }); setEditTarget(null); setAdding(true); };
  const openEdit = (item) => { setForm({ name: item.name, category: item.category || '', stall_number: item.stall_number || '', contact: item.contact || '', description: item.description || '', is_confirmed: item.is_confirmed ?? true }); setEditTarget(item); setAdding(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.show('Enter a vendor name', 'error');
    try {
      if (editTarget) { await VendorManager.update(editTarget.id, form); toast.show('Updated', 'success'); }
      else { await VendorManager.create(event.id, form); toast.show('Vendor added', 'success'); }
      setAdding(false); load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
  };

  const handleDelete = (id) => {
    Alert.alert('Remove Vendor', 'Remove this vendor from the event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await VendorManager.delete(id); load(); } },
    ]);
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Row style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>Vendors ({items.length})</Text>
        <ActionBtn icon="plus" label="Add Vendor" onPress={openAdd} color={primary} />
      </Row>

      {items.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Text style={{ fontSize: 32 }}>🛒</Text>
          <Text style={{ color: muted, marginTop: 8, fontSize: 13 }}>No vendors yet — build your market map</Text>
        </View>
      )}

      {items.map(item => (
        <View key={item.id} style={[s.card, { borderColor: `${primary}20`, backgroundColor: `${primary}06` }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Row>
                <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>{item.name}</Text>
                <View style={{ backgroundColor: item.is_confirmed ? '#10b981' : '#f59e0b', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{item.is_confirmed ? 'CONFIRMED' : 'PENDING'}</Text>
                </View>
              </Row>
              <Row style={{ marginTop: 4, gap: 6 }}>
                {item.category ? <Text style={{ color: primary, fontSize: 12 }}>{item.category}</Text> : null}
                {item.stall_number ? <Text style={{ color: muted, fontSize: 11 }}>Stall {item.stall_number}</Text> : null}
                {item.contact ? <Text style={{ color: muted, fontSize: 11 }}>{item.contact}</Text> : null}
              </Row>
            </View>
            <Row>
              <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 6 }}><Feather name="edit-2" size={15} color={muted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 6 }}><Feather name="trash-2" size={15} color="#ef4444" /></TouchableOpacity>
            </Row>
          </Row>
        </View>
      ))}

      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[s.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <View style={[s.modalSheet, { backgroundColor: '#0d1112' }]}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>{editTarget ? 'Edit' : 'Add'} Vendor</Text>
                <TouchableOpacity onPress={() => setAdding(false)}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
              </Row>
              <ScrollView>
                <InputField label="Vendor Name *" value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Business name" color={primary} textColor={textColor} bg="#0d1112" />
                <Text style={{ color: `${textColor}80`, fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <Row>
                    {(config.vendor_categories || ['Food', 'Drinks', 'Crafts', 'Fashion', 'Art', 'Services']).map(c => (
                      <Chip key={c} label={c} active={form.category === c} onPress={() => setForm(p => ({ ...p, category: c }))} color={primary} />
                    ))}
                  </Row>
                </ScrollView>
                <InputField label="Stall Number" value={form.stall_number} onChangeText={v => setForm(p => ({ ...p, stall_number: v }))} placeholder="A12" color={primary} textColor={textColor} bg="#0d1112" />
                <InputField label="Contact" value={form.contact} onChangeText={v => setForm(p => ({ ...p, contact: v }))} placeholder="Phone / email" color={primary} textColor={textColor} bg="#0d1112" />
                <InputField label="Description" value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="What they're selling…" multiline color={primary} textColor={textColor} bg="#0d1112" />
                <TouchableOpacity
                  onPress={() => setForm(p => ({ ...p, is_confirmed: !p.is_confirmed }))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, padding: 10, borderRadius: 10, backgroundColor: `${primary}08`, borderWidth: 1, borderColor: `${primary}20` }}
                >
                  <Feather name={form.is_confirmed ? 'check-square' : 'square'} size={18} color={form.is_confirmed ? primary : muted} />
                  <Text style={{ color: form.is_confirmed ? primary : muted, fontWeight: '700' }}>Confirmed</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[s.saveBtn, { backgroundColor: primary }]}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── Live Updates Tab ──────────────────────────────────────────────────────────

const UPDATE_TYPES = [
  { key: 'announcement',    label: '📢 Announce' },
  { key: 'general',         label: '💬 General' },
  { key: 'set_now_playing', label: '🎵 Now Playing' },
  { key: 'delay',           label: '⏱ Delay' },
  { key: 'session_starting',label: '▶️ Session Starting' },
  { key: 'result',          label: '🏆 Result' },
  { key: 'safety',          label: '⚠️ Safety' },
];

const UpdatesTab = ({ event, primary, textColor, muted }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [updateType, setUpdateType] = useState('announcement');
  const [posting, setPosting] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await LiveUpdateManager.list(event.id)); } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      await LiveUpdateManager.post(event.id, user.id, content.trim(), updateType);
      setContent('');
      toast.show('Update posted', 'success');
      load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
    setPosting(false);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Delete this update?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await LiveUpdateManager.delete(id); load(); } },
    ]);
  };

  const types = {
    announcement:    { icon: 'mic',            color: primary },
    general:         { icon: 'info',           color: '#3b82f6' },
    artist_change:   { icon: 'user-check',     color: '#8b5cf6' },
    delay:           { icon: 'clock',          color: '#f59e0b' },
    cancellation:    { icon: 'x-circle',       color: '#ef4444' },
    set_now_playing: { icon: 'music',          color: '#10b981' },
    vendor_spotlight:{ icon: 'shopping-bag',   color: '#f97316' },
    session_starting:{ icon: 'play-circle',    color: '#06b6d4' },
    result:          { icon: 'award',          color: '#f59e0b' },
    award:           { icon: 'award',          color: '#f59e0b' },
    safety:          { icon: 'alert-triangle', color: '#ef4444' },
    weather:         { icon: 'cloud',          color: '#64748b' },
  };

  return (
    <View>
      {/* Post new update */}
      <View style={[s.card, { borderColor: `${primary}30`, backgroundColor: `${primary}06`, marginBottom: 16 }]}>
        {/* Update type picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {UPDATE_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setUpdateType(t.key)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, backgroundColor: updateType === t.key ? `${primary}25` : 'transparent', borderColor: updateType === t.key ? primary : `${primary}30` }}
              >
                <Text style={{ color: updateType === t.key ? primary : muted, fontSize: 11, fontWeight: '700' }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Post a live update to attendees…"
          placeholderTextColor={`${textColor}40`}
          multiline
          style={{ color: textColor, fontSize: 14, minHeight: 60 }}
        />
        <TouchableOpacity
          onPress={handlePost}
          disabled={posting || !content.trim()}
          style={{ alignSelf: 'flex-end', marginTop: 8, backgroundColor: primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, opacity: (!content.trim() || posting) ? 0.4 : 1 }}
        >
          {posting ? <ActivityIndicator size="small" color="#000" /> : <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Post Update</Text>}
        </TouchableOpacity>
      </View>


      {loading && <ActivityIndicator color={primary} style={{ marginTop: 12 }} />}

      {!loading && items.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 28 }}>📢</Text>
          <Text style={{ color: muted, marginTop: 6, fontSize: 13 }}>No updates posted yet</Text>
        </View>
      )}

      {items.map(item => {
        const meta = types[item.type] || types.host;
        return (
          <View key={item.id} style={[s.card, { borderColor: `${meta.color}20`, backgroundColor: `${meta.color}06` }]}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <Row>
                <Feather name={meta.icon} size={14} color={meta.color} />
                <Text style={{ color: meta.color, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{item.type}</Text>
              </Row>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 4 }}>
                <Feather name="trash-2" size={14} color="#ef4444" />
              </TouchableOpacity>
            </Row>
            <Text style={{ color: textColor, fontSize: 14 }}>{item.body || item.content}</Text>
            <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>{new Date(item.created_at).toLocaleTimeString()}</Text>
          </View>
        );
      })}
    </View>
  );
};

// ── Stages Tab ────────────────────────────────────────────────────────────────

const StagesTab = ({ event, primary, textColor, muted }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', capacity: '' });
  const [editTarget, setEditTarget] = useState(null);
  const toast = useToast();
  const STAGE_COLORS = ['#00f2ff', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await StageManager.list(event.id)); } catch { }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.show('Enter a stage name', 'error');
    try {
      const color = STAGE_COLORS[items.length % STAGE_COLORS.length];
      if (editTarget) { await StageManager.update(editTarget.id, { ...form, capacity: form.capacity ? parseInt(form.capacity) : null }); toast.show('Updated', 'success'); }
      else { await StageManager.create(event.id, { ...form, capacity: form.capacity ? parseInt(form.capacity) : null, color }); toast.show('Stage added', 'success'); }
      setAdding(false); setForm({ name: '', description: '', capacity: '' }); load();
    } catch (e) { toast.show(e.message || 'Error', 'error'); }
  };

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 20 }} />;

  return (
    <View>
      <Row style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>Stages ({items.length})</Text>
        <ActionBtn icon="plus" label="Add Stage" onPress={() => { setForm({ name: '', description: '', capacity: '' }); setEditTarget(null); setAdding(true); }} color={primary} />
      </Row>
      {items.map((item, i) => (
        <View key={item.id} style={[s.card, { borderColor: `${item.color || primary}30`, backgroundColor: `${item.color || primary}08` }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color || primary }} />
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>{item.name}</Text>
              {item.capacity ? <Text style={{ color: muted, fontSize: 12 }}>Cap: {item.capacity}</Text> : null}
            </Row>
            <Row>
              <TouchableOpacity onPress={() => { setForm({ name: item.name, description: item.description || '', capacity: item.capacity?.toString() || '' }); setEditTarget(item); setAdding(true); }} style={{ padding: 6 }}><Feather name="edit-2" size={14} color={muted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Delete Stage', 'Delete this stage?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await StageManager.delete(item.id); load(); } }])} style={{ padding: 6 }}><Feather name="trash-2" size={14} color="#ef4444" /></TouchableOpacity>
            </Row>
          </Row>
          {item.description ? <Text style={{ color: muted, fontSize: 12, marginTop: 4 }}>{item.description}</Text> : null}
        </View>
      ))}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[s.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <View style={[s.modalSheet, { backgroundColor: '#0d1112' }]}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>{editTarget ? 'Edit' : 'Add'} Stage</Text>
                <TouchableOpacity onPress={() => setAdding(false)}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
              </Row>
              <InputField label="Stage Name *" value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Main Stage, Tent B…" color={primary} textColor={textColor} bg="#0d1112" />
              <InputField label="Capacity" value={form.capacity} onChangeText={v => setForm(p => ({ ...p, capacity: v }))} placeholder="500" color={primary} textColor={textColor} bg="#0d1112" />
              <InputField label="Description" value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="Brief description…" multiline color={primary} textColor={textColor} bg="#0d1112" />
              <TouchableOpacity onPress={handleSave} style={[s.saveBtn, { backgroundColor: primary }]}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── Main EventManagementPanel ──────────────────────────────────────────────────

export const EventManagementPanel = ({ event, primary, textColor, surface, muted }) => {
  const config = getEventMgmtConfig(event?.category);
  const features = config.features || ['lineup', 'live_updates'];

  const TABS = [];
  if (features.includes('lineup'))        TABS.push({ key: 'lineup',    label: 'Lineup',    icon: 'mic' });
  if (features.includes('stages'))        TABS.push({ key: 'stages',    label: 'Stages',    icon: 'layers' });
  if (features.includes('sessions'))      TABS.push({ key: 'sessions',  label: 'Schedule',  icon: 'calendar' });
  if (features.includes('vendors'))       TABS.push({ key: 'vendors',   label: 'Vendors',   icon: 'shopping-bag' });
  TABS.push({ key: 'updates', label: 'Updates', icon: 'broadcast' });

  const [activeTab, setActiveTab] = useState(TABS[0]?.key || 'updates');

  if (!event?.id) return null;

  const bg = '#0d1112';

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      {/* Category badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Text style={{ fontSize: 22 }}>{config.icon}</Text>
        <View>
          <Text style={{ color: primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>EVENT MANAGEMENT</Text>
          <Text style={{ color: textColor, fontSize: 15, fontWeight: '900' }}>{config.label}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <Row style={{ gap: 8 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: isActive ? `${primary}20` : 'transparent',
                  borderColor: isActive ? primary : `${primary}30`,
                }}
              >
                <Feather name={tab.icon} size={13} color={isActive ? primary : `${primary}60`} />
                <Text style={{ color: isActive ? primary : `${primary}60`, fontWeight: '700', fontSize: 12 }}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Row>
      </ScrollView>

      {/* Tab content */}
      {activeTab === 'lineup'   && <LineupTab   event={event} config={config} primary={primary} textColor={textColor} surface={surface} muted={muted} />}
      {activeTab === 'stages'   && <StagesTab   event={event} primary={primary} textColor={textColor} muted={muted} />}
      {activeTab === 'sessions' && <SessionsTab event={event} config={config} primary={primary} textColor={textColor} surface={surface} muted={muted} />}
      {activeTab === 'vendors'  && <VendorsTab  event={event} config={config} primary={primary} textColor={textColor} surface={surface} muted={muted} />}
      {activeTab === 'updates'  && <UpdatesTab  event={event} primary={primary} textColor={textColor} muted={muted} />}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  saveBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 8,
  },
});
