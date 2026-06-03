import { createContext, useState, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { UserManager, clearAllCache, PresenceManager } from '../services/dataFlow';
import { SecurityService } from '../services/securityService';

// Explicit field list — never use select('*') to avoid leaking private columns
const PROFILE_FIELDS = 'id, username, display_name, avatar_url, bio, vibe_score, is_verified, is_online, last_seen, identity_mode, is_beacon_active, is_discoverable, push_token, interests, location, career_title, career_description, looks_description, profile_gallery, share_events, show_online, gender';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession]   = useState(null);
  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  // Track last fetched userId to avoid redundant profile fetches on token refresh
  const lastFetchedUserId = useRef(null);

  const fetchProfile = useCallback(async (userId, force = false) => {
    if (!userId) return;
    // Skip if same user and not forced — token refreshes fire this with same userId
    if (!force && lastFetchedUserId.current === userId) return;
    lastFetchedUserId.current = userId;
    try {
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .eq('id', userId)
        .single();
      if (data) setProfile(data);
    } catch {
      // Profile fetch failure is non-fatal — user can still navigate
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
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
      const newUserId = s?.user?.id ?? null;
      const prevUserId = lastFetchedUserId.current;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Only re-fetch profile when the user ID actually changes
        if (newUserId !== prevUserId) {
          fetchProfile(newUserId, true);
          UserManager.ensureProfile(newUserId).catch(() => {});
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

  const value = useMemo(() => ({
    session, user, profile, loading,
    signOut, refreshProfile, updateProfile,
  }), [session, user, profile, loading, signOut, refreshProfile, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
