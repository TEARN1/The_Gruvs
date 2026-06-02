/**
 * VIPTierSelector — tiered RSVP (General / VIP / Table) for events.
 * Tiers are stored in event.rsvp_tiers (JSONB array):
 *   [{ id, name, description, price, capacity, icon, color }]
 * When no tiers are configured the component renders nothing.
 * Booking is stored in event_rsvps with a tier_id column.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const TIER_ICONS = {
  general: 'users',
  vip:     'star',
  table:   'layout',
  vvip:    'award',
  backstage: 'mic',
};

export const VIPTierSelector = ({ event, primary, textColor, muted, surface, onBooked }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [myTierId, setMyTierId] = useState(null);
  const [tierCounts, setTierCounts] = useState({});
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(false);
  const [loading, setLoading] = useState(true);

  const tiers = event?.rsvp_tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) return null;

  const fetchTierData = useCallback(async () => {
    if (!event?.id) return;
    try {
      const [countRes, myRes] = await Promise.allSettled([
        supabase.from('event_rsvps').select('tier_id').eq('event_id', event.id).in('status', ['going', 'maybe']),
        user ? supabase.from('event_rsvps').select('tier_id').eq('event_id', event.id).eq('user_id', user?.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (countRes.status === 'fulfilled' && countRes.value.data) {
        const counts = {};
        countRes.value.data.forEach(r => { if (r.tier_id) counts[r.tier_id] = (counts[r.tier_id] || 0) + 1; });
        setTierCounts(counts);
      }
      if (myRes.status === 'fulfilled' && myRes.value?.data) {
        setMyTierId(myRes.value.data.tier_id);
        setSelected(myRes.value.data.tier_id);
      }
    } catch {}
    finally { setLoading(false); }
  }, [event?.id, user]);

  useEffect(() => { fetchTierData(); }, [fetchTierData]);

  const bookTier = async (tier) => {
    if (!user) { toast.show('Sign in to book a tier', 'info'); return; }
    if (booking) return;
    if (myTierId === tier.id) { toast.show(`Already booked: ${tier.name}`, 'info'); return; }
    setBooking(true);
    const prevTier = myTierId;
    setMyTierId(tier.id);
    setSelected(tier.id);
    setTierCounts(prev => ({
      ...prev,
      [tier.id]: (prev[tier.id] || 0) + 1,
      ...(prevTier ? { [prevTier]: Math.max(0, (prev[prevTier] || 1) - 1) } : {}),
    }));
    try {
      const ok = await resilient(
        [
          () => supabase.from('event_rsvps').upsert(
            { event_id: event.id, user_id: user?.id, status: 'going', tier_id: tier.id },
            { onConflict: 'event_id,user_id' }
          ),
          () => supabase.rpc('upsert_rsvp_tier', { p_event_id: event.id, p_user_id: user?.id, p_tier_id: tier.id }),
        ],
        { attemptsPerTier: 2, baseMs: 400, label: `VIPTier.book:${tier.id}`, fallbackValue: null }
      );
      if (ok === null) throw new Error('booking failed');
      toast.show(`${tier.name} booked! ${tier.price > 0 ? `R${tier.price}` : 'Free'}`, 'success');
      onBooked?.(tier);
    } catch {
      setMyTierId(prevTier);
      setSelected(prevTier);
      setTierCounts(prev => ({
        ...prev,
        [tier.id]: Math.max(0, (prev[tier.id] || 1) - 1),
        ...(prevTier ? { [prevTier]: (prev[prevTier] || 0) + 1 } : {}),
      }));
      toast.show('Could not book tier. Try again.', 'error');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return null;

  return (
    <View style={vt.container}>
      <Text style={[vt.header, { color: muted }]}>CHOOSE YOUR EXPERIENCE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {tiers.map(tier => {
          const isActive = myTierId === tier.id;
          const isSoldOut = tier.capacity > 0 && (tierCounts[tier.id] || 0) >= tier.capacity;
          const spotsLeft = tier.capacity > 0 ? tier.capacity - (tierCounts[tier.id] || 0) : null;
          const tierColor = tier.color || primary;
          const icon = TIER_ICONS[tier.id?.toLowerCase()] || TIER_ICONS[tier.name?.toLowerCase()] || 'tag';

          return (
            <TouchableOpacity
              key={tier.id}
              onPress={() => !isSoldOut && bookTier(tier)}
              disabled={isSoldOut || booking}
              activeOpacity={0.8}
              style={[
                vt.card,
                {
                  backgroundColor: isActive ? `${tierColor}20` : `${surface}`,
                  borderColor: isActive ? tierColor : `${tierColor}30`,
                  borderWidth: isActive ? 2 : 1,
                  opacity: isSoldOut ? 0.5 : 1,
                },
              ]}
            >
              {isActive && (
                <View style={[vt.activeBadge, { backgroundColor: tierColor }]}>
                  <Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>YOURS</Text>
                </View>
              )}
              <View style={[vt.iconWrap, { backgroundColor: `${tierColor}20` }]}>
                <Feather name={icon} size={20} color={tierColor} />
              </View>
              <Text style={[vt.tierName, { color: isActive ? tierColor : textColor }]}>{tier.name}</Text>
              {!!tier.description && (
                <Text style={[vt.tierDesc, { color: muted }]} numberOfLines={2}>{tier.description}</Text>
              )}
              <Text style={[vt.price, { color: tierColor }]}>
                {tier.price > 0 ? `R${tier.price}` : 'Free'}
              </Text>
              {spotsLeft !== null && (
                <Text style={[vt.spots, { color: spotsLeft <= 5 ? "#ef4444" : muted }]}>
                  {isSoldOut ? 'Sold Out' : `${spotsLeft} left`}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const vt = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  card: {
    width: 130, borderRadius: 16, padding: 14, gap: 6,
    position: 'relative', overflow: 'hidden',
  },
  activeBadge: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 7, paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tierName: { fontSize: 14, fontWeight: '900' },
  tierDesc: { fontSize: 10, lineHeight: 14 },
  price: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  spots: { fontSize: 10, fontWeight: '700' },
});
