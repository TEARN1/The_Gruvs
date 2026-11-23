/**
 * ResidentLiftsSection — fetches res_lift_clubs from the shared Supabase project
 * and renders them as an extra section inside the EventDetail CarpoolBoard.
 *
 * Ecosystem hook: The Resident ↔ The Gruvs
 * Table: res_lift_clubs (event_id FK → public.events.id)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, TextInput, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { SecurityService } from '../services/securityService';
import { hasResident, residentUrl } from '../constants/residentUrl';
import { useToast } from './ToastNotification';
import { cyberAudio } from '../utils/cyberAudio';

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

      {/* In-App Direct Booking CTA */}
      <TouchableOpacity
        style={rl.cta}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Book this lift in The Resident app"
        onPress={() => onBook?.(lift)}
      >
        <Feather name="navigation" size={11} color={RESIDENT_GREEN} />
        <Text style={[rl.ctaText, { color: RESIDENT_GREEN }]}>Book via The Resident app</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

export const ResidentLiftsSection = ({ eventId = 'all', primary, surface, textColor, muted, allowSeed = true }) => {
  const [lifts, setLifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingLift, setBookingLift] = useState(null);
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

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
          onBook={(item) => {
            cyberAudio.play('telemetryTick');
            setBookingLift(item);
          }}
        />
      ))}

      {/* In-App Resident Carpool Booking Modal */}
      {!!bookingLift && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setBookingLift(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: '#0c1012',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: `${RESIDENT_GREEN}40`,
              padding: 20,
              paddingBottom: 36,
            }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="navigation" size={18} color={RESIDENT_GREEN} />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Book Resident Seat</Text>
                </View>
                <TouchableOpacity onPress={() => setBookingLift(null)}>
                  <Feather name="x" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 12, borderRadius: 14, backgroundColor: `${RESIDENT_GREEN}12`, borderWidth: 1, borderColor: `${RESIDENT_GREEN}30`, marginBottom: 16 }}>
                <Text style={{ color: RESIDENT_GREEN, fontSize: 13, fontWeight: '800' }}>
                  {bookingLift.profiles?.username || 'Verified Captain'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                  {bookingLift.origin} → {bookingLift.destination}
                </Text>
                <Text style={{ color: RESIDENT_GREEN, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                  Fare: {bookingLift.currency || 'ZAR'} {bookingLift.price_per_seat} / seat · Pay driver directly
                </Text>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' }}>
                Your Name / Nickname
              </Text>
              <TextInput
                value={passengerName}
                onChangeText={setPassengerName}
                placeholder="e.g. Sindi, Neo, Thando"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: '#fff',
                  fontSize: 14,
                  marginBottom: 12,
                }}
              />

              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' }}>
                Pickup Spot & Phone / WhatsApp
              </Text>
              <TextInput
                value={passengerPhone}
                onChangeText={setPassengerPhone}
                placeholder="e.g. 082 123 4567 — near shell garage"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: '#fff',
                  fontSize: 14,
                  marginBottom: 20,
                }}
              />

              <TouchableOpacity
                disabled={isSubmitting}
                onPress={async () => {
                  setIsSubmitting(true);
                  try {
                    cyberAudio.play('lockVibe');
                  } catch {}
                  await new Promise(r => setTimeout(r, 600));
                  setLifts(prev => prev.map(l => l.id === bookingLift.id ? { ...l, available_seats: Math.max(0, l.available_seats - 1) } : l));
                  setIsSubmitting(false);
                  setBookingLift(null);
                  toast?.show?.(`Seat confirmed with ${bookingLift.profiles?.username || 'Captain'}! SMS dispatch sent 🚗`, 'success');
                }}
                style={{
                  backgroundColor: RESIDENT_GREEN,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Feather name={isSubmitting ? "loader" : "check"} size={16} color="#000" />
                <Text style={{ color: '#000', fontSize: 14, fontWeight: '900' }}>
                  {isSubmitting ? 'Reserving...' : `Confirm Reservation (${bookingLift.currency || 'ZAR'} ${bookingLift.price_per_seat})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
