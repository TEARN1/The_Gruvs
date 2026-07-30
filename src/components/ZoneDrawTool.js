/**
 * ZoneDrawTool — the host's "mark the impact" control panel.
 *
 * Pick which of your events this affects, choose a type (road closure / route /
 * area), trace it on the map (parent feeds the tapped points), set the time
 * window, and publish. Publishing is host-gated server-side (zone_create), so
 * this only offers events you actually host.
 *
 * The drawing itself happens on the map (parent owns `points`/`mode`); this is
 * the bottom-sheet controller + submit.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { MapZones, ZONE_KINDS } from '../services/mapZones';
import { buildGeometry } from './LiveMap';

const DURATIONS = [
  { label: 'Now', hrs: 0 }, { label: 'In 1h', hrs: 1 },
  { label: 'In 2h', hrs: 2 }, { label: 'In 4h', hrs: 4 },
];

const ACTIVE_FOR = [
  { label: '2h', hrs: 2 }, { label: '4h', hrs: 4 },
  { label: '8h', hrs: 8 }, { label: '14h', hrs: 14 },
];

// Which kinds are drawn as a line vs an area — sets the draw mode.
const modeFor = (kind) => (ZONE_KINDS[kind]?.line ? 'line' : 'polygon');

export function ZoneDrawTool({
  points = [], mode, onSetMode, onUndo, onClear, onCancel, onPublished,
  primary = '#00f2ff', bg = '#0d1112', textColor = '#fff', muted = 'rgba(255,255,255,0.55)',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [myEvents, setMyEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [kind, setKind] = useState('road_closed');
  const [startHrs, setStartHrs] = useState(0);
  const [activeHrs, setActiveHrs] = useState(4);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [detourPoints, setDetourPoints] = useState([]);
  const [drawingDetour, setDrawingDetour] = useState(false);

  // The events you host that you can attach a closure to (upcoming, recent-past ok).
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('id, title, event_date')
          .eq('author_id', user.id)
          .order('event_date', { ascending: false })
          .limit(25);
        setMyEvents(data || []);
        if ((data || []).length === 1) setEventId(data[0].id);
      } catch { setMyEvents([]); }
    })();
  }, [user?.id]);

  // Keep the draw mode in sync with the chosen kind.
  useEffect(() => { onSetMode?.(modeFor(kind)); }, [kind, onSetMode]);

  const minPoints = mode === 'polygon' ? 3 : 2;
  const canPublish = eventId && points.length >= minPoints && !busy;

  const publish = useCallback(async () => {
    if (!eventId) { toast('Pick which of your events this is for.', 'error'); return; }
    const geometry = buildGeometry(mode, points);
    if (!geometry) { toast(`Tap at least ${minPoints} points on the map.`, 'error'); return; }
    setBusy(true);
    try {
      const startsAt = new Date(Date.now() + startHrs * 3600 * 1000);
      const endsAt = new Date(startsAt.getTime() + activeHrs * 3600 * 1000);
      const zone = await MapZones.create({
        eventId, kind, geometry, startsAt, endsAt,
        label: label.trim() || ZONE_KINDS[kind]?.label,
      });
      toast('Marked on the map — locals can see it now.', 'success');
      onPublished?.(zone);
    } catch (e) {
      toast(e?.message || 'Could not publish that.', 'error');
    } finally { setBusy(false); }
  }, [eventId, mode, points, hrs, kind, label, minPoints, toast, onPublished]);

  return (
    <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
      <View style={s.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="edit-3" size={16} color={primary} />
          <Text style={[s.title, { color: textColor }]}>Mark the impact</Text>
        </View>
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={20} color={muted} />
        </TouchableOpacity>
      </View>

      {myEvents.length === 0 ? (
        <Text style={[s.hint, { color: muted }]}>
          You need to be hosting an event to mark its impact. Post an event first, then come back.
        </Text>
      ) : (
        <>
          {/* Which event */}
          <Text style={[s.lbl, { color: muted }]}>FOR WHICH EVENT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
            {myEvents.map((e) => (
              <TouchableOpacity key={e.id} onPress={() => setEventId(e.id)}
                style={[s.chip, { borderColor: eventId === e.id ? primary : `${primary}30`, backgroundColor: eventId === e.id ? `${primary}18` : 'transparent' }]}>
                <Text style={{ color: eventId === e.id ? primary : textColor, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{e.title || 'Event'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Kind */}
          <Text style={[s.lbl, { color: muted }]}>TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {Object.entries(ZONE_KINDS).filter(([k]) => k !== 'alert').map(([k, v]) => (
              <TouchableOpacity key={k} onPress={() => setKind(k)}
                style={[s.kindChip, { borderColor: kind === k ? v.color : `${v.color}44`, backgroundColor: kind === k ? `${v.color}22` : 'transparent' }]}>
                <Feather name={v.icon} size={12} color={v.color} />
                <Text style={{ color: kind === k ? v.color : textColor, fontSize: 12, fontWeight: '700' }}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Draw guidance + point tools */}
          <View style={[s.drawRow, { borderColor: `${primary}22` }]}>
            <Text style={{ color: muted, fontSize: 12, flex: 1 }}>
              {mode === 'polygon'
                ? `Tap the map to outline the area (${points.length} point${points.length === 1 ? '' : 's'})`
                : `Tap along the road to trace it (${points.length} point${points.length === 1 ? '' : 's'})`}
            </Text>
            <TouchableOpacity onPress={onUndo} disabled={!points.length} style={s.miniBtn}>
              <Feather name="corner-up-left" size={14} color={points.length ? primary : muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClear} disabled={!points.length} style={s.miniBtn}>
              <Feather name="trash-2" size={14} color={points.length ? '#ef4444' : muted} />
            </TouchableOpacity>
          </View>

          {/* Time window */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.lbl, { color: muted }]}>STARTS</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity key={d.hrs} onPress={() => setStartHrs(d.hrs)}
                    style={[s.durChip, { flex: 1, borderColor: startHrs === d.hrs ? primary : `${primary}30`, backgroundColor: startHrs === d.hrs ? `${primary}18` : 'transparent' }]}>
                    <Text style={{ color: startHrs === d.hrs ? primary : textColor, fontSize: 10, fontWeight: '800' }}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.lbl, { color: muted }]}>DURATION</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {ACTIVE_FOR.map((d) => (
                  <TouchableOpacity key={d.hrs} onPress={() => setActiveHrs(d.hrs)}
                    style={[s.durChip, { flex: 1, borderColor: activeHrs === d.hrs ? primary : `${primary}30`, backgroundColor: activeHrs === d.hrs ? `${primary}18` : 'transparent' }]}>
                    <Text style={{ color: activeHrs === d.hrs ? primary : textColor, fontSize: 10, fontWeight: '800' }}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Optional label */}
          <TextInput
            value={label} onChangeText={setLabel} maxLength={80}
            placeholder="Add a note (optional) — e.g. 'stage build-down'" placeholderTextColor={muted}
            style={[s.input, { color: textColor, borderColor: `${primary}30` }]}
          />

          {kind === 'road_closed' && (
            <TouchableOpacity
              onPress={() => setDrawingDetour(!drawingDetour)}
              style={[s.detourBtn, { borderColor: drawingDetour ? primary : `${primary}30`, backgroundColor: drawingDetour ? `${primary}18` : 'transparent' }]}
            >
              <Feather name="corner-up-right" size={14} color={primary} />
              <Text style={{ color: primary, fontSize: 12, fontWeight: '800' }}>
                {detourPoints.length > 0 ? `Detour set (${detourPoints.length} pts)` : drawingDetour ? 'Tap map to draw detour' : 'Add suggested detour'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={publish} disabled={!canPublish}
            style={[s.publish, { backgroundColor: canPublish ? primary : `${primary}35` }]}>
            {busy ? <ActivityIndicator color="#000" /> : (
              <Text style={s.publishText}>Publish to the map</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 16, paddingBottom: 24, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '900' },
  hint: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  lbl: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 180 },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 },
  drawRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 6 },
  miniBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  durChip: { borderWidth: 1, borderRadius: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginTop: 4 },
  publish: { borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  publishText: { color: '#000', fontWeight: '900', fontSize: 15 },
  detourBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 4 },
});
