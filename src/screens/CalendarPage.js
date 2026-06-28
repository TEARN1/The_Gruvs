import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Image, Animated, RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { FadeInView } from '../components/FadeInView';
import { AuraEffect } from '../components/AuraEffect';
import { LiquidBackground } from '../components/LiquidBackground';
import { BrandLogo } from '../components/BrandLogo';
import { CalendarManager, FeedManager } from '../services/dataFlow';
import { resilientRead } from '../utils/resilience';
import { PostEventModal } from '../components/PostEventModal';
import { getCategoryColor, CATEGORY_CONFIG } from '../constants/CategoryConfig';
import { supabase } from '../services/supabase';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SmartImage } from '../components/SmartImage';
import { LineupRail } from '../components/LineupRail';

const { width } = Dimensions.get('window');
const CELL = Math.floor((width - 32) / 7);
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_SHORT = ['S','M','T','W','T','F','S'];
const DAY_FULL  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Universal event-category filter — EVERY category, equal footing. The Gruvs is
// a networking platform for ALL events (music, nightlife, comedy, art, tech,
// food, fashion, faith, sport, …), not a sports app. Sport is just one chip.
const CATEGORY_FILTERS = [
  { key: null, label: '✦ All' },
  ...Object.keys(CATEGORY_CONFIG)
    .filter((k) => k !== 'all')
    .map((k) => ({ key: k, label: `${CATEGORY_CONFIG[k].icon} ${CATEGORY_CONFIG[k].label}` })),
];
const eventInCategory = (ev, key) =>
  !key || ev.category === key || (Array.isArray(ev.categories) && ev.categories.includes(key));

const today = new Date();
const pad2 = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

// Short date label for cross-date search results, e.g. "Mon 1 Jun".
const shortDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return `${DAY_FULL[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
};

// ── Relevance scorer ──────────────────────────────────────────────────────────
// Ranks a search hit by WHERE the query tokens land (title > venue/city >
// category > host > description), boosts exact/prefix/word-boundary matches,
// nudges imminent + popular events up, and demotes (but keeps) partial matches
// so a typo or extra word still surfaces something useful.
const scoreEvent = (ev, tokens) => {
  const title = (ev.title || '').toLowerCase();
  const venue = (ev.venue_name || '').toLowerCase();
  const city  = (ev.city || '').toLowerCase();
  const cat   = (ev.category || '').toLowerCase();
  const sport = (ev.sport_type || '').toLowerCase();
  const host  = (ev.profiles?.username || ev.host_name || ev.organizer_name || '').toLowerCase();
  const desc  = (ev.description || '').toLowerCase();
  const hay   = `${title} ${venue} ${city} ${cat} ${sport} ${host} ${desc}`;

  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (title === t) score += 100;
    else if (title.startsWith(t)) score += 60;
    else if (title.includes(t)) score += 38;
    if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) score += 14;
    if (venue.includes(t)) score += 18;
    if (city.includes(t))  score += 16;
    if (cat.includes(t))   score += 14;
    if (sport.includes(t)) score += 14;
    if (host.includes(t))  score += 12;
    if (desc.includes(t))  score += 6;
  }
  // AND semantics: every token should appear somewhere, else demote (typo-tolerant).
  if (!tokens.every(t => hay.includes(t))) score *= 0.15;
  // Imminent upcoming events rank a touch higher.
  if (ev.event_date) {
    const days = (new Date(ev.event_date) - Date.now()) / 86400000;
    if (days >= -1) score += Math.max(0, 12 - Math.max(0, days) * 0.2);
  }
  // Popularity tiebreaker.
  score += Math.min(8, (ev.vibe_count || 0) * 0.5);
  return score;
};

// ── Week strip ────────────────────────────────────────────────────────────────
const WeekStrip = ({ selectedDate, onSelect, primary, bg, textColor, muted, eventDots }) => {
  const scrollRef = useRef(null);
  const days = useMemo(() => {
    const arr = [];
    // 3 weeks centred on today
    for (let i = -10; i <= 10; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  useEffect(() => {
    // Scroll so today is visible (index 10)
    setTimeout(() => scrollRef.current?.scrollTo({ x: 10 * (CELL + 8), animated: false }), 100);
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
    >
      {days.map((d, i) => {
        const key = dateKey(d);
        const isSelected = key === dateKey(selectedDate);
        const isToday = key === dateKey(today);
        const hasDot = !!eventDots[key];
        const DAY_NAMES_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const cellLabel = [
          DAY_NAMES_FULL[d.getDay()],
          FULL_MONTH[d.getMonth()],
          d.getDate(),
          isToday ? ', today' : '',
          hasDot ? ', has events' : '',
        ].join('');
        return (
          <TouchableOpacity
            key={i}
            style={[
              ws.cell,
              isSelected && { backgroundColor: primary },
              !isSelected && isToday && { borderColor: primary, borderWidth: 1.5 },
            ]}
            onPress={() => onSelect(d)}
            accessibilityLabel={cellLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[ws.dow, { color: isSelected ? '#000' : muted }]}>
              {DAY_SHORT[d.getDay()]}
            </Text>
            <Text style={[ws.num, { color: isSelected ? '#000' : isToday ? primary : textColor }]}>
              {d.getDate()}
            </Text>
            {hasDot && (
              <View style={[ws.dot, { backgroundColor: isSelected ? '#000' : primary }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const ws = StyleSheet.create({
  cell: { width: CELL, height: CELL + 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  dow: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  num: { fontSize: 16, fontWeight: '900' },
  dot: { width: 4, height: 4, borderRadius: 2 },
});

// ── Month grid ────────────────────────────────────────────────────────────────
const MonthGrid = ({ year, month, selectedDate, onSelect, primary, textColor, muted, eventDots }) => {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <View>
      {/* Day header */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_SHORT.map((d, i) => (
          <Text key={i} style={[mg.dayName, { color: muted, width: '14.285%' }]}>{d}</Text>
        ))}
      </View>
      {/* Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: firstDow }).map((_, i) => (
          <View key={`e${i}`} style={{ width: '14.285%', height: 44 }} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(year, month, day);
          const key = dateKey(d);
          const isSel   = key === dateKey(selectedDate);
          const isToday = key === dateKey(today);
          const hasDot  = !!eventDots[key];
          return (
            <TouchableOpacity
              key={day}
              style={[mg.cell, { width: '14.285%', height: 44 }]}
              onPress={() => onSelect(d)}
            >
              <View style={[
                mg.innerCircle,
                isSel && { backgroundColor: primary },
                !isSel && isToday && { borderWidth: 1.5, borderColor: primary },
              ]}>
                <Text style={[mg.num, { color: isSel ? '#000' : isToday ? primary : textColor }]}>
                  {day}
                </Text>
                {hasDot && <View style={[mg.dot, { backgroundColor: isSel ? '#000' : primary }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const mg = StyleSheet.create({
  dayName: { textAlign: 'center', fontSize: 10, fontWeight: '800' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  innerCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  num: { fontSize: 13, fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 3 },
});

// ── Event card for calendar ────────────────────────────────────────────────────
const CalEventCard = ({ ev, primary, textColor, muted, onPress, index, showDate }) => {
  const catColor = ev.category_color || getCategoryColor(ev.category) || primary;
  const thumb = ev.media?.[0]?.url || ev.media?.[0] || null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = ev.event_date && new Date(ev.event_date).getTime() < today.getTime();

  return (
    <FadeInView delay={index * 60} direction="up">
      <TouchableOpacity
        style={[ec.wrap, { borderColor: `${catColor}30`, backgroundColor: `${catColor}08`, opacity: isPast ? 0.55 : 1 }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Colour accent */}
        <View style={[ec.accent, { backgroundColor: isPast ? '#9ca3af' : catColor }]} />

        {/* Thumbnail */}
        {thumb ? (
          <Image source={{ uri: typeof thumb === 'string' ? thumb : thumb }} style={ec.thumb} />
        ) : (
          <View style={[ec.thumbPlaceholder, { backgroundColor: `${catColor}20` }]}>
            <Feather name="image" size={20} color={`${catColor}60`} />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={[ec.title, { color: textColor }]} numberOfLines={2}>{ev.title}</Text>
          <View style={ec.metaRow}>
            {showDate && ev.event_date ? (
              <View style={ec.metaItem}>
                <Feather name="calendar" size={11} color={primary} />
                <Text style={[ec.metaText, { color: primary, fontWeight: '800' }]}>{shortDate(ev.event_date)}</Text>
              </View>
            ) : null}
            {ev.event_time ? (
              <View style={ec.metaItem}>
                <Feather name="clock" size={11} color={muted} />
                <Text style={[ec.metaText, { color: muted }]}>{ev.event_time}</Text>
              </View>
            ) : null}
            {ev.venue_name ? (
              <View style={ec.metaItem}>
                <Feather name="map-pin" size={11} color={muted} />
                <Text style={[ec.metaText, { color: muted }]} numberOfLines={1}>{ev.venue_name}</Text>
              </View>
            ) : null}
          </View>
          <View style={ec.footer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {ev.category ? (
                <View style={[ec.catBadge, { backgroundColor: `${catColor}20` }]}>
                  <Text style={[ec.catText, { color: catColor }]}>
                    {(CATEGORY_CONFIG[ev.category]?.label || ev.category).toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {isPast ? (
                <View style={[ec.catBadge, { backgroundColor: '#4b556350', marginLeft: 6 }]}>
                  <Text style={[ec.catText, { color: '#9ca3af' }]}>PASSED</Text>
                </View>
              ) : null}
            </View>
            <View style={ec.statsRow}>
              <Feather name="zap" size={11} color={primary} />
              <Text style={[ec.statsText, { color: primary }]}>{ev.vibe_count || ev.going || 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </FadeInView>
  );
};

const ec = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: 1, borderRadius: 18, marginBottom: 12, overflow: 'hidden', gap: 12, padding: 12 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbPlaceholder: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 6, lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsText: { fontSize: 12, fontWeight: '800' },
});

// ── Month stats banner ────────────────────────────────────────────────────────
const MonthStats = ({ events, primary, muted }) => {
  const total   = events.length;
  const going   = events.reduce((s, e) => s + (e.going || 0), 0);
  const cats    = [...new Set(events.map(e => e.category).filter(Boolean))].length;
  const hasFree = events.some(e => !e.price || e.price === 0 || e.price === 'FREE');

  return (
    <View style={ms.row}>
      {[
        { icon: 'calendar', label: 'Gruvs',   value: total  },
        { icon: 'zap',      label: 'Locked In', value: going  },
        { icon: 'grid',     label: 'Vibes',   value: cats   },
        { icon: 'tag',      label: 'Free',    value: hasFree ? 'Yes' : 'No' },
      ].map(s => (
        <View key={s.label} style={ms.item}>
          <Feather name={s.icon} size={14} color={primary} />
          <Text style={[ms.val, { color: primary }]}>{s.value}</Text>
          <Text style={[ms.lab, { color: muted }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
};

const ms = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  item: { flex: 1, alignItems: 'center', gap: 4, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' },
  val: { fontSize: 16, fontWeight: '900' },
  lab: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ── Upcoming strip ────────────────────────────────────────────────────────────
const UpcomingStrip = ({ events, primary, textColor, muted, onPress }) => {
  if (!events.length) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={[{ fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: muted, marginLeft: 16, marginBottom: 10 }]}>
        COMING UP
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {events.map((ev, i) => {
          const catColor = ev.category_color || getCategoryColor(ev.category) || primary;
          const d = new Date(ev.event_date);
          return (
            <TouchableOpacity
              key={ev.id}
              style={[us.card, { backgroundColor: `${catColor}12`, borderColor: `${catColor}25` }]}
              onPress={() => onPress(ev)}
            >
              <View style={[us.dot, { backgroundColor: catColor }]} />
              <Text style={[us.date, { color: primary }]}>{d.getDate()} {MONTH_NAMES[d.getMonth()]}</Text>
              <Text style={[us.title, { color: textColor }]} numberOfLines={2}>{ev.title}</Text>
              {ev.event_time ? <Text style={[us.time, { color: muted }]}>{ev.event_time}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const us = StyleSheet.create({
  card: { width: 130, padding: 14, borderRadius: 16, borderWidth: 1, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  date: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  title: { fontSize: 13, fontWeight: '800', lineHeight: 17 },
  time: { fontSize: 10, marginTop: 2 },
});

// ── Main CalendarPage ─────────────────────────────────────────────────────────
export const CalendarPage = ({ onAuthRequired, onNavigateToEvent }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const [postModalVisible, setPostModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(today));
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [showGrid, setShowGrid]   = useState(false);
  const [monthEvents, setMonthEvents]   = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'my_rsvps' | 'free'
  const [myRsvpIds, setMyRsvpIds] = useState(new Set());
  const [categoryFilter, setCategoryFilter] = useState(null); // null | category key — ALL event types
  const [searchResults, setSearchResults] = useState([]); // cross-catalog hits (all dates)
  const [searching, setSearching] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const realtimeRef = useRef(null);

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#1a1f21";

  useEffect(() => {
    loadMonth(viewYear, viewMonth);
    loadUpcoming();
  }, [viewYear, viewMonth]);

  // Load user's RSVP'd event IDs for filter
  useEffect(() => {
    if (!user) return;
    resilientRead(
      async () => {
        const { data, error } = await supabase.from('event_rsvps').select('event_id').eq('user_id', user?.id).eq('status', 'going');
        if (error) throw error;
        return data;
      },
      async () => {
        const { data, error } = await supabase.from('event_rsvps').select('event_id').eq('user_id', user?.id).limit(200);
        if (error) throw error;
        return data;
      },
      async () => [],
      [],
      'CalendarPage.rsvpIds'
    ).then(data => setMyRsvpIds(new Set((data || []).map(r => r.event_id)))).catch(() => {});
  }, [user]);

  // Real-time: new events appear on calendar instantly
  useEffect(() => {
    const channel = supabase
      .channel('calendar_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => {
        loadMonth(viewYear, viewMonth);
        loadUpcoming();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, () => {
        loadMonth(viewYear, viewMonth);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_rsvps' }, (p) => {
        if (p.new.user_id === user?.id) {
          setMyRsvpIds(prev => new Set([...prev, p.new.event_id]));
        }
      })
      .subscribe();
    realtimeRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [viewYear, viewMonth, user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([loadMonth(viewYear, viewMonth), loadUpcoming()]);
    } catch { } finally {
      setRefreshing(false);
    }
  };

  const loadMonth = async (y, m) => {
    setLoading(true);
    try {
      const fromDB = await CalendarManager.fetchMonthEvents(y, m);
      setMonthEvents(fromDB || []);
    } catch {
      // keep current month view on transient failure
    } finally {
      setLoading(false);
    }
  };

  const loadUpcoming = async () => {
    try {
      const data = await CalendarManager.fetchUpcoming(10);
      setUpcomingEvents(data.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '')));
    } catch { /* keep existing upcoming events on transient failure */ }
  };

  const switchMonth = (dir) => {
    Animated.timing(slideAnim, {
      toValue: dir === 'next' ? -30 : 30, duration: 180, useNativeDriver: true,
    }).start(() => {
      if (dir === 'next') {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
      } else {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
      }
      slideAnim.setValue(0);
    });
  };

  // Build event dots map { 'YYYY-MM-DD': true }
  const eventDots = useMemo(() => {
    const map = {};
    monthEvents.forEach(ev => { if (ev.event_date) map[ev.event_date] = true; });
    return map;
  }, [monthEvents]);

  // Events for selected day — filtered by search + mode
  const selectedKey = dateKey(selectedDate);
  const dayEvents = useMemo(() => {
    let evs = monthEvents.filter(ev => ev.event_date === selectedKey);
    if (filterMode === 'my_rsvps') evs = evs.filter(ev => myRsvpIds.has(ev.id));
    if (filterMode === 'free') evs = evs.filter(ev => !ev.price || ev.price === 0 || ev.price === 'FREE');
    if (categoryFilter) evs = evs.filter((ev) => eventInCategory(ev, categoryFilter));
    return evs;
  }, [monthEvents, selectedKey, filterMode, myRsvpIds, categoryFilter]);

  // ── Advanced search: query the WHOLE catalog (all dates), debounced ─────────
  // Routes through FeedManager.searchAll → Postgres full-text (search_events_fts)
  // + ilike fallbacks, instead of substring-matching only the visible month.
  const trimmedQuery = searchQuery.trim();
  const inSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (!inSearch) { setSearchResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await FeedManager.searchAll(trimmedQuery);
        if (!cancelled) setSearchResults(res?.events || []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => { cancelled = true; clearTimeout(t); };
  }, [trimmedQuery, inSearch]);

  // Apply the active filters, then rank hits by relevance + recency.
  const rankedResults = useMemo(() => {
    if (!inSearch) return [];
    const tokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean);
    let evs = searchResults;
    if (filterMode === 'my_rsvps') evs = evs.filter(ev => myRsvpIds.has(ev.id));
    if (filterMode === 'free')     evs = evs.filter(ev => !ev.price || ev.price === 0 || ev.price === 'FREE');
    if (categoryFilter) evs = evs.filter((ev) => eventInCategory(ev, categoryFilter));
    return evs
      .map(ev => ({ ev, s: scoreEvent(ev, tokens) }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.ev);
  }, [searchResults, trimmedQuery, inSearch, filterMode, categoryFilter, myRsvpIds]);

  const goToToday = () => {
    setSelectedDate(new Date(today));
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const isThisMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <ErrorBoundary label="Calendar">
    <View style={[styles.container, { backgroundColor: bg }]}>
      <LiquidBackground intensity={0.8} />
      <AuraEffect />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primary} />}
      >

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: `${primary}15` }]}>
          <View style={styles.brandRow}>
            <BrandLogo size={34} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.headerTitle, { color: textColor }]}>Lineup</Text>
              <Text style={[styles.headerSub, { color: muted }]}>Your Gruv Schedule</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {!isThisMonth && (
              <TouchableOpacity style={[styles.todayBtn, { borderColor: `${primary}50` }]} onPress={goToToday}>
                <Text style={[styles.todayBtnText, { color: primary }]}>Today</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: primary }]}
              onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}
            >
              <Feather name="plus" size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={[calS.searchWrap, { backgroundColor: surface, borderColor: `${primary}20` }]}>
          <Feather name="search" size={14} color={muted} />
          <TextInput
            style={[calS.searchInput, { color: textColor }]}
            placeholder="Search all gruvs — title, venue, city…"
            placeholderTextColor={muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color={primary} /> : null}
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={14} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
          {[
            { key: 'all',      label: 'All Gruvs' },
            { key: 'my_rsvps', label: '⚡ Locked In' },
            { key: 'free',     label: '🎫 Free' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[calS.filterPill, { backgroundColor: filterMode === f.key ? primary : `${primary}12`, borderColor: filterMode === f.key ? primary : `${primary}30` }]}
              onPress={() => setFilterMode(f.key)}
            >
              <Text style={[calS.filterText, { color: filterMode === f.key ? '#000' : primary }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category quick-filter — ALL event types, equal footing (not a sports app) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
          {CATEGORY_FILTERS.map((f) => {
            const active = categoryFilter === f.key;
            const accent = f.key ? (CATEGORY_CONFIG[f.key]?.color || primary) : primary;
            return (
              <TouchableOpacity
                key={String(f.key)}
                style={[calS.filterPill, { backgroundColor: active ? accent : `${accent}12`, borderColor: active ? accent : `${accent}30` }]}
                onPress={() => setCategoryFilter(f.key)}
              >
                <Text style={[calS.filterText, { color: active ? '#000' : accent }]} numberOfLines={1}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Advanced search results — whole catalog, all dates, ranked ── */}
        {inSearch && (
          <View style={styles.allEventsSection}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Results</Text>
              <Text style={[styles.sectionCount, { color: muted }]}>
                {searching ? 'Searching…' : `${rankedResults.length} gruv${rankedResults.length !== 1 ? 's' : ''}`}
              </Text>
            </View>

            {searching && rankedResults.length === 0 ? (
              [1, 2, 3].map(i => (
                <View key={i} style={[styles.skeleton, { backgroundColor: `${primary}10` }]} />
              ))
            ) : rankedResults.length === 0 ? (
              <View style={styles.emptyDay}>
                <Feather name="search" size={36} color={muted} style={{ opacity: 0.5 }} />
                <Text style={[styles.emptyDayText, { color: muted }]}>No gruvs match “{trimmedQuery}”</Text>
                <Text style={[styles.searchHint, { color: muted }]}>
                  Searched every gruv by title, venue, city and category.
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.searchHint, { color: muted }]}>Across all dates · most relevant first</Text>
                {rankedResults.map((ev, i) => (
                  <CalEventCard
                    key={ev.id}
                    ev={ev}
                    index={i}
                    showDate
                    primary={primary}
                    textColor={textColor}
                    muted={muted}
                    onPress={() => onNavigateToEvent?.(ev)}
                  />
                ))}
              </>
            )}
          </View>
        )}

        {/* Calendar body — hidden while a search is active */}
        {!inSearch && (<>
        {/* Month navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => switchMonth('prev')} style={styles.navBtn}>
            <Feather name="chevron-left" size={24} color={primary} />
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            <TouchableOpacity onPress={() => setShowGrid(g => !g)} style={styles.monthTitleWrap}>
              <Text style={[styles.monthTitle, { color: textColor }]}>
                {FULL_MONTH[viewMonth]} {viewYear}
              </Text>
              <Feather name={showGrid ? 'chevron-up' : 'chevron-down'} size={16} color={muted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity onPress={() => switchMonth('next')} style={styles.navBtn}>
            <Feather name="chevron-right" size={24} color={primary} />
          </TouchableOpacity>
        </View>

        {/* Week strip (always visible) */}
        <WeekStrip
          selectedDate={selectedDate}
          onSelect={(d) => { setSelectedDate(d); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}
          primary={primary}
          bg={bg}
          textColor={textColor}
          muted={muted}
          eventDots={eventDots}
        />

        {/* Full month grid (collapsible) */}
        {showGrid && (
          <FadeInView direction="up" delay={0}>
            <GlassView style={styles.gridCard}>
              <MonthGrid
                year={viewYear}
                month={viewMonth}
                selectedDate={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setShowGrid(false); }}
                primary={primary}
                textColor={textColor}
                muted={muted}
                eventDots={eventDots}
              />
            </GlassView>
          </FadeInView>
        )}

        {/* The Lineup — honest heat leaderboard (verified presence > buzz > soon) */}
        {!loading && upcomingEvents.length > 1 && (
          <ErrorBoundary inline label="The Lineup">
            <LineupRail events={upcomingEvents} onEventPress={onNavigateToEvent} />
          </ErrorBoundary>
        )}

        {/* Month stats */}
        {!loading && monthEvents.length > 0 && (
          <MonthStats events={monthEvents} primary={primary} muted={muted} />
        )}

        {/* Upcoming horizontal strip */}
        <UpcomingStrip
          events={upcomingEvents.slice(0, 8)}
          primary={primary}
          textColor={textColor}
          muted={muted}
          onPress={(ev) => {
            const d = new Date(ev.event_date);
            setSelectedDate(d);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
          }}
        />

        {/* Selected day label */}
        <View style={[styles.dayHeader, { borderColor: `${primary}20` }]}>
          <View style={styles.dayHeaderLeft}>
            <Text style={[styles.dayNum, { color: primary }]}>{selectedDate.getDate()}</Text>
            <View>
              <Text style={[styles.dayName, { color: textColor }]}>{DAY_FULL[selectedDate.getDay()]}</Text>
              <Text style={[styles.dayMonth, { color: muted }]}>
                {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </Text>
            </View>
          </View>
          <View style={[styles.dayCountBadge, { backgroundColor: dayEvents.length > 0 ? `${primary}20` : 'transparent' }]}>
            <Text style={[styles.dayCount, { color: dayEvents.length > 0 ? primary : muted }]}>
              {dayEvents.length} gruv{dayEvents.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Day events */}
        <View style={styles.eventList}>
          {loading ? (
            [1, 2].map(i => (
              <View key={i} style={[styles.skeleton, { backgroundColor: `${primary}10` }]} />
            ))
          ) : dayEvents.length === 0 ? (
            <View style={styles.emptyDay}>
              <Feather name="sun" size={36} color={muted} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyDayText, { color: muted }]}>No gruvs on this day</Text>
              <TouchableOpacity
                style={[styles.addEventBtn, { borderColor: `${primary}50` }]}
                onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}
              >
                <Feather name="plus" size={14} color={primary} />
                <Text style={[styles.addEventBtnText, { color: primary }]}>Add a Gruv</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dayEvents.map((ev, i) => (
              <CalEventCard
                key={ev.id}
                ev={ev}
                index={i}
                primary={primary}
                textColor={textColor}
                muted={muted}
                onPress={() => onNavigateToEvent?.(ev)}
              />
            ))
          )}
        </View>

        {/* All events this month section */}
        {monthEvents.length > 0 && !loading && (() => {
          let allEvs = monthEvents;
          if (filterMode === 'my_rsvps') allEvs = allEvs.filter(ev => myRsvpIds.has(ev.id));
          if (filterMode === 'free') allEvs = allEvs.filter(ev => !ev.price || ev.price === 0 || ev.price === 'FREE');
          if (categoryFilter) allEvs = allEvs.filter((ev) => eventInCategory(ev, categoryFilter));
          if (!allEvs.length) return null;
          return (
          <View style={styles.allEventsSection}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                All of {MONTH_NAMES[viewMonth]}
              </Text>
              <Text style={[styles.sectionCount, { color: muted }]}>{allEvs.length} gruvs</Text>
            </View>
            {allEvs.map((ev, i) => (
              <CalEventCard
                key={ev.id}
                ev={ev}
                index={i}
                primary={primary}
                textColor={textColor}
                muted={muted}
                onPress={() => {
                  const d = new Date(ev.event_date);
                  setSelectedDate(d);
                }}
              />
            ))}
          </View>
          );
        })()}
        </>)}

      </ScrollView>

      <PostEventModal
        visible={postModalVisible}
        onClose={() => setPostModalVisible(false)}
        onPostSuccess={() => { loadMonth(viewYear, viewMonth); loadUpcoming(); }}
      />
    </View>

    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  todayBtnText: { fontSize: 12, fontWeight: '800' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  navBtn: { padding: 6 },
  monthTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { fontSize: 18, fontWeight: '900' },

  gridCard: { marginHorizontal: 16, padding: 16, borderRadius: 20, marginBottom: 14 },

  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 14 },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayNum: { fontSize: 42, fontWeight: '900', lineHeight: 44 },
  dayName: { fontSize: 16, fontWeight: '800' },
  dayMonth: { fontSize: 12, marginTop: 2 },
  dayCountBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  dayCount: { fontSize: 12, fontWeight: '800' },

  eventList: { paddingHorizontal: 16, marginBottom: 20 },
  skeleton: { height: 90, borderRadius: 18, marginBottom: 12 },

  emptyDay: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyDayText: { fontSize: 14 },
  addEventBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 4 },
  addEventBtnText: { fontSize: 12, fontWeight: '800' },

  allEventsSection: { paddingHorizontal: 16, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionCount: { fontSize: 12, fontWeight: '600' },
  searchHint: { fontSize: 11, fontWeight: '600', marginBottom: 10, marginTop: -2, textAlign: 'center', paddingHorizontal: 30, lineHeight: 16 },
});

const calS = StyleSheet.create({
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 13 },
  filterPill:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText:  { fontSize: 12, fontWeight: '800' },
});
