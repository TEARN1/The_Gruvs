/**
 * PersonalPlannerModal
 *
 * Shows the AI-generated personal event calendar for the signed-in user.
 * Tabs: This Week / This Month / This Year
 * Each tab has:
 *   - AI narrative plan (from planPersonalCalendar)
 *   - Chronological list of matched event occurrences
 *   - Tap any event to navigate to its detail
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { planPersonalCalendar } from '../services/claudeService';

const TABS = [
  { key: 'week',  label: 'This Week',  icon: 'calendar' },
  { key: 'month', label: 'This Month', icon: 'layers' },
  { key: 'year',  label: 'This Year',  icon: 'globe' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatOccurrenceDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0 && diff > -2) return 'Yesterday';
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function groupByDate(events) {
  const groups = {};
  events.forEach(e => {
    const key = e.occurrence_date || e.event_date || '';
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function sourceColor(source, primary) {
  if (source === 'my_rsvp') return '#10b981';
  if (source === 'routed')  return primary;
  return '#6366f1';
}

function RecurrencePill({ event, primary }) {
  if (!event.is_recurring) return null;
  const label =
    event.recurrence_type === 'weekly'   ? 'Weekly' :
    event.recurrence_type === 'monthly'  ? 'Monthly' :
    event.recurrence_type === 'annually' ? 'Annual' :
    event.recurrence_type === 'custom'   ? 'Series' : 'Recurring';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: `${primary}20`, marginLeft: 6 }}>
      <Feather name="repeat" size={9} color={primary} />
      <Text style={{ color: primary, fontSize: 9, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

export const PersonalPlannerModal = ({ visible, onClose, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('week');
  const [loading, setLoading]     = useState(false);
  const [planText, setPlanText]   = useState('');
  const [events, setEvents]       = useState([]);
  const [showPlan, setShowPlan]   = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const card      = currentTheme?.card       || 'rgba(255,255,255,0.05)';

  const load = useCallback(async (tab) => {
    if (!user?.id) return;
    setLoading(true);
    setPlanText('');
    setEvents([]);
    fadeAnim.setValue(0);
    try {
      const result = await planPersonalCalendar({ userId: user.id, timeframe: tab });
      setPlanText(result.plan || '');
      setEvents(result.events || []);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch {
      setPlanText('Could not load your plan right now. Try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible) load(activeTab);
  }, [visible, activeTab]);

  const grouped = groupByDate(events);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}25` }]}>

          {/* Handle */}
          <View style={[s.pill, { backgroundColor: `${primary}50` }]} />

          {/* Header */}
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: primary }]}>YOUR VIBE PLAN</Text>
              <Text style={{ color: muted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                Personalised events matched to your signals
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {TABS.map(t => {
              const active = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => { setActiveTab(t.key); }}
                  style={[s.tab, { borderColor: active ? primary : `${primary}25`, backgroundColor: active ? `${primary}18` : 'transparent' }]}
                >
                  <Feather name={t.icon} size={12} color={active ? primary : muted} />
                  <Text style={{ color: active ? primary : muted, fontWeight: '800', fontSize: 11, marginLeft: 4 }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Body */}
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator color={primary} size="large" />
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Reading your signals...</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Animated.View style={{ opacity: fadeAnim }}>

                {/* AI Narrative plan */}
                {!!planText && (
                  <View style={[s.planCard, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]}>
                    <TouchableOpacity
                      onPress={() => setShowPlan(v => !v)}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPlan ? 10 : 0 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <Text style={{ fontSize: 14 }}>✦</Text>
                        <Text style={{ color: primary, fontWeight: '900', fontSize: 12 }}>AI CONCIERGE PLAN</Text>
                      </View>
                      <Feather name={showPlan ? 'chevron-up' : 'chevron-down'} size={14} color={muted} />
                    </TouchableOpacity>
                    {showPlan && (
                      <Text style={{ color: textColor, fontSize: 13, lineHeight: 20 }}>{planText}</Text>
                    )}
                  </View>
                )}

                {/* Event groups */}
                {grouped.length === 0 && !loading && (
                  <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                    <Feather name="calendar" size={32} color={`${primary}40`} />
                    <Text style={{ color: muted, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                      No events matched for {TABS.find(t => t.key === activeTab)?.label?.toLowerCase()}.{'\n'}
                      The more you engage, the better this gets.
                    </Text>
                  </View>
                )}

                {grouped.map(([dateKey, evs]) => (
                  <View key={dateKey} style={{ marginBottom: 4 }}>
                    {/* Date header */}
                    <View style={[s.dateHeader, { borderColor: `${primary}15` }]}>
                      <View style={[s.dateDot, { backgroundColor: primary }]} />
                      <Text style={{ color: primary, fontWeight: '900', fontSize: 11, letterSpacing: 0.5 }}>
                        {formatOccurrenceDate(dateKey).toUpperCase()}
                      </Text>
                    </View>

                    {evs.map((e, idx) => {
                      const src    = e._source || 'feed';
                      const srcCol = sourceColor(src, primary);
                      return (
                        <TouchableOpacity
                          key={`${e.id}:${idx}`}
                          onPress={() => { onNavigateToEvent?.(e); onClose(); }}
                          activeOpacity={0.82}
                          style={[s.eventRow, { backgroundColor: card, borderColor: `${srcCol}20` }]}
                        >
                          {/* Left accent */}
                          <View style={{ width: 3, borderRadius: 2, backgroundColor: srcCol, alignSelf: 'stretch' }} />

                          <View style={{ flex: 1, paddingLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Text style={{ color: textColor, fontWeight: '800', fontSize: 13, flex: 1 }} numberOfLines={1}>
                                {e.title}
                              </Text>
                              <RecurrencePill event={e} primary={primary} />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                              {!!e.event_time && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <Feather name="clock" size={10} color={muted} />
                                  <Text style={{ color: muted, fontSize: 11 }}>{e.event_time}</Text>
                                </View>
                              )}
                              {!!e.city && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <Feather name="map-pin" size={10} color={muted} />
                                  <Text style={{ color: muted, fontSize: 11 }}>{e.city}</Text>
                                </View>
                              )}
                              {e.price_min != null && (
                                <Text style={{ color: e.price_min === 0 ? '#10b981' : muted, fontSize: 11, fontWeight: '700' }}>
                                  {e.price_min === 0 ? 'Free' : `R${e.price_min}`}
                                </Text>
                              )}
                            </View>

                            {!!e._reason && (
                              <Text style={{ color: srcCol, fontSize: 10, fontWeight: '700', marginTop: 3 }} numberOfLines={1}>
                                {src === 'my_rsvp' ? '✅ ' : '✦ '}{e._reason}
                              </Text>
                            )}
                          </View>

                          <Feather name="chevron-right" size={14} color={muted} style={{ alignSelf: 'center', marginLeft: 4 }} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}

                <View style={{ height: 32 }} />
              </Animated.View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  sheet:      { height: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingTop: 10, paddingHorizontal: 0, overflow: 'hidden' },
  pill:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  headerRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 14 },
  title:      { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  tabRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  tab:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  planCard:   { marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: 16, borderWidth: 1 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1 },
  dateDot:    { width: 6, height: 6, borderRadius: 3 },
  eventRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 6, borderRadius: 14, borderWidth: 1, padding: 12, overflow: 'hidden' },
});

export default PersonalPlannerModal;
