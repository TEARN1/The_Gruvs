/**
 * WaitlistButton — joins / leaves the waitlist for a sold-out event.
 * When a spot opens (RSVP cancelled), the first person on the waitlist
 * gets an automated 10-minute reservation window with PayFast checkout.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

export const WaitlistButton = ({ eventId, event, primary, muted, surface }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [reservedUntil, setReservedUntil] = useState(null);
  const [isOffered, setIsOffered] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

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
              // Live event_waitlist has only id/event_id/user_id/created_at —
              // status/reserved_until (the "offered spot" flow) aren't in the DB yet.
              .select('id')
              .eq('event_id', eventId)
              .eq('user_id', user?.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (countRes.status === 'fulfilled') setWaitlistCount(countRes.value.count || 0);
      if (userRes.status === 'fulfilled' && userRes.value?.data) {
        setOnWaitlist(true);
        const row = userRes.value.data;
        if (row.status === 'offered' && row.reserved_until) {
          const diffSec = Math.floor((new Date(row.reserved_until).getTime() - Date.now()) / 1000);
          if (diffSec > 0) {
            setIsOffered(true);
            setReservedUntil(row.reserved_until);
            setSecondsRemaining(diffSec);
          }
        }
      } else {
        setOnWaitlist(false);
        setIsOffered(false);
      }
    } catch {}
    finally { setChecking(false); }
  }, [eventId, user]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Countdown timer when offered
  useEffect(() => {
    if (!isOffered || secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsOffered(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOffered, secondsRemaining]);

  // Paid waitlist claims need an "offered" state the database doesn't have yet
  // (event_waitlist has no status/reserved_until), so this can't be reached.
  // It used to send an unpriced, client-chosen amount to PayFast; now it only
  // explains itself if it ever is.
  const claimOfferedSpot = () => {
    toast.show('Claiming a waitlist spot isn\'t available yet. You\'ll be notified.', 'info');
  };

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
          ],
          { attemptsPerTier: 2, baseMs: 300, label: 'Waitlist.leave', fallbackValue: null }
        );
        if (ok === null) throw new Error('leave failed');
        toast.show('Removed from waitlist', 'info');
      } else {
        const ok = await resilient(
          [
            () => supabase.from('event_waitlist').upsert({ event_id: eventId, user_id: user?.id }, { onConflict: 'event_id,user_id', ignoreDuplicates: true }),
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

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (isOffered && secondsRemaining > 0) {
    return (
      <View style={[w.offeredWrap, { borderColor: '#10b981' }]}>
        <View style={w.offeredTop}>
          <Feather name="zap" size={16} color="#10b981" />
          <Text style={w.offeredTitle}>Spot Reserved! Claim in {timeStr}</Text>
        </View>
        <Text style={[w.offeredDesc, { color: muted }]}>
          A spot opened up for you. Complete PayFast checkout before the 10-minute timer expires.
        </Text>
        <TouchableOpacity style={w.claimBtn} onPress={claimOfferedSpot} activeOpacity={0.85}>
          <Feather name="credit-card" size={14} color="#000" />
          <Text style={w.claimBtnText}>Claim Ticket via PayFast</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
    marginBottom: 12,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { fontSize: 12, fontWeight: '700' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  btnText: { fontSize: 12, fontWeight: '800' },
  offeredWrap: {
    padding: 14, borderRadius: 14, borderWidth: 2, backgroundColor: 'rgba(16,185,129,0.1)',
    marginBottom: 12, gap: 8,
  },
  offeredTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offeredTitle: { fontSize: 14, fontWeight: '900', color: '#10b981' },
  offeredDesc: { fontSize: 11, lineHeight: 15 },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 10, marginTop: 4,
  },
  claimBtnText: { color: '#000', fontSize: 13, fontWeight: '900' },
});

export default WaitlistButton;
