import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const SCREEN_W = Dimensions.get('window').width;
const ITEM_H = 52;
const VISIBLE = 5;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── Calendar date picker ──────────────────────────────────────────────────────
export const CalendarPicker = ({
  visible, onClose, onConfirm, value,
  primary, bg, textColor, muted,
}) => {
  const today = new Date();
  const init = value instanceof Date ? value : today;

  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const [selected, setSelected] = useState(value instanceof Date ? value : null);

  useEffect(() => {
    if (visible) {
      const d = value instanceof Date ? value : null;
      if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelected(d); }
    }
  }, [visible, value]);

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[cp.card, { backgroundColor: bg }]}>
          {/* Month/year nav */}
          <View style={cp.navRow}>
            <TouchableOpacity onPress={prevMonth} style={cp.navBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="chevron-left" size={22} color={textColor} />
            </TouchableOpacity>
            <Text style={[cp.monthLabel, { color: textColor }]}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={cp.navBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="chevron-right" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={cp.daysRow}>
            {DAYS_SHORT.map(d => (
              <Text key={d} style={[cp.dayHeader, { color: muted }]}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={cp.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={cp.cell} />;
              const date = new Date(viewYear, viewMonth, day);
              const isSelected = selected && date.toDateString() === selected.toDateString();
              const isToday = date.toDateString() === today.toDateString();
              const isPast = date < today && !isToday;
              return (
                <TouchableOpacity
                  key={`d${day}`}
                  style={[
                    cp.cell,
                    isSelected && [cp.selectedCell, { backgroundColor: primary }],
                    !isSelected && isToday && [cp.todayCell, { borderColor: primary }],
                  ]}
                  onPress={() => setSelected(date)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    cp.dayNum,
                    { color: isSelected ? '#000' : isPast ? `${textColor}35` : textColor },
                    (isSelected || isToday) && { fontWeight: '900' },
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm */}
          <TouchableOpacity
            style={[cp.confirmBtn, { backgroundColor: selected ? primary : `${primary}28` }]}
            onPress={() => selected && onConfirm(selected)}
            disabled={!selected}
          >
            <Text style={[cp.confirmText, { color: selected ? '#000' : muted }]}>
              {selected
                ? selected.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                : 'Pick a date'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const cp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: Math.min(SCREEN_W - 32, 348), borderRadius: 24, padding: 20 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 17, fontWeight: '900' },
  daysRow: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 100, marginBottom: 2 },
  selectedCell: {},
  todayCell: { borderWidth: 1.5 },
  dayNum: { fontSize: 14 },
  confirmBtn: { marginTop: 18, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmText: { fontWeight: '900', fontSize: 14 },
});

// ── Stable wheel column — defined at module level so React never remounts it ──
// Defining inside TimePicker creates a new component type on every render,
// which causes React to unmount/remount the ScrollView and lose scroll position.
const WheelColumn = ({ items, selected, scrollRef, onScroll, wheelH, padH, primary, textColor }) => (
  <View style={[tp.col, { height: wheelH }]}>
    <View
      style={[tp.highlight, { borderColor: `${primary}50`, top: padH, height: ITEM_H }]}
      pointerEvents="none"
    />
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={onScroll}
      onScrollEndDrag={onScroll}
      contentContainerStyle={{ paddingVertical: padH }}
    >
      {items.map(val => (
        <View key={val} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[
            tp.itemText,
            val === selected
              ? { fontWeight: '900', fontSize: 28, color: primary }
              : { color: `${textColor}70` },
          ]}>
            {String(val).padStart(2, '0')}
          </Text>
        </View>
      ))}
    </ScrollView>
  </View>
);

// ── Scroll time picker ────────────────────────────────────────────────────────
export const TimePicker = ({
  visible, onClose, onConfirm, initialHour = 20, initialMinute = 0,
  primary, bg, textColor, muted,
}) => {
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const hourRef = useRef(null);
  const minRef = useRef(null);

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = Array.from({ length: 60 }, (_, i) => i);
  const PAD = Math.floor(VISIBLE / 2);
  const WHEEL_H = ITEM_H * VISIBLE;
  const PAD_H = PAD * ITEM_H;

  useEffect(() => {
    if (visible) {
      setHour(initialHour);
      setMinute(initialMinute);
      setTimeout(() => {
        hourRef.current?.scrollTo({ y: initialHour * ITEM_H, animated: false });
        minRef.current?.scrollTo({ y: initialMinute * ITEM_H, animated: false });
      }, 80);
    }
  }, [visible, initialHour, initialMinute]);

  const onHourScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    setHour(Math.max(0, Math.min(23, idx)));
  };
  const onMinuteScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    setMinute(Math.max(0, Math.min(59, idx)));
  };

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={tp.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[tp.card, { backgroundColor: bg }]}>
            <Text style={[tp.title, { color: textColor }]}>Pick a Time</Text>
            <input
              type="time"
              value={`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
              onChange={e => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!isNaN(h)) setHour(h);
                if (!isNaN(m)) setMinute(m);
              }}
              style={{
                fontSize: 28, padding: 12, borderRadius: 12,
                border: `2px solid ${primary}`, color: textColor,
                backgroundColor: bg, width: '100%', textAlign: 'center',
                outline: 'none', marginTop: 8,
              }}
            />
            <Text style={[tp.preview, { color: primary }]}>
              {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
            </Text>
            <TouchableOpacity
              style={[tp.confirmBtn, { backgroundColor: primary }]}
              onPress={() => onConfirm(hour, minute)}
            >
              <Text style={tp.confirmText}>Confirm Time</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={tp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[tp.card, { backgroundColor: bg }]}>
          <Text style={[tp.title, { color: textColor }]}>Pick a Time</Text>

          <View style={[tp.wheelsRow, { height: WHEEL_H }]}>
            <WheelColumn
              items={HOURS} selected={hour} scrollRef={hourRef} onScroll={onHourScroll}
              wheelH={WHEEL_H} padH={PAD_H} primary={primary} textColor={textColor}
            />
            <Text style={[tp.colon, { color: textColor }]}>:</Text>
            <WheelColumn
              items={MINUTES} selected={minute} scrollRef={minRef} onScroll={onMinuteScroll}
              wheelH={WHEEL_H} padH={PAD_H} primary={primary} textColor={textColor}
            />
          </View>

          <Text style={[tp.preview, { color: primary }]}>
            {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
          </Text>

          <TouchableOpacity
            style={[tp.confirmBtn, { backgroundColor: primary }]}
            onPress={() => onConfirm(hour, minute)}
          >
            <Text style={tp.confirmText}>Confirm Time</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const tp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: { width: '100%', maxWidth: Math.min(SCREEN_W - 32, 280), borderRadius: 24, padding: 22, overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 18, letterSpacing: 0.5 },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  col: { flex: 1, overflow: 'hidden', position: 'relative' },
  highlight: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderBottomWidth: 1.5, zIndex: 1 },
  itemText: { fontSize: 20, fontWeight: '400' },
  colon: { fontSize: 30, fontWeight: '900', paddingHorizontal: 6, marginTop: -6 },
  preview: { textAlign: 'center', fontSize: 26, fontWeight: '900', marginTop: 14, letterSpacing: 3 },
  confirmBtn: { marginTop: 18, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: '900', fontSize: 15 },
});
