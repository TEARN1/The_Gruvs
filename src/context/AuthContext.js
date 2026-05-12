import { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { UserManager, clearAllCache, PresenceManager } from '../services/dataFlow';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) setProfile(data);
    } catch (e) {
      console.log('Profile fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Ensure profile row exists for new users
        UserManager.ensureProfile(session.user.id).catch(() => {});
        // Mark online
        PresenceManager.goOnline(session.user.id).catch(() => {});
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        UserManager.ensureProfile(session.user.id).catch(() => {});
        PresenceManager.goOnline(session.user.id).catch(() => {});
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, [fetchProfile]);

  const refreshProfile = useCallback(() => {
    if (user?.id) fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const updateProfile = useCallback(async (updates) => {
    if (!user?.id) return null;
    const result = await UserManager.updateProfile(user.id, updates);
    if (result) setProfile(prev => ({ ...prev, ...result }));
    return result;
  }, [user?.id]);

  const signOut = useCallback(async () => {
    if (user?.id) await PresenceManager.goOffline(user.id).catch(() => {});
    await supabase.auth.signOut();
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
