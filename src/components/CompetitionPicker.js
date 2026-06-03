/**
 * CompetitionPicker — attach an event to a competition/league (or create one).
 *
 * Dropped into the event-creation form. Sets events.competition_id, which is
 * what makes tournament governance + competition-scoped predictions appear on
 * the event. Backed by TournamentEngine.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { haptics } from '../utils/haptics';
import { TournamentEngine } from '../services/tournamentEngine';

export const CompetitionPicker = ({ value, onChange, sportType = null }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || '#1a1f21';

  const [comps, setComps]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setComps(await TournamentEngine.getMyCompetitions(user?.id));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    haptics.medium();
    let comp = null;
    try {
      comp = await TournamentEngine.createCompetition({
        name: newName, sport_type: sportType, kind: 'league', organizerId: user?.id,
        seasonName: new Date().getFullYear() + '/' + String((new Date().getFullYear() + 1)).slice(2),
      });
    } finally {
      setBusy(false);
    }
    if (comp) {
      haptics.success(); toast.show(`${comp.name} created`, 'success');
      setComps(c => [comp, ...c]); setNewName(''); setCreating(false);
      onChange?.(comp.id);
    } else toast.show('Could not create competition', 'error');
  };

  if (!user) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[cp.label, { color: muted }]}>COMPETITION / LEAGUE (optional)</Text>
      <Text style={[cp.hint, { color: muted }]}>Link this event to a tournament to unlock governance & predictions.</Text>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginTop: 8 }} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => { haptics.select(); onChange?.(null); }}
            style={[cp.chip, { borderColor: !value ? primary : `${primary}30`, backgroundColor: !value ? primary : `${primary}10` }]}
          >
            <Text style={{ color: !value ? '#000' : primary, fontWeight: '800', fontSize: 12 }}>None</Text>
          </TouchableOpacity>
          {comps.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => { haptics.select(); onChange?.(c.id); }}
              style={[cp.chip, { borderColor: value === c.id ? primary : `${primary}30`, backgroundColor: value === c.id ? primary : `${primary}10` }]}
            >
              <Text style={{ color: value === c.id ? '#000' : primary, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => { haptics.select(); setCreating(v => !v); }}
            style={[cp.chip, { borderColor: `${primary}40`, borderStyle: 'dashed' }]}
          >
            <Feather name="plus" size={12} color={primary} />
            <Text style={{ color: primary, fontWeight: '800', fontSize: 12, marginLeft: 4 }}>New</Text>
          </TouchableOpacity>
        </View>
      )}

      {creating && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TextInput
            style={[cp.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
            value={newName} onChangeText={setNewName}
            placeholder="e.g. Gauteng Premier League" placeholderTextColor={muted}
          />
          <TouchableOpacity style={[cp.createBtn, { backgroundColor: primary }]} onPress={create} disabled={busy}>
            <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>{busy ? '…' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const cp = StyleSheet.create({
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  hint: { fontSize: 11 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, borderWidth: 1, maxWidth: 200 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  createBtn: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});

export default CompetitionPicker;
