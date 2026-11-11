/**
 * MapReportSheet — "add to the map". A user picks one of the typed contributions
 * (constants/mapContributions.js), adds an optional one-line note, and drops it
 * at their spot. Text-only, fast: the whole point is that the people actually
 * there keep the map true. Purely presentational — the parent owns the location
 * and the write (MapReports.create).
 */
import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { MAP_REPORT_GROUPS, MAP_REPORT_BY_KEY } from '../constants/mapContributions';
import { useTheme } from '../context/ThemeContext';

export function MapReportSheet({ visible, onClose, onSubmit }) {
  const { currentTheme } = useTheme();
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';
  const surface = currentTheme?.surface || '#141a1c';
  const primary = currentTheme?.primary || '#00f2ff';

  const [kind, setKind] = useState(null);
  const [note, setNote] = useState('');
  const [trafficDensity, setTrafficDensity] = useState(null);
  const [detourHint, setDetourHint] = useState('');
  const [pointsman, setPointsman] = useState(null);
  const [saving, setSaving] = useState(false);

  const chosen = kind ? MAP_REPORT_BY_KEY[kind] : null;
  const isTransportClosure = chosen && (
    chosen.group === 'Transport' ||
    ['funeral_closure', 'marathon_route', 'accident', 'dead_robots', 'road_closed', 'heavy_traffic', 'detour', 'street_bash'].includes(chosen.key)
  );

  const submit = async () => {
    if (!kind || saving) return;
    setSaving(true);
    let fullNote = note.trim();
    if (trafficDensity) {
      fullNote = `[TRAFFIC: ${trafficDensity}] ${fullNote}`.trim();
    }
    if (detourHint.trim()) {
      fullNote = `[DETOUR: ${detourHint.trim()}] ${fullNote}`.trim();
    }
    if (kind === 'dead_robots' && pointsman) {
      fullNote = `[POINTSMAN: ${pointsman}] ${fullNote}`.trim();
    }
    try {
      await onSubmit?.(kind, fullNote || null);
      setKind(null);
      setNote('');
      setTrafficDensity(null);
      setDetourHint('');
      setPointsman(null);
    }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={[s.header, { color: text }]}>Add to the map</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={text} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>
            Drop a live tip at your spot — the crowd confirms it. It fades on its own.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            {Object.entries(MAP_REPORT_GROUPS).map(([group, types]) => (
              <View key={group} style={{ marginBottom: 14 }}>
                <Text style={[s.group, { color: muted }]}>{group.toUpperCase()}</Text>
                <View style={s.wrap}>
                  {types.map((t) => {
                    const on = kind === t.key;
                    return (
                      <TouchableOpacity key={t.key} onPress={() => setKind(on ? null : t.key)} activeOpacity={0.8}
                        style={[s.chip, { borderColor: on ? t.color : `${t.color}40`, backgroundColor: on ? t.color : `${t.color}12` }]}>
                        <Feather name={t.icon} size={13} color={on ? '#000' : t.color} />
                        <Text style={{ color: on ? '#000' : text, fontSize: 12, fontWeight: '700' }}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          {chosen && (
            <View style={s.footer}>
              {isTransportClosure && (
                <View style={{ gap: 8, marginBottom: 4 }}>
                  <Text style={[s.group, { color: muted, marginBottom: 2 }]}>PREDICTED TRAFFIC IMPACT</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { key: 'Normal Flow', label: 'Normal' },
                      { key: 'Moderate Delay (+10m)', label: 'Moderate (+10m)' },
                      { key: 'Heavy Delay (+25m)', label: 'Heavy (+25m)' },
                      { key: 'Gridlock / Road Closed', label: 'Road closed' }
                    ].map(d => {
                      const active = trafficDensity === d.key;
                      return (
                        <TouchableOpacity
                          key={d.key}
                          onPress={() => setTrafficDensity(active ? null : d.key)}
                          style={[
                            s.chip,
                            {
                              paddingVertical: 6,
                              paddingHorizontal: 9,
                              backgroundColor: active ? `${primary}25` : 'rgba(255,255,255,0.05)',
                              borderColor: active ? primary : 'rgba(255,255,255,0.12)'
                            }
                          ]}
                        >
                          <Text style={{ color: active ? primary : text, fontSize: 11, fontWeight: '800' }}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    value={detourHint}
                    onChangeText={setDetourHint}
                    placeholder="Suggest detour / alternate bypass street (optional)"
                    placeholderTextColor={muted}
                    maxLength={100}
                    style={[s.input, { color: text, borderColor: `${primary}30`, paddingVertical: 8, fontSize: 12 }]}
                  />
                  {kind === 'dead_robots' && (
                    <View style={{ gap: 6, marginTop: 4 }}>
                      <Text style={[s.group, { color: muted, marginBottom: 2 }]}>POINTSMAN AT INTERSECTION</Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {[
                          { key: 'police', label: 'Metro police' },
                          { key: 'volunteer', label: 'Volunteer pointsman' },
                          { key: 'none', label: 'Unmanned (4-way)' },
                        ].map((p) => {
                          const active = pointsman === p.key;
                          return (
                            <TouchableOpacity
                              key={p.key}
                              onPress={() => setPointsman(active ? null : p.key)}
                              style={[
                                s.chip,
                                {
                                  paddingVertical: 6,
                                  paddingHorizontal: 9,
                                  backgroundColor: active ? `${primary}25` : 'rgba(255,255,255,0.05)',
                                  borderColor: active ? primary : 'rgba(255,255,255,0.12)',
                                },
                              ]}
                            >
                              <Text style={{ color: active ? primary : text, fontSize: 11, fontWeight: '800' }}>
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                </View>
              )}

              <TextInput
                value={note} onChangeText={setNote}
                placeholder={`Add a detail (optional) — e.g. "${chosen.label} at 4th Ave"`}
                placeholderTextColor={muted} maxLength={200}
                style={[s.input, { color: text, borderColor: `${primary}30` }]}
              />
              <TouchableOpacity onPress={submit} disabled={saving} style={[s.submit, { backgroundColor: chosen.color, opacity: saving ? 0.6 : 1 }]}>
                <Feather name="map-pin" size={15} color="#000" />
                <Text style={s.submitText}>{saving ? 'Dropping…' : `Drop "${chosen.label}"`}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 16 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { fontSize: 18, fontWeight: '900' },
  group: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5 },
  footer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  submitText: { color: '#000', fontWeight: '900', fontSize: 14 },
});

export default MapReportSheet;
