/**
 * IdentityContext — Global identity mode manager.
 * Three modes:
 *   'public'    — Full profile visible, location accurate.
 *   'ghost'     — Alias shown, location fuzzed by ~500m, can see others but appears as ghost.
 *   'celebrity' — Read-only gallery access. Can see everyone. Only visible if they "Drop a Beacon."
 *
 * The Current_Identity_State is checked before rendering any social component.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'gruv_identity_mode';

const MODES = {
  public: {
    key: 'public',
    label: 'Public',
    icon: 'eye',
    color: '#10b981',
    description: 'Full profile visible. You appear in Who Was There.',
  },
  ghost: {
    key: 'ghost',
    label: 'Ghost',
    icon: 'eye-off',
    color: '#8b5cf6',
    description: 'You appear as an alias. Location fuzzed by 500m.',
  },
  celebrity: {
    key: 'celebrity',
    label: 'Celebrity',
    icon: 'star',
    color: '#f59e0b',
    description: 'Read-only. You see everyone but stay invisible unless you Drop a Beacon.',
  },
};

// Fuzz coordinates by up to 500m in a random direction
export const fuzzLocation = (lat, lon, radiusMeters = 500) => {
  const earthRadius = 6371000;
  const angle = Math.random() * 2 * Math.PI;
  const dist  = Math.random() * radiusMeters;
  const dLat  = (dist * Math.cos(angle)) / earthRadius;
  const dLon  = (dist * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
  return {
    lat: lat + dLat * (180 / Math.PI),
    lon: lon + dLon * (180 / Math.PI),
  };
};

// Generate consistent alias for ghost mode (deterministic from userId)
export const getGhostAlias = (userId = '') => {
  const adjectives = ['Shadow', 'Mystic', 'Phantom', 'Neon', 'Silent', 'Blazing', 'Cosmic', 'Lunar'];
  const nouns      = ['Mover', 'Viber', 'Ghost', 'Runner', 'Signal', 'Pulse', 'Echo', 'Trace'];
  const hash       = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `${adjectives[hash % adjectives.length]}${nouns[(hash >> 2) % nouns.length]}`;
};

const IdentityContext = createContext(null);

export const IdentityProvider = ({ children }) => {
  const [identityMode, setIdentityModeState] = useState('public');
  const [beaconActive, setBeaconActive]       = useState(false); // celebrity "Drop a Beacon"
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => { if (val && MODES[val]) setIdentityModeState(val); })
      .finally(() => setLoading(false));
  }, []);

  const setIdentityMode = useCallback(async (mode) => {
    if (!MODES[mode]) return;
    setIdentityModeState(mode);
    if (mode !== 'celebrity') setBeaconActive(false);
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const dropBeacon = useCallback(() => {
    if (identityMode === 'celebrity') setBeaconActive(true);
  }, [identityMode]);

  const retractBeacon = useCallback(() => setBeaconActive(false), []);

  // Middleware: apply identity rules to a location before exposing it
  const applyLocationPrivacy = useCallback((lat, lon) => {
    if (identityMode === 'ghost') return fuzzLocation(lat, lon, 500);
    if (identityMode === 'celebrity') return null; // never expose celebrity location
    return { lat, lon };
  }, [identityMode]);

  // Middleware: apply identity rules to a profile object before rendering
  const applyProfilePrivacy = useCallback((profile, userId) => {
    if (identityMode === 'ghost') {
      return {
        ...profile,
        username: getGhostAlias(userId),
        avatar_url: null,
        real_name: null,
        _isGhost: true,
      };
    }
    if (identityMode === 'celebrity' && !beaconActive) {
      return null; // don't render celebrity in social lists unless beacon dropped
    }
    return profile;
  }, [identityMode, beaconActive]);

  // Can this user be seen in social lists?
  const isVisible = useCallback(() => {
    if (identityMode === 'celebrity') return beaconActive;
    return true; // public and ghost both appear (ghost with alias)
  }, [identityMode, beaconActive]);

  const value = useMemo(() => ({
    identityMode,
    modeConfig: MODES[identityMode],
    allModes: MODES,
    beaconActive,
    loading,
    setIdentityMode,
    dropBeacon,
    retractBeacon,
    applyLocationPrivacy,
    applyProfilePrivacy,
    isVisible,
    getGhostAlias,
  }), [identityMode, beaconActive, loading, setIdentityMode, dropBeacon, retractBeacon, applyLocationPrivacy, applyProfilePrivacy, isVisible]);

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
};

export const useIdentity = () => {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used within IdentityProvider');
  return ctx;
};
