/**
 * CarpoolBoard — find or offer a lift to/from an event.
 * Tables: event_carpools, event_carpool_requests
 * Realtime: seat count updates + request status lifecycle
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Modal, Animated, Pressable, FlatList } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

import { useBackClose } from '../hooks/useBackClose';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');

const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12)}:${pad(m)} ${ampm}`;
};

const REQUEST_STATUS = { pending: 'pending', accepted: 'accepted', declined: 'declined' };

const statusMeta = (status, primary) => ({
  pending:  { label: 'Pending',  color: "#f59e0b", icon: 'clock'     },
  accepted: { label: 'Accepted', color: "#22c55e", icon: 'check-circle' },
  declined: { label: 'Declined', color: "#ef4444", icon: 'x-circle'  },
}[status] || { label: 'Request Seat', color: primary, icon: 'send' });

// ─── Time Picker Modal ────────────────────────────────────────────────────────

const TimePicker = ({ visible, value, onConfirm, onClose, primary, surface, textColor, muted }) => {
  useBackClose(visible, onClose);
  const [h, setH] = useState(value ? new Date(value).getHours() : 20);
  const [m, setM] = useState(value ? new Date(value).getMinutes() : 0);

  useEffect(() => {
    if (visible && value) { setH(new Date(value).getHours()); setM(new Date(value).getMinutes()); }
    if (visible && !value) { setH(20); setM(0); }
  }, [visible, value]);

  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 1 : 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
  }, [visible]);

  if (!visible) return null;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins  = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const confirm = () => {
    const d = new Date(); d.setHours(h); d.setMinutes(m); d.setSeconds(0); d.setMilliseconds(0);
    onConfirm(d.toISOString());
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={tp.overlay} onPress={onClose}>
        <Animated.View
          style={[tp.sheet, { backgroundColor: surface, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[tp.title, { color: textColor }]}>Set Departure Time</Text>
          <View style={tp.pickers}>
            {/* Hour scroll */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[tp.label, { color: muted }]}>HOUR</Text>
              <ScrollView style={tp.scroll} showsVerticalScrollIndicator={false}>
                {hours.map(hr => (
                  <TouchableOpacity key={hr} onPress={() => setH(hr)} style={[tp.item, h === hr && { backgroundColor: `${primary}20` }]}>
                    <Text style={[tp.itemText, { color: h === hr ? primary : textColor, fontWeight: h === hr ? '900' : '400' }]}>
                      {((hr % 12) || 12)} {hr >= 12 ? 'PM' : 'AM'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Minute scroll */}
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[tp.label, { color: muted }]}>MINUTE</Text>
              <ScrollView style={tp.scroll} showsVerticalScrollIndicator={false}>
                {mins.map(mn => (
                  <TouchableOpacity key={mn} onPress={() => setM(mn)} style={[tp.item, m === mn && { backgroundColor: `${primary}20` }]}>
                    <Text style={[tp.itemText, { color: m === mn ? primary : textColor, fontWeight: m === mn ? '900' : '400' }]}>
                      :{pad(mn)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <Text style={[tp.preview, { color: primary }]}>
            {((h % 12) || 12)}:{pad(m)} {h >= 12 ? 'PM' : 'AM'}
          </Text>
          <View style={tp.actions}>
            <TouchableOpacity onPress={onClose} style={[tp.btn, { borderColor: `${primary}30` }]}>
              <Text style={[tp.btnText, { color: muted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} style={[tp.btn, { backgroundColor: primary }]}>
              <Text style={[tp.btnText, { color: '#000' }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const tp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 16 },
  pickers: { flexDirection: 'row', gap: 16 },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6 },
  scroll: { height: 160 },
  item: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  itemText: { fontSize: 15 },
  preview: { textAlign: 'center', fontSize: 32, fontWeight: '900', marginVertical: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  btnText: { fontSize: 14, fontWeight: '900' },
});

// ─── OfferCard ────────────────────────────────────────────────────────────────

const OfferCard = React.memo(({ offer, user, primary, textColor, muted, surface, onRequest, onManage }) => {
  const isOwn = offer.driver_id === user?.id;
  const full   = offer.seats_taken >= offer.seats_available;
  const status = offer.my_request_status; // null | 'pending' | 'accepted' | 'declined'
  const meta   = status ? statusMeta(status, primary) : null;
  const seatsLeft = offer.seats_available - offer.seats_taken;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulse = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={[cp.card, { backgroundColor: surface, borderColor: `${primary}20`, transform: [{ scale: scaleAnim }] }]}>
      <View style={cp.cardTop}>
        <View style={[cp.avatar, { backgroundColor: `${primary}25` }]}>
          <Text style={{ color: primary, fontWeight: '900', fontSize: 13 }}>
            {(offer.driver_username || 'D')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cp.driverName, { color: textColor }]}>{offer.driver_username}</Text>
          <Text style={[cp.area, { color: primary }]} numberOfLines={1}>{offer.departure_area}</Text>
        </View>
        <View style={[cp.seatBadge, { backgroundColor: full ? '#ef444422' : `${primary}20`, borderColor: full ? "#ef4444" : primary }]}>
          <Feather name="users" size={10} color={full ? "#ef4444" : primary} />
          <Text style={[cp.seatText, { color: full ? "#ef4444" : primary }]}>{seatsLeft}/{offer.seats_available}</Text>
        </View>
      </View>

      {/* Time + return trip row */}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {!!offer.departure_time && (
          <View style={cp.pill}>
            <Feather name="clock" size={10} color={muted} />
            <Text style={[cp.pillText, { color: muted }]}>{timeLabel(offer.departure_time)}</Text>
          </View>
        )}
        {offer.return_trip && (
          <View style={[cp.pill, { backgroundColor: `${primary}12` }]}>
            <Feather name="repeat" size={10} color={primary} />
            <Text style={[cp.pillText, { color: primary }]}>Return trip</Text>
          </View>
        )}
        {offer.return_time && (
          <View style={cp.pill}>
            <Feather name="corner-down-left" size={10} color={muted} />
            <Text style={[cp.pillText, { color: muted }]}>Back {timeLabel(offer.return_time)}</Text>
          </View>
        )}
      </View>

      {!!offer.note && (
        <Text style={[cp.note, { color: muted }]} numberOfLines={2}>{offer.note}</Text>
      )}

      {/* CTA */}
      {!isOwn && (
        <TouchableOpacity
          style={[cp.requestBtn, {
            backgroundColor: status ? `${meta.color}18` : full ? '#ef444422' : `${primary}20`,
            borderColor: status ? meta.color : full ? "#ef4444" : `${primary}40`,
          }]}
          onPress={() => { if (!full && !status) { pulse(); onRequest(offer); } }}
          disabled={!!status || full}
          activeOpacity={0.8}
        >
          <Feather name={status ? meta.icon : full ? 'x' : 'send'} size={12}
            color={status ? meta.color : full ? "#ef4444" : primary} />
          <Text style={[cp.requestText, { color: status ? meta.color : full ? "#ef4444" : primary }]}>
            {status ? meta.label : full ? 'Full' : 'Request Seat'}
          </Text>
        </TouchableOpacity>
      )}
      {isOwn && (
        <TouchableOpacity
          style={[cp.manageBtn, { borderColor: `${primary}30` }]}
          onPress={onManage}
          activeOpacity={0.8}
        >
          <Feather name="settings" size={11} color={primary} />
          <Text style={[cp.manageBtnText, { color: primary }]}>Manage</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// ─── CarpoolDriverPanel ───────────────────────────────────────────────────────

export const CarpoolDriverPanel = ({ visible, onClose, carpoolId, primary, surface, textColor, muted }) => {
  useBackClose(visible, onClose);
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: visible ? 1 : 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
  }, [visible]);

  const fetchRequests = useCallback(async () => {
    if (!carpoolId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('event_carpool_requests')
        .select('id, rider_id, status, created_at, profiles:rider_id(username, avatar_url)')
        .eq('carpool_id', carpoolId)
        .order('created_at');
      setRequests(data || []);
    } finally {
      setLoading(false);
    }
  }, [carpoolId]);

  useEffect(() => {
    if (visible && carpoolId) fetchRequests();
  }, [visible, carpoolId, fetchRequests]);

  // Realtime updates for this carpool's requests
  useEffect(() => {
    if (!visible || !carpoolId) return;
    const ch = supabase.channel(`driver_panel:${carpoolId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_carpool_requests',
        filter: `carpool_id=eq.${carpoolId}`,
      } , () => fetchRequests())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [visible, carpoolId, fetchRequests]);

  const respondToRequest = async (requestId, action) => {
    const newStatus = action === 'accept' ? REQUEST_STATUS.accepted : REQUEST_STATUS.declined;
    // Optimistic
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
    try {
      const rpc = action === 'accept' ? 'accept_carpool_request' : 'decline_carpool_request';
      const { error } = await supabase.rpc(rpc, { p_request_id: requestId, p_driver_id: user?.id });
      if (error) throw error;
      toast.show(action === 'accept' ? 'Rider accepted!' : 'Request declined', action === 'accept' ? 'success' : 'info');
    } catch {
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: REQUEST_STATUS.pending } : r));
      toast.show('Could not update request', 'error');
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={dp.overlay} onPress={onClose}>
        <Animated.View
          style={[dp.sheet, { backgroundColor: surface, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={dp.handle} />
          <View style={dp.header}>
            <Text style={[dp.title, { color: textColor }]}>Rider Requests</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
          </View>

          {loading
            ? <ActivityIndicator color={primary} style={{ marginVertical: 24 }} />
            : requests.length === 0
              ? <Text style={[dp.empty, { color: muted }]}>No requests yet.</Text>
              : (
                <FlatList
                  data={requests}
                  keyExtractor={r => r.id}
                  renderItem={({ item: req }) => {
                    const meta = statusMeta(req.status, primary);
                    return (
                      <View style={[dp.reqRow, { borderColor: `${primary}15` }]}>
                        <View style={[dp.riderAvatar, { backgroundColor: `${primary}20` }]}>
                          <Text style={{ color: primary, fontWeight: '900' }}>
                            {(req.profiles?.username || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[dp.riderName, { color: textColor }]}>{req.profiles?.username || 'Rider'}</Text>
                          {req.status && req.status !== 'pending' && (
                            <View style={dp.statusRow}>
                              <Feather name={meta.icon} size={11} color={meta.color} />
                              <Text style={[dp.statusText, { color: meta.color }]}>{meta.label}</Text>
                            </View>
                          )}
                        </View>
                        {req.status === REQUEST_STATUS.pending && (
                          <View style={dp.actions}>
                            <TouchableOpacity
                              style={[dp.actionBtn, { backgroundColor: '#22c55e22', borderColor: "#22c55e" }]}
                              onPress={() => respondToRequest(req.id, 'accept')}
                            >
                              <Feather name="check" size={14} color="#22c55e" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[dp.actionBtn, { backgroundColor: '#ef444422', borderColor: "#ef4444" }]}
                              onPress={() => respondToRequest(req.id, 'decline')}
                            >
                              <Feather name="x" size={14} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                />
              )
          }
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const dp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '900' },
  empty: { textAlign: 'center', marginVertical: 24, fontSize: 14 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  riderAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  riderName: { fontSize: 14, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

// ─── CarpoolBoard ─────────────────────────────────────────────────────────────

export const CarpoolBoard = ({ event, primary, textColor, muted, surface }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [offers, setOffers]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [seats, setSeats]             = useState('2');
  const [area, setArea]               = useState('');
  const [note, setNote]               = useState('');
  const [posting, setPosting]         = useState(false);
  const [depTime, setDepTime]         = useState(null);
  const [returnTrip, setReturnTrip]   = useState(false);
  const [returnTime, setReturnTime]   = useState(null);
  const [timePickerOpen, setTimePickerOpen]   = useState(false);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  const [driverPanelOffer, setDriverPanelOffer] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOffers = useCallback(async () => {
    if (!event?.id) return;
    try {
      const { data: offersData } = await supabase
        .from('event_carpools')
        .select('id, driver_id, seats_available, departure_time, profiles:driver_id(username)')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

      if (!offersData) return;

      const ids = offersData.map(o => o.id);

      const [{ data: allReqs }, { data: myReqs }] = await Promise.all([
        supabase.from('event_carpool_requests').select('carpool_id, status').in('carpool_id', ids),
        user
          ? supabase.from('event_carpool_requests').select('carpool_id, status').in('carpool_id', ids).eq('rider_id', user.id)
          : Promise.resolve({ data: [] }),
      ]);

      const taken = {};
      (allReqs || []).forEach(r => {
        if (r.status !== REQUEST_STATUS.declined)
          taken[r.carpool_id] = (taken[r.carpool_id] || 0) + 1;
      });

      const myMap = {};
      (myReqs || []).forEach(r => { myMap[r.carpool_id] = r.status; });

      setOffers(offersData.map(o => ({
        ...o,
        driver_username: o.profiles?.username || 'Vibe',
        seats_taken: taken[o.id] || 0,
        my_request_status: myMap[o.id] || null,
      })));
    } catch {}
    finally { setLoading(false); }
  }, [event?.id, user]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // ── Realtime seat + request updates ──────────────────────────────────────

  useEffect(() => {
    if (!event?.id) return;
    const ch = supabase.channel(`carpool:${event.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_carpools',
        filter: `event_id=eq.${event.id}`,
      } , () => fetchOffers())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_carpool_requests',
        filter: `event_id=eq.${event.id}`,
      } , (payload) => {
        // Fast-path: update just the affected offer's count + current user's status
        const req = payload.new || payload.old;
        if (!req) { fetchOffers(); return; }
        setOffers(prev => prev.map(o => {
          if (o.id !== req.carpool_id) return o;
          // Recalculate seats_taken via current count + delta
          const delta = payload.eventType === 'INSERT' ? 1 : payload.eventType === 'DELETE' ? -1 : 0;
          const myStatus = user && req.rider_id === user.id ? (payload.new?.status || null) : o.my_request_status;
          return { ...o, seats_taken: Math.max(0, o.seats_taken + delta), my_request_status: myStatus };
        }));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [event?.id, user, fetchOffers]);

  // ── Post offer ────────────────────────────────────────────────────────────

  const handlePostOffer = async () => {
    if (!user) { toast.show('Sign in to offer a lift', 'info'); return; }
    if (!area.trim()) { toast.show('Add your departure area', 'info'); return; }
    const s = parseInt(seats, 10);
    if (isNaN(s) || s < 1 || s > 10) { toast.show('Seats must be 1–10', 'info'); return; }
    setPosting(true);
    try {
      const payload = {
        event_id: event.id,
        driver_id: user?.id,
        seats_available: s,
        departure_area: area.trim(),
        departure_time: depTime || null,
        return_trip: returnTrip,
        return_time: returnTrip ? returnTime : null,
        note: note.trim() || null,
      };
      const ok = await resilient(
        [() => supabase.from('event_carpools').insert(payload)],
        { attemptsPerTier: 2, baseMs: 400, label: 'Carpool.post' }
      );
      if (ok === null) throw new Error();
      toast.show('Lift offer posted!', 'success');
      setShowForm(false);
      setArea(''); setNote(''); setSeats('2'); setDepTime(null); setReturnTrip(false); setReturnTime(null);
      fetchOffers();
    } catch {
      toast.show('Could not post offer. Try again.', 'error');
    } finally { setPosting(false); }
  };

  // ── Request seat ──────────────────────────────────────────────────────────

  const handleRequest = async (offer) => {
    if (!user) { toast.show('Sign in to request a seat', 'info'); return; }
    // Optimistic
    setOffers(prev => prev.map(o => o.id === offer.id
      ? { ...o, my_request_status: REQUEST_STATUS.pending, seats_taken: o.seats_taken + 1 }
      : o
    ));
    try {
      const ok = await resilient(
        [() => supabase.from('event_carpool_requests').insert({
          carpool_id: offer.id, rider_id: user?.id, event_id: event.id, status: REQUEST_STATUS.pending,
        })],
        { attemptsPerTier: 2, baseMs: 400, label: 'Carpool.request' }
      );
      if (ok === null) throw new Error();
      toast.show(`Seat requested from ${offer.driver_username}!`, 'success');
    } catch {
      setOffers(prev => prev.map(o => o.id === offer.id
        ? { ...o, my_request_status: null, seats_taken: Math.max(0, o.seats_taken - 1) }
        : o
      ));
      toast.show('Could not request seat. Try again.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={cp.container}>
      {/* Header */}
      <View style={cp.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Feather name="navigation" size={14} color={primary} />
          <Text style={[cp.headerText, { color: textColor }]}>Carpool Board</Text>
        </View>
        {user && (
          <TouchableOpacity
            style={[cp.offerBtn, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}
            onPress={() => {
              if (showForm) { setArea(''); setNote(''); setSeats('2'); setDepTime(null); setReturnTrip(false); setReturnTime(null); }
              setShowForm(v => !v);
            }}
            activeOpacity={0.8}
          >
            <Feather name={showForm ? 'x' : 'plus'} size={13} color={primary} />
            <Text style={[cp.offerBtnText, { color: primary }]}>{showForm ? 'Cancel' : 'Offer Lift'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Offer form */}
      {showForm && (
        <View style={[cp.form, { backgroundColor: surface, borderColor: `${primary}25` }]}>
          <Text style={[cp.formLabel, { color: muted }]}>DEPARTURE AREA *</Text>
          <TextInput
            value={area} onChangeText={setArea}
            placeholder="e.g. Sandton, Rosebank" placeholderTextColor={muted}
            style={[cp.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}
          />

          <Text style={[cp.formLabel, { color: muted }]}>DEPARTURE TIME</Text>
          <TouchableOpacity
            style={[cp.input, { borderColor: `${primary}30`, backgroundColor: `${primary}08`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => setTimePickerOpen(true)} activeOpacity={0.8}
          >
            <Text style={{ color: depTime ? textColor : muted, fontSize: 14 }}>
              {depTime ? timeLabel(depTime) : 'Tap to set time'}
            </Text>
            <Feather name="clock" size={15} color={primary} />
          </TouchableOpacity>

          <Text style={[cp.formLabel, { color: muted }]}>SEATS AVAILABLE</Text>
          <TextInput
            value={seats} onChangeText={setSeats} keyboardType="number-pad" maxLength={2}
            style={[cp.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08`, width: 80 }]}
          />

          {/* Return trip toggle */}
          <TouchableOpacity
            style={[cp.toggleRow, { borderColor: `${primary}20` }]}
            onPress={() => setReturnTrip(v => !v)} activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[cp.toggleLabel, { color: textColor }]}>Return trip?</Text>
              <Text style={[cp.toggleSub, { color: muted }]}>I'll also drive riders back</Text>
            </View>
            <View style={[cp.toggle, { backgroundColor: returnTrip ? primary : `${primary}20` }]}>
              <View style={[cp.toggleThumb, { left: returnTrip ? 18 : 2 }]} />
            </View>
          </TouchableOpacity>

          {returnTrip && (
            <>
              <Text style={[cp.formLabel, { color: muted }]}>RETURN TIME</Text>
              <TouchableOpacity
                style={[cp.input, { borderColor: `${primary}30`, backgroundColor: `${primary}08`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setReturnPickerOpen(true)} activeOpacity={0.8}
              >
                <Text style={{ color: returnTime ? textColor : muted, fontSize: 14 }}>
                  {returnTime ? timeLabel(returnTime) : 'Tap to set return time'}
                </Text>
                <Feather name="corner-down-left" size={15} color={primary} />
              </TouchableOpacity>
            </>
          )}

          <Text style={[cp.formLabel, { color: muted }]}>NOTE (optional)</Text>
          <TextInput
            value={note} onChangeText={setNote}
            placeholder="Any extra info for riders..." placeholderTextColor={muted}
            multiline numberOfLines={2}
            style={[cp.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}08`, minHeight: 56 }]}
          />

          <TouchableOpacity
            style={[cp.postBtn, { backgroundColor: primary, opacity: posting ? 0.6 : 1 }]}
            onPress={handlePostOffer} disabled={posting} activeOpacity={0.85}
          >
            {posting ? <ActivityIndicator size="small" color="#000" />
              : <Text style={cp.postBtnText}>Post Offer</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Offer list */}
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
                  onManage={() => setDriverPanelOffer(offer)}
                />
              ))}
            </ScrollView>
          )
      }

      {/* Time pickers */}
      <TimePicker
        visible={timePickerOpen} value={depTime}
        onConfirm={v => { setDepTime(v); setTimePickerOpen(false); }}
        onClose={() => setTimePickerOpen(false)}
        primary={primary} surface={surface} textColor={textColor} muted={muted}
      />
      <TimePicker
        visible={returnPickerOpen} value={returnTime}
        onConfirm={v => { setReturnTime(v); setReturnPickerOpen(false); }}
        onClose={() => setReturnPickerOpen(false)}
        primary={primary} surface={surface} textColor={textColor} muted={muted}
      />

      {/* Driver panel */}
      <CarpoolDriverPanel
        visible={!!driverPanelOffer}
        carpoolId={driverPanelOffer?.id}
        onClose={() => setDriverPanelOffer(null)}
        primary={primary} surface={surface} textColor={textColor} muted={muted}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cp = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerText: { fontSize: 15, fontWeight: '900' },
  offerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  offerBtnText: { fontSize: 12, fontWeight: '800' },
  form: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6, marginBottom: 12 },
  formLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleSub: { fontSize: 11, marginTop: 1 },
  toggle: { width: 40, height: 22, borderRadius: 11, justifyContent: 'center', position: 'relative' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', position: 'absolute' },
  postBtn: { borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  postBtnText: { color: '#000', fontSize: 14, fontWeight: '900' },
  card: { width: 190, borderRadius: 16, padding: 12, borderWidth: 1, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 13, fontWeight: '800' },
  area: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  seatBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
  seatText: { fontSize: 10, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, backgroundColor: '#ffffff08' },
  pillText: { fontSize: 10 },
  note: { fontSize: 10, lineHeight: 15 },
  requestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingVertical: 7 },
  requestText: { fontSize: 11, fontWeight: '800' },
  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingVertical: 7 },
  manageBtnText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
