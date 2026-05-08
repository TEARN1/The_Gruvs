import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Image, Animated, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { FadeInView } from '../components/FadeInView';
import { AuraEffect } from '../components/AuraEffect';
import { BrandLogo } from '../components/BrandLogo';
import { CalendarManager } from '../services/dataFlow';
import { PostEventModal } from '../components/PostEventModal';
import { getCategoryColor, CATEGORY_CONFIG } from '../constants/CategoryConfig';

const { width } = Dimensions.get('window');
const CELL = Math.floor((width - 32) / 7);
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_SHORT = ['S','M','T','W','T','F','S'];
const DAY_FULL  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const today = new Date();
const pad2 = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

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
        return (
          <TouchableOpacity
            key={i}
            style={[
              ws.cell,
              isSelected && { backgroundColor: primary },
              !isSelected && isToday && { borderColor: primary, borderWidth: 1.5 },
            ]}
            onPress={() => onSelect(d)}
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
          <Text key={i} style={[mg.dayName, { color: muted, width: CELL }]}>{d}</Text>
        ))}
      </View>
      {/* Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: firstDow }).map((_, i) => (
          <View key={`e${i}`} style={{ width: CELL, height: CELL }} />
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
              style={[
                mg.cell,
                { width: CELL, height: CELL },
                isSel && { backgroundColor: primary, borderRadius: CELL / 2 },
                !isSel && isToday && { borderWidth: 1.5, borderColor: primary, borderRadius: CELL / 2 },
              ]}
              onPress={() => onSelect(d)}
            >
              <Text style={[mg.num, { color: isSel ? '#000' : isToday ? primary : textColor }]}>
                {day}
              </Text>
              {hasDot && <View style={[mg.dot, { backgroundColor: isSel ? '#000' : primary }]} />}
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
  num: { fontSize: 13, fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
});

// ── Event card for calendar ────────────────────────────────────────────────────
const CalEventCard = ({ ev, primary, textColor, muted, onPress, index }) => {
  const catColor = ev.category_color || getCategoryColor(ev.category) || primary;
  const thumb = ev.media?.[0]?.url || ev.media?.[0] || null;
  return (
    <FadeInView delay={index * 60} direction="up">
      <TouchableOpacity
        style={[ec.wrap, { borderColor: `${catColor}30`, backgroundColor: `${catColor}08` }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Colour accent */}
        <View style={[ec.accent, { backgroundColor: catColor }]} />

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
            {ev.category ? (
              <View style={[ec.catBadge, { backgroundColor: `${catColor}20` }]}>
                <Text style={[ec.catText, { color: catColor }]}>
                  {(CATEGORY_CONFIG[ev.category]?.label || ev.category).toUpperCase()}
                </Text>
              </View>
            ) : null}
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
        { icon: 'calendar', label: 'Events',     value: total  },
        { icon: 'users',    label: 'Going',      value: going  },
        { icon: 'grid',     label: 'Categories', value: cats   },
        { icon: 'tag',      label: 'Free',       value: hasFree ? 'Yes' : 'No' },
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
  const slideAnim = useRef(new Animated.Value(0)).current;

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    loadMonth(viewYear, viewMonth);
    loadUpcoming();
  }, [viewYear, viewMonth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMonth(viewYear, viewMonth), loadUpcoming()]);
    setRefreshing(false);
  };

  const loadMonth = async (y, m) => {
    setLoading(true);
    const fromDB = await CalendarManager.fetchMonthEvents(y, m);
    setMonthEvents(fromDB);
    setLoading(false);
  };

  const loadUpcoming = async () => {
    const data = await CalendarManager.fetchUpcoming(10);
    setUpcomingEvents(data.sort((a, b) => a.event_date?.localeCompare(b.event_date)));
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

  // Events for selected day
  const selectedKey = dateKey(selectedDate);
  const dayEvents = monthEvents.filter(ev => ev.event_date === selectedKey);

  const goToToday = () => {
    setSelectedDate(new Date(today));
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const isThisMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
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
              <Text style={[styles.headerTitle, { color: textColor }]}>Calendar</Text>
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
        {monthEvents.length > 0 && !loading && (
          <View style={styles.allEventsSection}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                All of {MONTH_NAMES[viewMonth]}
              </Text>
              <Text style={[styles.sectionCount, { color: muted }]}>{monthEvents.length} gruvs</Text>
            </View>
            {monthEvents.map((ev, i) => (
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
        )}

      </ScrollView>

      <PostEventModal
        visible={postModalVisible}
        onClose={() => setPostModalVisible(false)}
        onPostSuccess={() => { loadMonth(viewYear, viewMonth); loadUpcoming(); }}
      />
    </View>
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
});
