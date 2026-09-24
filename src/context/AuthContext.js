import { createContext, useState, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { UserManager, clearAllCache, PresenceManager, hydrateCacheFromDisk } from '../services/dataFlow';
import { SecurityService } from '../services/securityService';
import { claimPendingRef } from '../services/referral';

// Explicit field list — never use select('*') to avoid leaking private columns
const PROFILE_FIELDS = 'id, username, display_name, avatar_url, bio, vibe_score, is_verified, is_online, last_seen, identity_mode, is_beacon_active, beacon_expires_at, beacon_intent, is_discoverable, push_token, interests, location, career_title, career_description, looks_description, profile_gallery, share_events, show_online, gender, referral_code';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession]   = useState(null);
  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  // True while the user arrived via a password-reset link — App shows the
  // "set a new password" screen until they finish (or cancel).
  const [recoveryMode, setRecoveryMode] = useState(false);
  // Track last fetched userId to avoid redundant profile fetches on token refresh
  const lastFetchedUserId = useRef(null);

  const fetchProfile = useCallback(async (userId, force = false) => {
    if (!userId) return;
    // Skip if same user and not forced — token refreshes fire this with same userId
    if (!force && lastFetchedUserId.current === userId) return;
    lastFetchedUserId.current = userId;
    try {
      // Prefer the self-only RPC: it returns the caller's OWN full row (incl.
      // push_token and other columns that `authenticated` is being locked out
      // of for OTHER users — see lock_authenticated_pii.sql). If the RPC isn't
      // deployed yet it 404s and we fall back to the direct select, so this is
      // safe to ship before the migration lands.
      let data = null;
      const rpc = await supabase.rpc('get_my_profile').maybeSingle();
      if (!rpc.error && rpc.data) {
        data = rpc.data;
      } else {
        const sel = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).single();
        data = sel.data;
      }
      if (data) setProfile(data);
    } catch {
      // Profile fetch failure is non-fatal — user can still navigate
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      // Warm the data cache from disk BEFORE releasing the user to the tree.
      // Screens load their data the moment `user` is set, so hydrating after
      // that point loses the race and the cold open stays cold. Raced against a
      // short timeout for the same reason the safe-mode gate in App.js is: a
      // storage read must never be able to hang sign-in. Losing the race just
      // means a normal cold load — the behaviour we had before this existed.
      await Promise.race([
        hydrateCacheFromDisk(s?.user?.id ?? null),
        new Promise((r) => setTimeout(r, 300)),
      ]).catch(() => {});
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
        UserManager.ensureProfile(s.user.id).catch(() => {});
        PresenceManager.goOnline(s.user.id).catch(() => {});
      } else {
        setLoading(false);
      }
    }).catch(() => { if (mounted) setLoading(false); });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      // Arrived through a reset link → show the set-new-password screen.
      if (_event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      const newUserId = s?.user?.id ?? null;
      const prevUserId = lastFetchedUserId.current;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Only re-fetch profile when the user ID actually changes
        if (newUserId !== prevUserId) {
          fetchProfile(newUserId, true);
          // Attribution has to wait for the profile row to exist, so it chains
          // off ensureProfile rather than racing it. Best-effort by design: a
          // failed claim must never block someone getting into the app.
          UserManager.ensureProfile(newUserId)
            .then(() => claimPendingRef())
            .catch(() => {});
          PresenceManager.goOnline(newUserId).catch(() => {});
        }
      } else {
        lastFetchedUserId.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // Password-reset return (web): the recovery link comes back with the tokens
  // in the URL hash. detectSessionInUrl is false, so establish the session
  // ourselves, flag recovery, and scrub the tokens from the address bar.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    if (!hash.includes('type=recovery')) return;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token })
        .then(() => setRecoveryMode(true))
        .catch(() => {});
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* noop */ }
    }
  }, []);

  // Session monitor — verify token every 10 min and refresh if stale
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const isValid = await SecurityService.validateSession();
      if (!isValid) {
        console.warn('[Shield] Session expired — refreshing...');
        supabase.auth.refreshSession().catch(() => {});
      }
    } , 10 * 60 * 1000);
    return () => clearInterval(interval); // ← always cleared on unmount/user-change
  }, [user]);

  const refreshProfile = useCallback(() => {
    if (user?.id) fetchProfile(user.id, true);
  }, [user?.id, fetchProfile]);

  const updateProfile = useCallback(async (updates) => {
    if (!user?.id) return null;
    const result = await UserManager.updateProfile(user.id, updates);
    if (result) setProfile(prev => ({ ...prev, ...result }));
    return result;
  }, [user?.id]);

  const signOut = useCallback(async () => {
    if (user?.id) {
      await PresenceManager.goOffline(user.id).catch(() => {});
      SecurityService.logSecurityEvent(user.id, 'AUTH_SIGNOUT');
    }
    lastFetchedUserId.current = null;
    await supabase.auth.signOut().catch(() => {});
    clearAllCache();
    setUser(null);
    setProfile(null);
    setSession(null);
  }, [user?.id]);

  const endRecovery = useCallback(() => setRecoveryMode(false), []);

  const value = useMemo(() => ({
    session, user, profile, loading, recoveryMode, endRecovery,
    signOut, refreshProfile, updateProfile,
  }), [session, user, profile, loading, recoveryMode, endRecovery, signOut, refreshProfile, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
