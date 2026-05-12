import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
  Image, ActivityIndicator, Platform, TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { DirectMessageModal } from './DirectMessageModal';
import { ViberProfileModal } from './ViberProfileModal';

const avatarBg = (u = '') =>
  ['#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777'][(u.charCodeAt(0) || 0) % 5];

const TIME_WINDOWS = [
  { label: 'Last 1 hour',  hours: 1 },
  { label: 'Last 3 hours', hours: 3 },
  { label: 'Last 6 hours', hours: 6 },
  { label: 'Last 24h',     hours: 24 },
  { label: 'Last 3 days',  hours: 72 },
  { label: 'Last week',    hours: 168 },
];

export function WhoWasThereModal({ visible, onClose, onAuthRequired }) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const surface   = currentTheme?.surface    || '#1a1f21';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [venue,          setVenue]          = useState('');
  const [selectedWindow, setSelectedWindow] = useState(TIME_WINDOWS[1]);
  const [results,        setResults]        = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [hasSearched,    setHasSearched]    = useState(false);
  const [msgTarget,      setMsgTarget]      = useState(null);
  const [msgVisible,     setMsgVisible]     = useState(false);
  const [selectedViber,  setSelectedViber]  = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);

  const search = useCallback(async () => {
    if (!user) { onAuthRequired?.(); return; }
    setLoading(true);
    setHasSearched(true);
    try {
      const since = new Date(Date.now() - selectedWindow.hours * 3600 * 1000).toISOString();

      let qb = supabase
        .from('live_checkins')
        .select(`
          user_id,
          venue_name,
          event_id,
          created_at,
          profiles:user_id (id, username, avatar_url, bio, vibe_score, is_online, is_verified)
        `)
        .gte('created_at', since)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (venue.trim()) {
        qb = qb.ilike('venue_name', `%${venue.trim()}%`);
      }

      const { data, error } = await qb;
      if (error) throw error;

      // De-duplicate by user_id (keep most recent checkin per user)
      const seen = new Set();
      const unique = [];
      for (const row of (data || [])) {
        if (!seen.has(row.user_id) && row.profiles) {
          seen.add(row.user_id);
          unique.push({
            ...row.profiles,
            venue_name: row.venue_name,
            checkin_at: row.created_at,
          });
        }
      }
      setResults(unique);
    } catch { setResults([]); } finally {
      setLoading(false);
    }
  }, [user, venue, selectedWindow]);

  const fmtAge = (ts) => {
    if (!ts) return '';
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const reset = () => {
    setVenue('');
    setResults([]);
    setHasSearched(false);
    setSelectedWindow(TIME_WINDOWS[1]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[s.screen, { backgroundColor: bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={20} color={textColor} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: textColor }]}>Who Was There?</Text>
            <Text style={[s.sub, { color: muted }]}>Find Vibers at a place & time</Text>
          </View>
          {hasSearched && (
            <TouchableOpacity onPress={reset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="rotate-ccw" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Venue search */}
        <View style={[s.inputWrap, { borderColor: `${primary}25`, backgroundColor: `${surface}80` }]}>
          <Feather name="map-pin" size={16} color={venue ? primary : muted} />
          <TextInput
            style={[s.input, { color: textColor }]}
            placeholder="Venue name (e.g. Taboo, FNB Stadium)..."
            placeholderTextColor={muted}
            value={venue}
            onChangeText={setVenue}
            returnKeyType="search"
            onSubmitEditing={search}
          />
          {venue.length > 0 && (
            <TouchableOpacity onPress={() => setVenue('')}>
              <Feather name="x" size={14} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Time window selector */}
        <View style={s.windowRow}>
          {TIME_WINDOWS.map(w => (
            <TouchableOpacity
              key={w.hours}
              style={[
                s.windowBtn,
                {
                  backgroundColor: selectedWindow.hours === w.hours ? primary : `${primary}12`,
                  borderColor: selectedWindow.hours === w.hours ? primary : `${primary}25`,
                }
              ]}
              onPress={() => setSelectedWindow(w)}
            >
              <Text style={[s.windowText, { color: selectedWindow.hours === w.hours ? '#000' : primary }]}>
                {w.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search button */}
        <TouchableOpacity
          style={[s.searchBtn, { backgroundColor: primary }]}
          onPress={search}
          activeOpacity={0.85}
        >
          <Feather name="search" size={16} color="#000" />
          <Text style={s.searchBtnText}>Search</Text>
        </TouchableOpacity>

        {/* Results */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[{ color: muted, marginTop: 12, fontSize: 13 }]}>Scanning checkins...</Text>
          </View>
        ) : hasSearched ? (
          results.length === 0 ? (
            <View style={s.empty}>
              <Feather name="clock" size={40} color={muted} style={{ opacity: 0.4 }} />
              <Text style={[s.emptyTitle, { color: textColor }]}>Nobody found</Text>
              <Text style={[s.emptySub, { color: muted }]}>
                No checkins match that venue in the last {selectedWindow.label.toLowerCase()}.
                {'\n'}Try a broader time window or different venue name.
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 12 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={[s.resultHeader, { color: muted }]}>
                  {results.length} Viber{results.length !== 1 ? 's' : ''} · {selectedWindow.label}
                  {venue ? ` · "${venue}"` : ' · All venues'}
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.row, { backgroundColor: surface, borderColor: item.is_online ? `${primary}30` : 'rgba(255,255,255,0.06)' }]}
                  onPress={() => { setSelectedViber(item); setProfileVisible(true); }}
                  activeOpacity={0.82}
                >
                  <View style={{ position: 'relative' }}>
                    {item.avatar_url
                      ? <Image source={{ uri: item.avatar_url }} style={s.avatar} />
                      : <View style={[s.avatar, { backgroundColor: avatarBg(item.username), alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                            {(item.username || 'V')[0].toUpperCase()}
                          </Text>
                        </View>
                    }
                    {item.is_online && <View style={[s.onlineDot, { borderColor: surface }]} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.username, { color: textColor }]} numberOfLines={1}>@{item.username}</Text>
                      {item.is_verified && <Feather name="check-circle" size={11} color={primary} />}
                    </View>
                    {item.venue_name
                      ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Feather name="map-pin" size={9} color="#f97316" />
                          <Text style={[s.venueName, { color: '#f97316' }]} numberOfLines={1}>{item.venue_name}</Text>
                        </View>
                      : null
                    }
                    <Text style={[s.checkinTime, { color: muted }]}>{fmtAge(item.checkin_at)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.msgBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
                    onPress={() => { setMsgTarget(item); setMsgVisible(true); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="message-circle" size={16} color={primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )
        ) : (
          <View style={s.hint}>
            <Feather name="clock" size={48} color={muted} style={{ opacity: 0.3 }} />
            <Text style={[s.hintTitle, { color: textColor }]}>Find your crowd</Text>
            <Text style={[s.hintSub, { color: muted }]}>
              Enter a venue name and pick a time window to see which Vibers checked in at the same place.
            </Text>
          </View>
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
          recipientId={msgTarget.id}
          recipientUsername={msgTarget.username}
          recipientAvatar={msgTarget.avatar_url}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14,
    height: 44, borderRadius: 22, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14 },
  windowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  windowBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1.5,
  },
  windowText: { fontSize: 11, fontWeight: '800' },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginBottom: 16, paddingVertical: 13,
    borderRadius: 22,
  },
  searchBtnText: { color: '#000', fontSize: 14, fontWeight: '900' },
  resultHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 8,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#10b981', borderWidth: 2,
  },
  username: { fontSize: 14, fontWeight: '800' },
  venueName: { fontSize: 10, fontWeight: '800' },
  checkinTime: { fontSize: 10, fontWeight: '600' },
  msgBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  hintTitle: { fontSize: 18, fontWeight: '900' },
  hintSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
