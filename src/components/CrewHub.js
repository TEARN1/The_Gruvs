/**
 * CrewHub — create/join named crews, see pending invites, open a crew to invite
 * people you follow. Mounted at the top of the Crew tab.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, Image, ActivityIndicator, Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { CrewManager } from '../services/crewManager';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';

const ICONS = ['account-group', 'fire', 'crown', 'guitar-electric', 'soccer', 'glass-cocktail', 'rocket-launch', 'heart', 'star', 'compass'];
const COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f97316', '#3b82f6', '#f59e0b', '#06b6d4', '#ef4444'];

// ── Create Crew modal ──────────────────────────────────────────────────────────
const CreateCrewModal = ({ visible, onClose, onCreated }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setName(''); setDesc(''); setIcon(ICONS[0]); setColor(COLORS[0]); } }, [visible]);

  const create = async () => {
    if (!name.trim()) { toast('Give your crew a name.', 'error'); return; }
    setSaving(true);
    try {
      const crew = await CrewManager.createCrew({ name, description: desc, icon, color });
      toast(`Crew "${crew.name}" created`, 'success');
      onCreated?.(crew);
      onClose();
    } catch (e) {
      toast(e?.message || 'Could not create crew.', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={s.sheetHandle} />
          <View style={s.rowBetween}>
            <Text style={[s.sheetTitle, { color: text }]}>New Crew</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Feather name="x" size={22} color={text} /></TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={[s.previewBubble, { backgroundColor: `${color}22`, borderColor: color }]}>
            <MaterialCommunityIcons name={icon} size={30} color={color} />
          </View>

          <TextInput
            value={name} onChangeText={setName} maxLength={60}
            placeholder="Crew name (e.g. The Saturday Squad)" placeholderTextColor={muted}
            style={[s.input, { color: text, borderColor: `${primary}30` }]}
          />
          <TextInput
            value={desc} onChangeText={setDesc} maxLength={280} multiline
            placeholder="What's this crew about? (optional)" placeholderTextColor={muted}
            style={[s.input, { color: text, borderColor: `${primary}30`, height: 64, textAlignVertical: 'top' }]}
          />

          <Text style={[s.label, { color: muted }]}>ICON</Text>
          <View style={s.pickRow}>
            {ICONS.map(ic => (
              <TouchableOpacity key={ic} onPress={() => setIcon(ic)}
                style={[s.iconCell, { borderColor: icon === ic ? color : `${primary}22`, backgroundColor: icon === ic ? `${color}22` : 'transparent' }]}>
                <MaterialCommunityIcons name={ic} size={20} color={icon === ic ? color : muted} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.label, { color: muted }]}>COLOR</Text>
          <View style={s.pickRow}>
            {COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => setColor(c)}
                style={[s.colorCell, { backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent' }]} />
            ))}
          </View>

          <TouchableOpacity onPress={create} disabled={saving}
            style={[s.cta, { backgroundColor: name.trim() ? primary : `${primary}40` }]}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={s.ctaText}>Create Crew</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Crew detail (members + invite people you follow) ───────────────────────────
const CrewDetailModal = ({ visible, crew, onClose, onChanged }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [members, setMembers] = useState([]);
  const [follows, setFollows] = useState([]);
  const [invited, setInvited] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const isOwner = crew && user && crew.owner_id === user.id;

  const load = useCallback(async () => {
    if (!crew?.id || !user) return;
    setLoading(true);
    const mem = await CrewManager.getMembers(crew.id);
    setMembers(mem);
    const memIds = new Set(mem.map(m => m.id));
    // People you follow, minus existing members
    const { data } = await supabase
      .from('follows')
      .select('profiles:following_id(id, username, avatar_url)')
      .eq('follower_id', user.id)
      .limit(200);
    setFollows((data || []).map(r => r.profiles).filter(p => p && !memIds.has(p.id)));
    setLoading(false);
  }, [crew?.id, user]);

  useEffect(() => { if (visible) { setInvited(new Set()); load(); } }, [visible, load]);

  const invite = async (p) => {
    try {
      await CrewManager.invite(crew.id, user.id, p.id, crew.name);
      setInvited(prev => new Set(prev).add(p.id));
      toast(`Invited @${p.username}`, 'success');
    } catch (e) { toast(e?.message || 'Could not invite.', 'error'); }
  };

  const leave = async () => {
    try {
      if (isOwner) { await CrewManager.deleteCrew(crew.id); toast('Crew deleted', 'info'); }
      else { await CrewManager.leaveCrew(crew.id, user.id); toast('Left crew', 'info'); }
      onChanged?.(); onClose();
    } catch (e) { toast(e?.message || 'Could not update crew.', 'error'); }
  };

  if (!crew) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${crew.color || primary}40`, maxHeight: '88%' }]}>
          <View style={s.sheetHandle} />
          <View style={s.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[s.crewIconSm, { backgroundColor: `${crew.color || primary}22`, borderColor: crew.color || primary }]}>
                <MaterialCommunityIcons name={crew.icon || 'account-group'} size={20} color={crew.color || primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.sheetTitle, { color: text }]} numberOfLines={1}>{crew.name}</Text>
                <Text style={{ color: muted, fontSize: 11 }}>{members.length} member{members.length === 1 ? '' : 's'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Feather name="x" size={22} color={text} /></TouchableOpacity>
          </View>

          {crew.description ? <Text style={{ color: muted, fontSize: 13, marginBottom: 10 }}>{crew.description}</Text> : null}

          {loading ? <ActivityIndicator color={primary} style={{ marginVertical: 24 }} /> : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[s.label, { color: muted }]}>MEMBERS</Text>
              {members.map(m => (
                <View key={m.id} style={s.personRow}>
                  {m.avatar_url ? <Image source={{ uri: m.avatar_url }} style={s.personAvatar} />
                    : <View style={[s.personAvatar, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: text, fontWeight: '800' }}>{(m.username || '?')[0]?.toUpperCase()}</Text></View>}
                  <Text style={[s.personName, { color: text }]} numberOfLines={1}>@{m.username || 'member'}</Text>
                  {m.role === 'owner' && <View style={[s.rolePill, { backgroundColor: `${primary}22` }]}><Text style={{ color: primary, fontSize: 9, fontWeight: '900' }}>OWNER</Text></View>}
                </View>
              ))}

              <Text style={[s.label, { color: muted, marginTop: 14 }]}>INVITE PEOPLE YOU FOLLOW</Text>
              {follows.length === 0 ? (
                <Text style={{ color: muted, fontSize: 12, paddingVertical: 8 }}>Everyone you follow is already in this crew, or you're not following anyone yet.</Text>
              ) : follows.map(p => (
                <View key={p.id} style={s.personRow}>
                  {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={s.personAvatar} />
                    : <View style={[s.personAvatar, { backgroundColor: `${primary}22`, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: text, fontWeight: '800' }}>{(p.username || '?')[0]?.toUpperCase()}</Text></View>}
                  <Text style={[s.personName, { color: text }]} numberOfLines={1}>@{p.username || 'viber'}</Text>
                  <TouchableOpacity onPress={() => invite(p)} disabled={invited.has(p.id)}
                    style={[s.inviteBtn, { backgroundColor: invited.has(p.id) ? 'transparent' : primary, borderColor: primary }]}>
                    <Text style={{ color: invited.has(p.id) ? primary : '#000', fontSize: 11, fontWeight: '900' }}>{invited.has(p.id) ? 'Invited' : 'Invite'}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity onPress={leave} style={[s.leaveBtn, { borderColor: '#ef444455' }]}>
                <Feather name={isOwner ? 'trash-2' : 'log-out'} size={14} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>{isOwner ? 'Delete crew' : 'Leave crew'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── Hub (strip of crews + invites + create) ────────────────────────────────────
export const CrewHub = ({ onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [crews, setCrews] = useState([]);
  const [invites, setInvites] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [c, i] = await Promise.all([CrewManager.listMyCrews(user.id), CrewManager.listMyInvites(user.id)]);
    setCrews(c); setInvites(i);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const respond = async (inv, accept) => {
    try {
      await CrewManager.respondInvite(inv.id, accept);
      toast(accept ? `Joined ${inv.crews?.name}` : 'Invite declined', accept ? 'success' : 'info');
      refresh();
    } catch (e) { toast(e?.message || 'Could not respond.', 'error'); }
  };

  if (!user) return null;

  return (
    <View style={{ paddingTop: 6 }}>
      {/* Pending invites */}
      {invites.map(inv => (
        <View key={inv.id} style={[s.inviteCard, { borderColor: `${inv.crews?.color || primary}55`, backgroundColor: `${inv.crews?.color || primary}10` }]}>
          <View style={[s.crewIconSm, { backgroundColor: `${inv.crews?.color || primary}22`, borderColor: inv.crews?.color || primary }]}>
            <MaterialCommunityIcons name={inv.crews?.icon || 'account-group'} size={18} color={inv.crews?.color || primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{inv.crews?.name}</Text>
            <Text style={{ color: muted, fontSize: 11 }}>@{inv.inviter?.username || 'someone'} invited you</Text>
          </View>
          <TouchableOpacity onPress={() => respond(inv, true)} style={[s.smBtn, { backgroundColor: primary }]}><Text style={{ color: '#000', fontWeight: '900', fontSize: 11 }}>Join</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => respond(inv, false)} style={[s.smBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: muted }]}><Feather name="x" size={13} color={muted} /></TouchableOpacity>
        </View>
      ))}

      {/* My crews strip */}
      <View style={[s.rowBetween, { paddingHorizontal: 16, marginTop: 6 }]}>
        <Text style={[s.hubTitle, { color: muted }]}>YOUR CREWS</Text>
        <TouchableOpacity onPress={() => setCreateOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Feather name="plus-circle" size={14} color={primary} />
          <Text style={{ color: primary, fontWeight: '900', fontSize: 11 }}>NEW</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => setCreateOpen(true)} style={[s.crewTile, { borderColor: `${primary}40`, borderStyle: 'dashed' }]}>
          <Feather name="plus" size={22} color={primary} />
          <Text style={{ color: primary, fontSize: 11, fontWeight: '800', marginTop: 6 }}>New Crew</Text>
        </TouchableOpacity>
        {crews.map(c => (
          <TouchableOpacity key={c.id} onPress={() => setDetail(c)} style={[s.crewTile, { borderColor: `${c.color || primary}55`, backgroundColor: `${c.color || primary}12` }]}>
            <View style={[s.crewIconSm, { backgroundColor: `${c.color || primary}22`, borderColor: c.color || primary }]}>
              <MaterialCommunityIcons name={c.icon || 'account-group'} size={20} color={c.color || primary} />
            </View>
            <Text style={{ color: text, fontSize: 11, fontWeight: '800', marginTop: 6, textAlign: 'center' }} numberOfLines={1}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <CreateCrewModal visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={(crew) => { refresh(); setDetail(crew); }} />
      <CrewDetailModal visible={!!detail} crew={detail} onClose={() => setDetail(null)} onChanged={refresh} />
    </View>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, padding: 18, paddingBottom: 28 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  previewBubble: { width: 64, height: 64, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 14 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  iconCell: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  colorCell: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  cta: { marginTop: 16, borderRadius: 26, paddingVertical: 15, alignItems: 'center' },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 15 },
  crewIconSm: { width: 40, height: 40, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  personAvatar: { width: 36, height: 36, borderRadius: 18 },
  personName: { flex: 1, fontSize: 13, fontWeight: '700' },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  inviteBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 16, borderWidth: 1 },
  smBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hubTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  crewTile: { width: 96, height: 96, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
});
