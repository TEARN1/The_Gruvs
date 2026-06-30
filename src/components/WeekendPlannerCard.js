/**
 * WeekendPlannerCard — "Plan your next 5 weekends". Suggests one Gruv per
 * upcoming weekend/holiday near the user; tapping "Plan it" commits an RSVP
 * (status 'maybe'), which then shows up on the Path Map as a planned journey.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { LocationService } from '../services/locationService';
import { RSVPManager } from '../services/dataFlow';
import { suggestWeekendPlans } from '../services/weekendPlanner';

const fmtDate = (ymd) => {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const WeekendPlannerCard = ({ onEventPress }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.surface || '#131a1c';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(null); // eventId being committed

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const coords = LocationService.getCached() || (await LocationService.requestAndGet().catch(() => null));
    const s = await suggestWeekendPlans(user.id, coords, { weeks: 5, max: 5 });
    setSlots(s);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const planIt = async (ev) => {
    if (!ev?.id || !user?.id) return;
    setPlanning(ev.id);
    try {
      const ok = await RSVPManager.upsert(ev.id, user.id, 'maybe');
      if (ok !== false) {
        toast(`Planned for ${fmtDate(ev.event_date)} — added to your Path Map`, 'success');
        setSlots(prev => prev.filter(s => s.event?.id !== ev.id));
      } else {
        toast('Could not plan that one — try again.', 'error');
      }
    } catch (e) {
      toast(e?.message || 'Could not plan that one.', 'error');
    } finally { setPlanning(null); }
  };

  if (!user) return null;

  return (
    <View style={[s.card, { backgroundColor: bg, borderColor: `${primary}25` }]}>
      <View style={s.header}>
        <MaterialCommunityIcons name="calendar-star" size={18} color={primary} />
        <Text style={[s.title, { color: text }]}>Plan your next 5 weekends</Text>
      </View>
      <Text style={[s.sub, { color: muted }]}>
        A Gruv for every upcoming weekend & holiday near you. Tap “Plan it” to lock it onto your Path Map.
      </Text>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 18 }} />
      ) : slots.length === 0 ? (
        <Text style={[s.empty, { color: muted }]}>No upcoming weekends to plan yet — check back soon.</Text>
      ) : (
        slots.map((slot) => (
          <View key={slot.date} style={[s.row, { borderTopColor: `${primary}12` }]}>
            <View style={[s.dateChip, { backgroundColor: `${primary}14`, borderColor: `${primary}30` }]}>
              <Text style={[s.dateChipDay, { color: primary }]}>{fmtDate(slot.date)}</Text>
              <Text style={[s.dateChipLabel, { color: muted }]} numberOfLines={1}>{slot.label}</Text>
            </View>

            {slot.event ? (
              <>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => onEventPress?.(slot.event)}>
                  <Text style={[s.evTitle, { color: text }]} numberOfLines={1}>{slot.event.title}</Text>
                  <Text style={[s.evMeta, { color: muted }]} numberOfLines={1}>
                    {slot.event.venue_name || slot.event.city || 'Nearby'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => planIt(slot.event)}
                  disabled={planning === slot.event.id}
                  style={[s.planBtn, { backgroundColor: primary }]}
                >
                  {planning === slot.event.id
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={s.planBtnText}>Plan it</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={[s.evMeta, { color: muted }]}>Nothing on yet — be the one to post a Gruv.</Text>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginHorizontal: 14, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 12, lineHeight: 16, marginBottom: 8 },
  empty: { fontSize: 12, paddingVertical: 14, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  dateChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, borderWidth: 1, minWidth: 84 },
  dateChipDay: { fontSize: 11, fontWeight: '900' },
  dateChipLabel: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  evTitle: { fontSize: 13, fontWeight: '800' },
  evMeta: { fontSize: 11, marginTop: 2 },
  planBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },
});

export default WeekendPlannerCard;
