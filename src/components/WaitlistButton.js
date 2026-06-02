/**
 * WaitlistButton — joins / leaves the waitlist for a sold-out event.
 * When a spot opens (RSVP cancelled), the first person on the waitlist
 * gets a push notification via the existing _notify infrastructure.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

export const WaitlistButton = ({ eventId, primary, muted, surface }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!eventId) return;
    try {
      const [countRes, userRes] = await Promise.allSettled([
        supabase
          .from('event_waitlist')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId),
        user
          ? supabase
              .from('event_waitlist')
              .select('id')
              .eq('event_id', eventId)
              .eq('user_id', user?.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (countRes.status === 'fulfilled') setWaitlistCount(countRes.value.count || 0);
      if (userRes.status === 'fulfilled') setOnWaitlist(!!userRes.value?.data);
    } catch {}
    finally { setChecking(false); }
  }, [eventId, user]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const toggle = async () => {
    if (!user) { toast.show('Sign in to join the waitlist', 'info'); return; }
    if (loading) return;
    const wasOn = onWaitlist;
    setOnWaitlist(!wasOn);
    setWaitlistCount(c => wasOn ? Math.max(0, c - 1) : c + 1);
    setLoading(true);
    try {
      if (wasOn) {
        const ok = await resilient(
          [
            () => supabase.from('event_waitlist').delete().eq('event_id', eventId).eq('user_id', user?.id),
            () => supabase.from('event_waitlist').update({ left_at: new Date().toISOString() }).eq('event_id', eventId).eq('user_id', user?.id),
          ],
          { attemptsPerTier: 2, baseMs: 300, label: 'Waitlist.leave', fallbackValue: null }
        );
        if (ok === null) throw new Error('leave failed');
        toast.show('Removed from waitlist', 'info');
      } else {
        const ok = await resilient(
          [
            () => supabase.from('event_waitlist').upsert({ event_id: eventId, user_id: user?.id, joined_at: new Date().toISOString() }, { onConflict: 'event_id,user_id', ignoreDuplicates: true }),
            () => supabase.from('event_waitlist').insert({ event_id: eventId, user_id: user?.id }),
          ],
          { attemptsPerTier: 2, baseMs: 300, label: 'Waitlist.join', fallbackValue: null }
        );
        if (ok === null) throw new Error('join failed');
        toast.show("You're on the waitlist! We'll notify you if a spot opens.", 'success');
      }
    } catch {
      setOnWaitlist(wasOn);
      setWaitlistCount(c => wasOn ? c + 1 : Math.max(0, c - 1));
      toast.show('Could not update waitlist. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <View style={[w.wrap, { backgroundColor: `${primary}08`, borderColor: `${primary}20` }]}>
      <View style={w.info}>
        <Feather name="users" size={14} color={primary} />
        <Text style={[w.countText, { color: primary }]}>
          {waitlistCount} {waitlistCount === 1 ? 'person' : 'people'} waiting
        </Text>
      </View>
      <TouchableOpacity
        style={[w.btn, { backgroundColor: onWaitlist ? `${primary}20` : primary, borderColor: primary }]}
        onPress={toggle}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator size="small" color={onWaitlist ? primary : '#000'} />
          : <>
              <Feather name={onWaitlist ? 'bell-off' : 'bell'} size={13} color={onWaitlist ? primary : '#000'} />
              <Text style={[w.btnText, { color: onWaitlist ? primary : '#000' }]}>
                {onWaitlist ? 'Leave Waitlist' : 'Join Waitlist'}
              </Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
};

const w = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { fontSize: 13, fontWeight: '700' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  btnText: { fontSize: 12, fontWeight: '900' },
});
