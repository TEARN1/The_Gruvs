/**
 * InviteByNameModal — invite people who share your name, surname or clan name.
 * The host's identity (first_name / surname / clan_name) drives the search;
 * selected people get an event-invite notification. Zero cost, no API.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { InviteManager } from '../services/dataFlow';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';

const TABS = [
  { key: 'firstName', label: 'Same name', icon: 'user' },
  { key: 'surname',   label: 'Same surname', icon: 'users' },
  { key: 'clan',      label: 'Same clan', icon: 'award' },
];

export const InviteByNameModal = ({ visible, onClose, event }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState({ firstName: [], surname: [], clan: [] });
  const [terms, setTerms] = useState({});
  const [tab, setTab] = useState('firstName');
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);

  useBackClose(visible, onClose);

  useEffect(() => {
    if (!visible || !user?.id) return;
    setLoading(true);
    setSelected(new Set());
    InviteManager.findKin(user.id).then(({ groups: g, terms: t }) => {
      setGroups(g); setTerms(t);
      // Land on the first tab that actually has people.
      const firstWith = TABS.find(x => (g[x.key] || []).length > 0);
      if (firstWith) setTab(firstWith.key);
    }).finally(() => setLoading(false));
  }, [visible, user?.id]);

  const list = groups[tab] || [];

  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAllInTab = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = list.every(p => next.has(p.id));
      list.forEach(p => { allSelected ? next.delete(p.id) : next.add(p.id); });
      return next;
    });
  }, [list]);

  const handleSend = async () => {
    if (selected.size === 0 || !event?.id) return;
    setSending(true);
    try {
      const hostName = user?.user_metadata?.username || terms.firstName || 'A host';
      const n = await InviteManager.inviteToEvent(event.id, event.title, [...selected], user?.id, hostName);
      toast?.show?.(n > 0 ? `Invited ${n} ${n === 1 ? 'person' : 'people'} 🎉` : 'Could not send invites.', n > 0 ? 'success' : 'error');
      if (n > 0) onClose?.();
    } catch (e) {
      toast?.show?.(e?.message || 'Could not send invites.', 'error');
    } finally {
      setSending(false);
    }
  };

  const hasAnyKin = (groups.firstName.length + groups.surname.length + groups.clan.length) > 0;
  const noIdentity = !terms.firstName && !terms.surname && !terms.clan;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={[s.pill, { backgroundColor: `${primary}50` }]} />
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: primary }]}>Invite your people</Text>
              <Text style={[s.sub, { color: muted }]} numberOfLines={1}>
                Share {event?.title || 'this event'} with people who share your name
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {TABS.map(t => {
              const count = (groups[t.key] || []).length;
              const active = tab === t.key;
              const term = terms[t.key];
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[s.tab, { borderColor: active ? primary : `${primary}25`, backgroundColor: active ? `${primary}18` : 'transparent' }]}
                >
                  <Feather name={t.icon} size={13} color={active ? primary : muted} />
                  <Text style={[s.tabText, { color: active ? primary : muted }]} numberOfLines={1}>{t.label}</Text>
                  <Text style={[s.tabCount, { color: active ? primary : muted }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!!terms[tab] && (
            <Text style={[s.termLine, { color: muted }]}>
              Matching “<Text style={{ color: textColor, fontWeight: '800' }}>{terms[tab]}</Text>”
            </Text>
          )}

          {loading ? (
            <ActivityIndicator color={primary} style={{ marginVertical: 40 }} />
          ) : noIdentity ? (
            <View style={s.empty}>
              <Feather name="user-x" size={28} color={muted} />
              <Text style={[s.emptyText, { color: muted }]}>
                Add your name, surname and clan name in your profile first — then you can invite people who share them.
              </Text>
            </View>
          ) : !hasAnyKin ? (
            <View style={s.empty}>
              <Feather name="search" size={28} color={muted} />
              <Text style={[s.emptyText, { color: muted }]}>
                Nobody on The Gruvs shares your name, surname or clan yet. As more people join, they’ll show up here.
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={selectAllInTab} style={s.selectAll} disabled={list.length === 0}>
                <Text style={[s.selectAllText, { color: list.length ? primary : muted }]}>
                  {list.every(p => selected.has(p.id)) && list.length ? 'Deselect all' : 'Select all'}
                </Text>
              </TouchableOpacity>
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {list.length === 0 ? (
                  <Text style={[s.emptyText, { color: muted, paddingVertical: 24 }]}>No one in this group yet.</Text>
                ) : list.map(p => {
                  const sel = selected.has(p.id);
                  return (
                    <TouchableOpacity key={p.id} onPress={() => toggle(p.id)} activeOpacity={0.8}
                      style={[s.row, { borderColor: sel ? primary : `${primary}15`, backgroundColor: sel ? `${primary}12` : 'transparent' }]}>
                      {p.avatar_url
                        ? <Image source={{ uri: p.avatar_url }} style={s.avatar} />
                        : <View style={[s.avatar, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ color: primary, fontWeight: '900' }}>{(p.username || '?').slice(0, 1).toUpperCase()}</Text>
                          </View>}
                      <View style={{ flex: 1 }}>
                        <Text style={[s.name, { color: textColor }]} numberOfLines={1}>{p.display_name || p.username || 'Viber'}</Text>
                        <Text style={[s.handle, { color: muted }]} numberOfLines={1}>
                          @{p.username || 'viber'}{p.clan_name ? ` · ${p.clan_name}` : ''}
                        </Text>
                      </View>
                      <View style={[s.check, { borderColor: sel ? primary : `${primary}40`, backgroundColor: sel ? primary : 'transparent' }]}>
                        {sel && <Feather name="check" size={13} color="#000" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {hasAnyKin && (
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: selected.size ? primary : `${primary}25` }]}
              onPress={handleSend}
              disabled={selected.size === 0 || sending}
            >
              {sending
                ? <ActivityIndicator color="#000" />
                : <Text style={[s.sendText, { color: selected.size ? '#000' : muted }]}>
                    {selected.size ? `Invite ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : 'Select people to invite'}
                  </Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '90%' },
  pill: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  tabText: { fontSize: 11, fontWeight: '800' },
  tabCount: { fontSize: 11, fontWeight: '900' },
  termLine: { fontSize: 11, marginBottom: 8, marginLeft: 2 },
  selectAll: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  selectAllText: { fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  name: { fontSize: 14, fontWeight: '800' },
  handle: { fontSize: 11, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 36, paddingHorizontal: 24 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  sendBtn: { marginTop: 14, paddingVertical: 15, borderRadius: 30, alignItems: 'center' },
  sendText: { fontWeight: '900', fontSize: 15 },
});

export default InviteByNameModal;
