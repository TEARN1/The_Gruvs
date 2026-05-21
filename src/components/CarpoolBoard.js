/**
 * CarpoolBoard — find or offer a lift to/from an event.
 * Stores offers in `event_carpools` table:
 *   (event_id, driver_id, seats_available, departure_area, departure_time, note)
 * Others can request a seat (event_carpool_requests: carpool_id, rider_id).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`;
};

const OfferCard = React.memo(({ offer, user, primary, textColor, muted, surface, onRequest }) => {
  const isOwn = offer.driver_id === user?.id;
  const requested = offer.my_request;
  const full = offer.seats_taken >= offer.seats_available;

  return (
    <View style={[cp.card, { backgroundColor: surface, borderColor: `${primary}20` }]}>
      <View style={cp.cardTop}>
        <View style={[cp.avatar, { backgroundColor: `${primary}25` }]}>
          <Text style={{ color: primary, fontWeight: '900', fontSize: 13 }}>
            {(offer.driver_username || 'D')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cp.driverName, { color: textColor }]}>@{offer.driver_username}</Text>
          <Text style={[cp.area, { color: primary }]}>{offer.departure_area}</Text>
        </View>
        <View style={[cp.seatBadge, { backgroundColor: full ? '#ef444422' : `${primary}20`, borderColor: full ? '#ef4444' : primary }]}>
          <Feather name="users" size={10} color={full ? '#ef4444' : primary} />
          <Text style={[cp.seatText, { color: full ? '#ef4444' : primary }]}>
            {offer.seats_available - offer.seats_taken}/{offer.seats_available}
          </Text>
        </View>
      </View>

      {!!offer.departure_time && (
        <View style={cp.timeRow}>
          <Feather name="clock" size={11} color={muted} />
          <Text style={[cp.timeText, { color: muted }]}>Leaving at {timeLabel(offer.departure_time)}</Text>
        </View>
      )}
      {!!offer.note && (
        <Text style={[cp.note, { color: muted }]} numberOfLines={2}>{offer.note}</Text>
      )}

      {!isOwn && (
        <TouchableOpacity
          style={[cp.requestBtn, {
            backgroundColor: requested ? `${primary}15` : full ? '#ef444422' : `${primary}20`,
            borderColor: requested ? primary : full ? '#ef4444' : `${primary}40`,
          }]}
          onPress={() => !full && !requested && onRequest(offer)}
          disabled={full || requested}
          activeOpacity={0.8}
        >
          <Feather name={requested ? 'check' : full ? 'x' : 'send'} size={12} color={requested ? primary : full ? '#ef4444' : primary} />
          <Text style={[cp.requestText, { color: requested ? primary : full ? '#ef4444' : primary }]}>
            {requested ? 'Requested' : full ? 'Full' : 'Request Seat'}
          </Text>
        </TouchableOpacity>
      )}
      {isOwn && (
        <View style={[cp.ownTag, { borderColor: `${primary}30` }]}>
          <Text style={[{ fontSize: 10, color: primary, fontWeight: '800' }]}>YOUR OFFER</Text>
        </View>
      )}
    </View>
  );
});

export const CarpoolBoard = ({ event, primary, textColor, muted, surface }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [seats, setSeats] = useState('2');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchOffers = useCallback(async () => {
    if (!event?.id) return;
    try {
      const [offersRes, reqsRes] = await Promise.allSettled([
        supabase.from('event_carpools')
          .select('id, driver_id, seats_available, departure_area, departure_time, note, profiles:driver_id(username)')
          .eq('event_id', event.id)
          .order('created_at', { ascending: false }),
        user
          ? supabase.from('event_carpool_requests').select('carpool_id').eq('rider_id', user.id)
          : Promise.resolve({ data: [] }),
        supabase.from('event_carpool_requests').select('carpool_id').eq('event_id', event.id),
      ]);

      if (offersRes.status !== 'fulfilled' || !offersRes.value.data) return;

      const myReqs = new Set((reqsRes.status === 'fulfilled' ? reqsRes.value?.data || [] : []).map(r => r.carpool_id));

      // Count seats taken per offer
      const { data: allReqs } = await supabase
        .from('event_carpool_requests')
        .select('carpool_id')
        .in('carpool_id', offersRes.value.data.map(o => o.id));

      const taken = {};
      (allReqs || []).forEach(r => { taken[r.carpool_id] = (taken[r.carpool_id] || 0) + 1; });

      setOffers(offersRes.value.data.map(o => ({
        ...o,
        driver_username: o.profiles?.username || 'Vibe',
        seats_taken: taken[o.id] || 0,
        my_request: myReqs.has(o.id),
      })));
    } catch {}
    finally { setLoading(false); }
  }, [event?.id, user]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const handlePostOffer = async () => {
    if (!user) { toast.show('Sign in to offer a lift', 'info'); return; }
    if (!area.trim()) { toast.show('Add your departure area', 'info'); return; }
    const s = parseInt(seats, 10);
    if (isNaN(s) || s < 1 || s > 10) { toast.show('Seats must be 1–10', 'info'); return; }
    setPosting(true);
    try {
      const ok = await resilient(
        [() => supabase.from('event_carpools').insert({
          event_id: event.id,
          driver_id: user.id,
          seats_available: s,
          departure_area: area.trim(),
          note: note.trim() || null,
        })],
        { attemptsPerTier: 2, baseMs: 400, label: 'Carpool.post' }
      );
      if (ok === null) throw new Error();
      toast.show('Lift offer posted!', 'success');
      setShowForm(false);
      setArea(''); setNote(''); setSeats('2');
      fetchOffers();
    } catch {
      toast.show('Could not post offer. Try again.', 'error');
    } finally { setPosting(false); }
  };

  const handleRequest = async (offer) => {
    if (!user) { toast.show('Sign in to request a seat', 'info'); return; }
    setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, my_request: true, seats_taken: o.seats_taken + 1 } : o));
    try {
      const ok = await resilient(
        [() => supabase.from('event_carpool_requests').insert({ carpool_id: offer.id, rider_id: user.id, event_id: event.id })],
        { attemptsPerTier: 2, baseMs: 400, label: 'Carpool.request' }
      );
      if (ok === null) throw new Error();
      toast.show(`Seat requested from @${offer.driver_username}!`, 'success');
    } catch {
      setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, my_request: false, seats_taken: Math.max(0, o.seats_taken - 1) } : o));
      toast.show('Could not request seat. Try again.', 'error');
    }
  };

  return (
    <View style={cp.container}>
      <View style={cp.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Feather name="navigation" size={14} color={primary} />
          <Text style={[cp.headerText, { color: textColor }]}>Carpool Board</Text>
        </View>
        {user && (
          <TouchableOpacity
            style={[cp.offerBtn, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}
            onPress={() => setShowForm(v => !v)}
            activeOpacity={0.8}
          >
            <Feather name={showForm ? 'x' : 'plus'} size={13} color={primary} />
            <Text style={[cp.offerBtnText, { color: primary }]}>{showForm ? 'Cancel' : 'Offer Lift'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Post offer form */}
      {showForm && (
        <View style={[cp.form, { backgroundColor: `${surface}`, borderColor: `${primary}25` }]}>
          <Text style={[cp.formLabel, { color: muted }]}>DEPARTURE AREA *</Text>
          <TextInput
            value={area}
            onChangeText={setArea}
            placeholder="e.g. Sandton, Rosebank"
            placeholderTextColor={muted}
            style={[cp.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
          />
          <Text style={[cp.formLabel, { color: muted }]}>SEATS AVAILABLE</Text>
          <TextInput
            value={seats}
            onChangeText={setSeats}
            keyboardType="number-pad"
            maxLength={2}
            style={[cp.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08`, width: 80 }]}
          />
          <Text style={[cp.formLabel, { color: muted }]}>NOTE (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Any extra info for riders..."
            placeholderTextColor={muted}
            multiline
            numberOfLines={2}
            style={[cp.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08`, minHeight: 56 }]}
          />
          <TouchableOpacity
            style={[cp.postBtn, { backgroundColor: primary, opacity: posting ? 0.6 : 1 }]}
            onPress={handlePostOffer}
            disabled={posting}
            activeOpacity={0.85}
          >
            {posting
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={cp.postBtnText}>Post Offer</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {loading
        ? <ActivityIndicator size="small" color={primary} style={{ marginVertical: 12 }} />
        : offers.length === 0
          ? (
            <View style={cp.empty}>
              <Feather name="navigation" size={28} color={`${primary}40`} />
              <Text style={[cp.emptyText, { color: muted }]}>No lift offers yet.{user ? '\nBe the first to offer!' : ''}</Text>
            </View>
          )
          : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {offers.map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  user={user}
                  primary={primary}
                  textColor={textColor}
                  muted={muted}
                  surface={surface}
                  onRequest={handleRequest}
                />
              ))}
            </ScrollView>
          )
      }
    </View>
  );
};

const cp = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerText: { fontSize: 15, fontWeight: '900' },
  offerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  offerBtnText: { fontSize: 12, fontWeight: '800' },
  form: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6, marginBottom: 12 },
  formLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 2 },
  postBtn: { borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  postBtnText: { color: '#000', fontSize: 14, fontWeight: '900' },
  card: { width: 175, borderRadius: 16, padding: 12, borderWidth: 1, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 13, fontWeight: '800' },
  area: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  seatBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
  seatText: { fontSize: 10, fontWeight: '800' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 11 },
  note: { fontSize: 10, lineHeight: 15 },
  requestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingVertical: 7 },
  requestText: { fontSize: 11, fontWeight: '800' },
  ownTag: { borderWidth: 1, borderRadius: 8, padding: 5, alignItems: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
