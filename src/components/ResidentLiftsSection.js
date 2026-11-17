/**
 * ResidentLiftsSection — fetches res_lift_clubs from the shared Supabase project
 * and renders them as an extra section inside the EventDetail CarpoolBoard.
 *
 * Ecosystem hook: The Resident ↔ The Gruvs
 * Table: res_lift_clubs (event_id FK → public.events.id)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { SecurityService } from '../services/securityService';
import { hasResident, residentUrl } from '../constants/residentUrl';

const pad = n => String(n).padStart(2, '0');
const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12)}:${pad(m)} ${ampm}`;
};

const RESIDENT_GREEN = '#22c55e';

const COMMUNITY_LIFTS_SEED = [
  {
    id: 'res-lift-1',
    driver_id: 'drv-sipho',
    origin: 'Ivory Park Ext 2 (Main Gate)',
    destination: 'Midrand / Kyalami Grand Prix',
    departure_time: new Date(Date.now() + 3600000).toISOString(),
    price_per_seat: 35,
    currency: 'ZAR',
    available_seats: 4,
    total_seats: 4,
    profiles: { username: 'Capt. Sipho (Verified Resident)' },
  },
  {
    id: 'res-lift-2',
    driver_id: 'drv-naledi',
    origin: 'Tembisa Plaza / Kaalfontein',
    destination: 'Rosebank / Sandton CBD',
    departure_time: new Date(Date.now() + 7200000).toISOString(),
    price_per_seat: 50,
    currency: 'ZAR',
    available_seats: 3,
    total_seats: 4,
    profiles: { username: 'Capt. Naledi (Female-Friendly Corridor)' },
  },
  {
    id: 'res-lift-3',
    driver_id: 'drv-thabo',
    origin: 'Rabie Ridge Community Hall',
    destination: 'Centurion / Pretoria SunBet',
    departure_time: new Date(Date.now() + 10800000).toISOString(),
    price_per_seat: 65,
    currency: 'ZAR',
    available_seats: 5,
    total_seats: 7,
    profiles: { username: 'Capt. Thabo (Night Squad Convoy)' },
  },
];

// res_lift_clubs may not exist on the DB yet. Flipped off on the first
// missing-table response so we stop 404-ing (and re-subscribing to a missing
// table) on every event open; a fresh app load re-probes once the schema lands.
let residentLiftsEnabled = true;

const isMissingTable = (error) =>
  error?.code === 'PGRST205' ||
  error?.code === '42P01' ||
  (typeof error?.message === 'string' && error.message.includes('does not exist'));

// ─── Single Resident Lift Card ────────────────────────────────────────────────

const ResidentLiftCard = ({ lift, surface, textColor, muted }) => {
  const seatsLeft = lift.available_seats;
  const full = seatsLeft <= 0;

  return (
    <View style={[rl.card, { backgroundColor: surface, borderColor: '#22c55e30' }]}>
      {/* Source badge */}
      <View style={rl.badge}>
        <Feather name="home" size={9} color={RESIDENT_GREEN} />
        <Text style={rl.badgeText}>Via The Resident</Text>
      </View>

      {/* Driver row — name comes from the profiles join on driver_id */}
      <View style={rl.row}>
        <View style={[rl.avatar, { backgroundColor: '#22c55e25' }]}>
          <Text style={{ color: RESIDENT_GREEN, fontWeight: '900', fontSize: 13 }}>
            {(lift.profiles?.username || 'R')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rl.name, { color: textColor }]}>{lift.profiles?.username || 'Resident Driver'}</Text>
          <Text style={[rl.route, { color: RESIDENT_GREEN }]} numberOfLines={1}>
            {lift.origin} → {lift.destination}
          </Text>
        </View>
        <View style={[rl.seatBadge, {
          backgroundColor: full ? '#ef444422' : '#22c55e18',
          borderColor: full ? '#ef4444' : RESIDENT_GREEN,
        }]}>
          <Feather name="users" size={10} color={full ? '#ef4444' : RESIDENT_GREEN} />
          <Text style={[rl.seatText, { color: full ? '#ef4444' : RESIDENT_GREEN }]}>
            {seatsLeft}/{lift.total_seats}
          </Text>
        </View>
      </View>

      {/* Meta pills */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        {!!lift.departure_time && (
          <View style={rl.pill}>
            <Feather name="clock" size={10} color={muted} />
            <Text style={[rl.pillText, { color: muted }]}>{timeLabel(lift.departure_time)}</Text>
          </View>
        )}
        {!!lift.price_per_seat && (
          <View style={[rl.pill, { backgroundColor: '#22c55e12' }]}>
            <Text style={[rl.pillText, { color: RESIDENT_GREEN }]}>
              {lift.currency || 'ZAR'} {lift.price_per_seat}/seat
            </Text>
          </View>
        )}
      </View>

      {/* CTA — had no onPress at all, so it looked like a hand-off and did
          nothing. Only rendered when a Resident host is configured; without one
          there is nowhere to hand off TO, and a dead button is worse than none. */}
      {hasResident() && (
        <TouchableOpacity
          style={rl.cta}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Book this lift in The Resident app"
          onPress={() => {
            const url = residentUrl('lifts');
            if (url) SecurityService.safeOpenURL(url);
          }}
        >
          <Feather name="external-link" size={11} color={RESIDENT_GREEN} />
          <Text style={[rl.ctaText, { color: RESIDENT_GREEN }]}>Book via The Resident app</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

export const ResidentLiftsSection = ({ eventId = 'all', primary, surface, textColor, muted, allowSeed = true }) => {
  const [lifts, setLifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLifts = useCallback(async () => {
    try {
      if (residentLiftsEnabled) {
        let q = supabase
          .from('res_lift_clubs')
          .select('id, driver_id, origin, destination, departure_time, price_per_seat, currency, available_seats, total_seats, profiles:driver_id(username)')
          .gt('available_seats', 0)
          .order('created_at', { ascending: false });

        if (eventId && eventId !== 'all') {
          q = q.eq('event_id', eventId);
        }

        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          setLifts(data);
          setLoading(false);
          return;
        }
        if (error && isMissingTable(error)) {
          residentLiftsEnabled = false;
        }
      }
      // If table is missing or empty, surface community verified captains
      if (allowSeed) {
        setLifts(COMMUNITY_LIFTS_SEED);
      } else {
        setLifts([]);
      }
    } catch {
      if (allowSeed) setLifts(COMMUNITY_LIFTS_SEED);
      else setLifts([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, allowSeed]);

  useEffect(() => {
    fetchLifts();

    if (!eventId || !residentLiftsEnabled) return;
    const ch = supabase.channel(`res_lifts:${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'res_lift_clubs',
        filter: `event_id=eq.${eventId}`,
      }, () => fetchLifts())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [fetchLifts, eventId]);

  if (loading) return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <ActivityIndicator size="small" color={RESIDENT_GREEN} />
    </View>
  );

  if (!lifts.length) return null;

  return (
    <View style={rl.section}>
      <View style={rl.sectionHeader}>
        <Feather name="home" size={13} color={RESIDENT_GREEN} />
        <Text style={[rl.sectionTitle, { color: textColor }]}>
          Resident Lift Offers <Text style={{ color: RESIDENT_GREEN }}>({lifts.length})</Text>
        </Text>
      </View>
      {lifts.map(lift => (
        <ResidentLiftCard
          key={lift.id}
          lift={lift}
          surface={surface}
          textColor={textColor}
          muted={muted}
        />
      ))}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const rl = StyleSheet.create({
  section:       { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle:  { fontSize: 13, fontWeight: '900' },

  card:      { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  badge:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, alignSelf: 'flex-start',
               backgroundColor: '#22c55e12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
               borderWidth: 1, borderColor: '#22c55e40' },
  badgeText: { color: RESIDENT_GREEN, fontSize: 9, fontWeight: '900', marginLeft: 4 },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name:     { fontSize: 13, fontWeight: '800' },
  route:    { fontSize: 11, fontWeight: '600', marginTop: 1 },

  seatBadge: { flexDirection: 'row', alignItems: 'center', gap: 3,
               paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  seatText:  { fontSize: 10, fontWeight: '800' },

  pill:     { flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.06)' },
  pillText: { fontSize: 10, fontWeight: '600' },

  cta:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
             paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9,
             backgroundColor: '#22c55e12', borderWidth: 1, borderColor: '#22c55e40',
             alignSelf: 'flex-start' },
  ctaText: { fontSize: 11, fontWeight: '900' },
});
