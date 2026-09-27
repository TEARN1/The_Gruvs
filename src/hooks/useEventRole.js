/**
 * useEventRole — resolves the calling user's role for a given event.
 * Returns role metadata used to gate all co-management UI across the app.
 *
 * Hierarchy:
 *   organiser  > co_host  > moderator / scanner / vip_manager  > attendee
 *
 * Usage:
 *   const { isOrganiser, canPost, canModerate, role } = useEventRole(eventId, userId, organiserId);
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const ROLE_CACHE = new Map(); // eventId:userId → { role, ts }
const CACHE_TTL = 60_000;    // 1 minute

export const useEventRole = (eventId, userId, organiserId) => {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  const isOrganiser = !!(userId && organiserId && userId === organiserId);

  useEffect(() => {
    if (!eventId || !userId) { setLoading(false); return; }
    if (isOrganiser) { setLoading(false); return; }

    const cacheKey = `${eventId}:${userId}`;
    const cached = ROLE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setRole(cached.role);
      setLoading(false);
    }

    let cancelled = false;
    const fetchRole = async () => {
      const { data } = await supabase
        .from('event_roles')
        .select('role')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!cancelled) {
        const r = data?.role ?? null;
        setRole(r);
        setLoading(false);
        ROLE_CACHE.set(cacheKey, { role: r, ts: Date.now() });
      }
    };

    fetchRole();

    // Subscribe to role changes for this event (e.g. when organiser grants a role live)
    channelRef.current = supabase
      .channel(`event_roles:${eventId}:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_roles',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        if (payload.new?.user_id === userId || payload.old?.user_id === userId) {
          ROLE_CACHE.delete(cacheKey);
          fetchRole();
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [eventId, userId, isOrganiser]);

  const derived = {
    role,
    loading,
    isOrganiser,
    // Co-host has nearly full organiser powers
    isCoHost:      isOrganiser || role === 'co_host',
    // Moderator can manage chat + check-in requests
    isModerator:   isOrganiser || role === 'co_host' || role === 'moderator',
    // Can post updates, polls, announcements
    canPost:       isOrganiser || role === 'co_host',
    // Can delete chat messages, pin, manage carpool requests
    canModerate:   isOrganiser || role === 'co_host' || role === 'moderator',
    // Can mark ticket scan / check-ins
    canScan:       isOrganiser || role === 'co_host' || role === 'scanner',
    // Can manage VIP tier approvals
    canManageVIP:  isOrganiser || role === 'co_host' || role === 'vip_manager',
    // Any elevated role
    hasRole:       isOrganiser || !!role,
  };

  return derived;
};

/** Invalidate the role cache for an event (call after granting/revoking roles) */
export const invalidateEventRoleCache = (eventId) => {
  for (const key of ROLE_CACHE.keys()) {
    if (key.startsWith(`${eventId}:`)) ROLE_CACHE.delete(key);
  }
};
