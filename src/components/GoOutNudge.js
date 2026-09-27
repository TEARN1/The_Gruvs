/**
 * GoOutNudge — one rotating motivational card in The Drop feed that pushes the
 * user to HOST, NETWORK or ATTEND (growth thesis in constants/GoOutNudges.js).
 *
 * Every {placeholder} is filled from LIVE data only — the loaded feed, the
 * user's profile, a real hosted-this-month count. pickNudge skips any nudge
 * whose data is missing, so a user with no nearby events never sees
 * "0 events near you". Cooldown: at most one nudge per 4h, dismissible,
 * never repeats the last 15 shown. Degrades silently on any storage/DB error.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';
import { pickNudge } from '../constants/GoOutNudges';

const STORE_KEY = 'gruvs_nudge_state';          // { lastShown: ms, recent: [ids] }
const COOLDOWN_MS = 4 * 60 * 60 * 1000;         // one nudge per 4 hours max
const RECENT_KEEP = 15;                          // never repeat the last 15

const CAT_ICON = {
  host: 'plus-circle', network: 'users', discover: 'zap',
  go_out: 'sunset', crew: 'smile', identity: 'star', special: 'gift',
};

export const GoOutNudge = ({
  events = [], topEvent = null, onHost, onExplore, onViewEvent,
  primary = '#00f2ff', textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)', surface = 'rgba(255,255,255,0.05)',
}) => {
  const { user, profile } = useAuth();
  const [nudge, setNudge] = useState(null);
  const slide = useRef(new Animated.Value(0)).current;
  const decidedRef = useRef(false); // pick once per mount — feed updates must not reshuffle it

  useEffect(() => {
    if (decidedRef.current || !events.length) return;
    decidedRef.current = true;
    let alive = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        const state = raw ? JSON.parse(raw) : {};
        if (state.lastShown && Date.now() - state.lastShown < COOLDOWN_MS) return;

        // Real hosted-this-month signal (head-count only). Unknown → true, so
        // we never wrongly nag someone who already hosted.
        let hostedThisMonth = true;
        if (user) {
          try {
            const monthStart = new Date();
            monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
            const { count, error } = await supabase
              .from('events')
              .select('id', { count: 'exact', head: true })
              .eq('author_id', user.id)
              .gte('created_at', monthStart.toISOString());
            if (!error) hostedThisMonth = (count || 0) > 0;
          } catch { /* keep safe default */ }
        }

        const top = topEvent || events[0];
        const city = profile?.city || top?.city || null;
        const now = new Date();
        const data = {
          city,
          country: profile?.country || null,
          count: events.length || null,
          event: top?.title || null,
        };

        const recent = new Set(state.recent || []);
        // Re-pick past nudges whose route this surface can't serve (e.g. beacon
        // lives on the profile tab) — treat them like "recently shown".
        const serveable = new Set(['host', 'explore', 'event', 'map']);
        let picked = null;
        for (let i = 0; i < 10; i++) {
          const n = pickNudge({
            hostedThisMonth,
            nearbyCount: events.length,
            isWeekend: now.getDay() === 5 || now.getDay() === 6,
            dayOfMonth: now.getDate(),
            recentIds: recent,
            data,
          });
          if (!n) return;
          if (serveable.has(n.route) && (n.route !== 'event' || top)) { picked = n; break; }
          recent.add(n.id);
        }
        if (!picked || !alive) return;

        const keep = [picked.id, ...(state.recent || [])].slice(0, RECENT_KEEP);
        await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ lastShown: Date.now(), recent: keep }));
        if (!alive) return;
        setNudge({ ...picked, _top: top });
        Animated.spring(slide, { toValue: 1, useNativeDriver: true, tension: 60, friction: 11 }).start();
      } catch { /* storage/DB unavailable — show nothing */ }
    })();

    return () => { alive = false; };
  }, [events, topEvent, user, profile, slide]);

  if (!nudge) return null;

  const act = () => {
    try { haptics.select?.(); } catch {}
    setNudge(null);
    if (nudge.route === 'host') onHost?.();
    else if (nudge.route === 'event' && nudge._top) onViewEvent?.(nudge._top);
    else onExplore?.(); // explore + map both land on discovery
  };

  const dismiss = () => setNudge(null);

  return (
    <Animated.View
      style={[
        n.wrap,
        { borderColor: `${primary}30`, backgroundColor: surface },
        {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      <View style={[n.iconCircle, { backgroundColor: `${primary}18` }]}>
        <Feather name={CAT_ICON[nudge.cat] || 'zap'} size={16} color={primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[n.body, { color: textColor }]}>{nudge.body}</Text>
        <TouchableOpacity onPress={act} activeOpacity={0.8} style={[n.cta, { backgroundColor: primary }]}>
          <Text style={n.ctaText}>{nudge.cta}</Text>
          <Feather name="arrow-right" size={12} color="#000" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={dismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss nudge"
      >
        <Feather name="x" size={15} color={muted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const n = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ctaText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
});

export default GoOutNudge;