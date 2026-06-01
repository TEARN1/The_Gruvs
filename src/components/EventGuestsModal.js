/**
 * EventGuestsModal — the organizer tags the guests/players who'll be at an event.
 *
 * Search an existing player or create a new one on the fly, pick a role and a
 * team side. Each tagged player gets an appearance that rolls up to their career,
 * and shows on the event's guest list (and their profile history).
 * Backed by TalentEngine.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  Image, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { GlassView } from './GlassView';
import { haptics } from '../utils/haptics';
import { TalentEngine } from '../services/talentEngine';

const ROLES = ['player', 'performer', 'guest', 'coach', 'judge'];
const SIDES = [
  { key: null,   label: '—' },
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
];

export const EventGuestsModal = ({ visible, eventId, sportType = null, onClose, onChanged }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [guests, setGuests]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole]       = useState('player');
  const [side, setSide]       = useState(null);
  const [adding, setAdding]   = useState(false);
  const searchTimer = useRef(null);

  const loadGuests = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setGuests(await TalentEngine.getEventGuests(eventId));
    setLoading(false);
  }, [eventId]);

  useEffect(() => { if (visible) loadGuests(); }, [visible, loadGuests]);

  // Debounced player search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      setResults(await TalentEngine.searchPlayers(query));
      setSearching(false);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const doAdd = async (guest) => {
    if (adding) return;
    if (!user) { toast.show('Sign in to manage guests', 'info'); return; }
    setAdding(true);
    haptics.medium();
    const added = await TalentEngine.addGuest({
      eventId, guest, role, teamSide: side, addedBy: user.id,
    });
    if (added) {
      setGuests(g => [...g, added]);
      setQuery(''); setResults([]);
      toast.show(`Added ${guest.full_name || guest.known_as}`, 'success');
      onChanged?.();
    } else {
      toast.show('Could not add guest', 'error');
    }
    setAdding(false);
  };

  const doRemove = async (g) => {
    haptics.light();
    setGuests(prev => prev.filter(x => x.id !== g.id));
    const ok = await TalentEngine.removeGuest(g.id);
    if (!ok) { loadGuests(); toast.show('Could not remove', 'error'); }
    else onChanged?.();
  };

  const Chip = ({ active, onPress, children }) => (
    <TouchableOpacity
      onPress={() => { haptics.select(); onPress(); }}
      style={[g.chip, { backgroundColor: active ? primary : `${primary}12`, borderColor: active ? primary : `${primary}30` }]}
    >
      <Text style={[g.chipText, { color: active ? '#000' : primary }]}>{children}</Text>
    </TouchableOpacity>
  );

  const canCreate = query.trim().length >= 2 &&
    !results.some(r => (r.full_name || '').toLowerCase() === query.trim().toLowerCase());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[g.root, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={g.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={g.headerBtn}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
            <Text style={[g.headerTitle, { color: textColor }]}>Guests & Lineup</Text>
            <View style={g.headerBtn} />
          </View>

          {/* Role + side selectors */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.chipRow}>
            {ROLES.map(r => <Chip key={r} active={role === r} onPress={() => setRole(r)}>{r[0].toUpperCase() + r.slice(1)}</Chip>)}
          </ScrollView>
          {role === 'player' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={g.chipRow}>
              {SIDES.map(s => <Chip key={s.label} active={side === s.key} onPress={() => setSide(s.key)}>{s.label === '—' ? 'No side' : s.label}</Chip>)}
            </ScrollView>
          )}

          {/* Search / create */}
          <View style={[g.searchWrap, { backgroundColor: surface, borderColor: `${primary}25` }]}>
            <Feather name="search" size={15} color={muted} />
            <TextInput
              style={[g.searchInput, { color: textColor }]}
              placeholder="Search a player, or type a new name…"
              placeholderTextColor={muted}
              value={query}
              onChangeText={setQuery}
            />
            {searching && <ActivityIndicator size="small" color={primary} />}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {/* Search results */}
            {results.map(r => (
              <TouchableOpacity key={r.id} onPress={() => doAdd(r)} activeOpacity={0.85}>
                <GlassView sheen={false} style={g.resultRow}>
                  {r.photo_url
                    ? <Image source={{ uri: r.photo_url }} style={g.avatar} />
                    : <View style={[g.avatar, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: primary, fontWeight: '900' }}>{(r.full_name || '?')[0].toUpperCase()}</Text>
                      </View>}
                  <View style={{ flex: 1 }}>
                    <Text style={[g.name, { color: textColor }]} numberOfLines={1}>{r.known_as || r.full_name}</Text>
                    <Text style={[g.sub, { color: muted }]} numberOfLines={1}>{[r.primary_position, r.sport_type].filter(Boolean).join(' · ') || 'Existing player'}</Text>
                  </View>
                  <Feather name="plus-circle" size={20} color={primary} />
                </GlassView>
              </TouchableOpacity>
            ))}

            {/* Create new */}
            {canCreate && (
              <TouchableOpacity onPress={() => doAdd({ full_name: query.trim(), sport_type: sportType })} activeOpacity={0.85} disabled={adding}>
                <GlassView sheen={false} style={[g.resultRow, { borderColor: `${primary}40` }]}>
                  <View style={[g.avatar, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                    <Feather name="user-plus" size={18} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[g.name, { color: textColor }]}>Create “{query.trim()}”</Text>
                    <Text style={[g.sub, { color: muted }]}>New player identity</Text>
                  </View>
                  {adding ? <ActivityIndicator size="small" color={primary} /> : <Feather name="plus-circle" size={20} color={primary} />}
                </GlassView>
              </TouchableOpacity>
            )}

            {/* Current guest list */}
            <Text style={[g.sectionTitle, { color: muted }]}>ON THE GUEST LIST ({guests.length})</Text>
            {loading ? (
              <ActivityIndicator color={primary} style={{ marginTop: 16 }} />
            ) : guests.length === 0 ? (
              <Text style={{ color: muted, textAlign: 'center', marginTop: 16, fontSize: 13 }}>
                No guests yet. Search above to tag the players, performers, or judges who’ll be there.
              </Text>
            ) : guests.map(gst => {
              const p = gst.player || {};
              const name = p.known_as || p.full_name || gst.guest_name || gst.profile?.username || 'Guest';
              const photo = p.photo_url || gst.profile?.avatar_url;
              return (
                <View key={gst.id} style={[g.guestRow, { borderBottomColor: `${primary}10` }]}>
                  {photo
                    ? <Image source={{ uri: photo }} style={g.avatar} />
                    : <View style={[g.avatar, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: primary, fontWeight: '900' }}>{name[0].toUpperCase()}</Text>
                      </View>}
                  <View style={{ flex: 1 }}>
                    <Text style={[g.name, { color: textColor }]} numberOfLines={1}>{name}</Text>
                    <Text style={[g.sub, { color: muted }]}>
                      {[gst.role, gst.team_side].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => doRemove(gst)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const g = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 36, paddingBottom: 8 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 6, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  name: { fontSize: 14, fontWeight: '800' },
  sub: { fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1 },
});

export default EventGuestsModal;
