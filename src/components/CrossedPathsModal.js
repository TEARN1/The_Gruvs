/**
 * CrossedPathsModal — "People you keep touching down with."
 *
 * Opened from the Touch Down button. Shows everyone who has checked in at the
 * same events/venues as the current user across their check-in history,
 * ranked from the person they've crossed paths with the MOST to the least.
 *
 * Data comes from CheckInManager.getCrossedPaths (server RPC with a client-side
 * aggregation fallback). Ghost-mode check-ins are excluded by the service;
 * remaining profiles still pass through identity privacy here for safety.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SmartImage } from './SmartImage';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckInManager, isOnline as checkOnline } from '../services/dataFlow';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { DirectMessageModal } from './DirectMessageModal';
import { ViberProfileModal } from './ViberProfileModal';
import { useBackClose } from '../hooks/useBackClose';

const avatarBg = (u = '') =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][(u.charCodeAt(0) || 0) % 5];

const MEDALS = ['🥇', '🥈', '🥉'];

const fmtAge = (ts) => {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
};

export function CrossedPathsModal({ visible, onClose, userId, onAuthRequired }) {
  useBackClose(visible, onClose);
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { applyProfilePrivacy } = useIdentity();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const surface   = currentTheme?.surface    || '#1a1f21';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);
  const [msgTarget,     setMsgTarget]     = useState(null);
  const [msgVisible,    setMsgVisible]    = useState(false);
  const [selectedViber, setSelectedViber] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);

  const load = useCallback(async () => {
    const uid = userId || user?.id;
    if (!uid) { onAuthRequired?.(); return; }
    setLoading(true);
    try {
      const rows = await CheckInManager.getCrossedPaths(uid, { limit: 50 });
      const visible = (rows || [])
        .map(r => {
          const priv = applyProfilePrivacy(r, r.id);
          return priv ? { ...r, ...priv } : null;
        })
        .filter(Boolean);
      setResults(visible);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [userId, user?.id, applyProfilePrivacy, onAuthRequired]);

  // Load fresh each time the sheet opens; reset when it closes.
  useEffect(() => {
    if (visible) {
      load();
    } else {
      setResults([]);
      setLoaded(false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.screen, { backgroundColor: bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={20} color={textColor} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: textColor }]}>Crossed Paths</Text>
            <Text style={[s.sub, { color: muted }]}>People you keep touching down with</Text>
          </View>
          {loaded && !loading && (
            <TouchableOpacity onPress={load} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="rotate-ccw" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={{ color: muted, fontSize: 13 }}>Tracing your footprints…</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={s.empty}>
            <Feather name="users" size={44} color={muted} style={{ opacity: 0.4 }} />
            <Text style={[s.emptyTitle, { color: textColor }]}>No crossed paths yet</Text>
            <Text style={[s.emptySub, { color: muted }]}>
              Touch Down at more Gruvs and the Vibers you keep running into will show up here —
              ranked from who you cross most to least.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            <Text style={[s.resultHeader, { color: muted }]}>
              {results.length} {results.length === 1 ? 'Viber crosses' : 'Vibers cross'} your path · most → least
            </Text>
            {results.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[s.row, { backgroundColor: surface, borderColor: idx < 3 ? `${primary}45` : 'rgba(255,255,255,0.06)' }]}
                onPress={() => { setSelectedViber(item); setProfileVisible(true); }}
                activeOpacity={0.82}
              >
                {/* Rank */}
                <View style={s.rankWrap}>
                  {idx < 3
                    ? <Text style={s.medal}>{MEDALS[idx]}</Text>
                    : <Text style={[s.rankNum, { color: muted }]}>{idx + 1}</Text>}
                </View>

                {/* Avatar */}
                <View style={{ position: 'relative' }}>
                  {item.avatar_url
                    ? <SmartImage source={item.avatar_url} style={s.avatar} />
                    : <View style={[s.avatar, { backgroundColor: avatarBg(item.username), alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                          {(item.username || 'V')[0].toUpperCase()}
                        </Text>
                      </View>}
                  {checkOnline(item) && <View style={[s.onlineDot, { borderColor: surface }]} />}
                </View>

                {/* Details */}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.username, { color: textColor }]} numberOfLines={1}>
                      {item.display_name || `${item.username}`}
                    </Text>
                    {item.is_verified && <Feather name="check-circle" size={11} color={primary} />}
                  </View>
                  {item.venues?.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="map-pin" size={9} color="#f97316" />
                      <Text style={[s.venues, { color: '#f97316' }]} numberOfLines={1}>
                        {item.venues.slice(0, 2).join(' · ')}{item.venues.length > 2 ? ` +${item.venues.length - 2}` : ''}
                      </Text>
                    </View>
                  )}
                  {item.lastCrossedAt && (
                    <Text style={[s.lastSeen, { color: muted }]}>Last crossed {fmtAge(item.lastCrossedAt)}</Text>
                  )}
                </View>

                {/* Crossing count + message */}
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[s.crossPill, { backgroundColor: `${primary}1e`, borderColor: `${primary}45` }]}>
                    <Text style={[s.crossNum, { color: primary }]}>{item.crossings}×</Text>
                    <Text style={[s.crossLabel, { color: primary }]}>crossed</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.msgBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
                    onPress={() => { setMsgTarget(item); setMsgVisible(true); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="message-circle" size={15} color={primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <ViberProfileModal
        visible={profileVisible}
        user={selectedViber}
        userId={selectedViber?.id}
        onClose={() => setProfileVisible(false)}
      />

      {msgVisible && msgTarget && (
        <DirectMessageModal
          visible={msgVisible}
          onClose={() => { setMsgVisible(false); setMsgTarget(null); }}
          recipient={msgTarget}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  resultHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 4, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 18, padding: 12,
    marginHorizontal: 16, marginBottom: 8,
  },
  rankWrap: { width: 24, alignItems: 'center' },
  medal: { fontSize: 18 },
  rankNum: { fontSize: 14, fontWeight: '900' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#10b981', borderWidth: 2,
  },
  username: { fontSize: 14, fontWeight: '800' },
  venues: { fontSize: 10, fontWeight: '800' },
  lastSeen: { fontSize: 10, fontWeight: '600' },
  crossPill: {
    alignItems: 'center', borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  crossNum: { fontSize: 14, fontWeight: '900' },
  crossLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  msgBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { alignItems: 'center', paddingTop: 70, gap: 12, paddingHorizontal: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
