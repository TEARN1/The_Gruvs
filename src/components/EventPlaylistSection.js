/**
 * EventPlaylistSection — Collaborative event playlist.
 * Attendees suggest tracks (Spotify or YouTube), vote on them,
 * top-voted tracks rise to the top in real-time.
 */
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  Image, ActivityIndicator, Modal, Animated, Linking, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { MusicService } from '../services/musicService';
import { PlaylistManager } from '../services/dataFlow';
import { useBackClose } from '../hooks/useBackClose';

const fmtDuration = (ms) => {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ── Track search modal (Spotify + YouTube) ────────────────────────────────────
const TrackSearchModal = ({ visible, onClose, onSelect, primary, bg, textColor, muted, surface }) => {
  useBackClose(visible, onClose);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('spotify');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const spotifyOk = MusicService.isSpotifyConfigured();
  const youtubeOk = MusicService.isYouTubeConfigured();

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await MusicService.search(q.trim(), platform, 12);
      setResults(data);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [platform]);

  const onType = (v) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 420);
  };

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  // Re-search when platform changes
  useEffect(() => { if (query.trim()) search(query); }, [platform]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <View style={[ts.sheet, { backgroundColor: bg }]}>
          <View style={[ts.handle, { backgroundColor: `${primary}40` }]} />

          {/* Platform toggle */}
          <View style={ts.platformRow}>
            {spotifyOk && (
              <TouchableOpacity
                style={[ts.platformBtn, platform === 'spotify' && { backgroundColor: `${primary}20`, borderColor: primary }]}
                onPress={() => setPlatform('spotify')}
              >
                <Text style={{ fontSize: 13 }}>🎵</Text>
                <Text style={[ts.platformLabel, { color: platform === 'spotify' ? primary : muted }]}>Spotify</Text>
              </TouchableOpacity>
            )}
            {youtubeOk && (
              <TouchableOpacity
                style={[ts.platformBtn, platform === 'youtube' && { backgroundColor: `${primary}20`, borderColor: primary }]}
                onPress={() => setPlatform('youtube')}
              >
                <Text style={{ fontSize: 13 }}>▶️</Text>
                <Text style={[ts.platformLabel, { color: platform === 'youtube' ? primary : muted }]}>YouTube</Text>
              </TouchableOpacity>
            )}
          </View>

          {!spotifyOk && !youtubeOk && (
            <Text style={{ color: "#ef4444", fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
              Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID or EXPO_PUBLIC_YOUTUBE_API_KEY to your .env to enable search.
            </Text>
          )}

          {/* Search input */}
          <View style={[ts.searchBox, { backgroundColor: surface, borderColor: `${primary}30` }]}>
            <Feather name="search" size={16} color={muted} />
            <TextInput
              style={[ts.searchInput, { color: textColor }]}
              placeholder="Search for a track..."
              placeholderTextColor={muted}
              value={query}
              onChangeText={onType}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => search(query)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                <Feather name="x" size={15} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          {searching ? (
            <ActivityIndicator color={primary} style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => `${item.platform}:${item.id}`}
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={
                query.trim() ? (
                  <Text style={{ color: muted, textAlign: 'center', marginTop: 30, fontSize: 13 }}>No results found</Text>
                ) : (
                  <Text style={{ color: muted, textAlign: 'center', marginTop: 30, fontSize: 13 }}>Type to search tracks</Text>
                )
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[ts.resultRow, { borderBottomColor: `${primary}10` }]}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.8}
                >
                  {item.thumbnail
                    ? <Image source={{ uri: item.thumbnail }} style={ts.thumb} />
                    : <View style={[ts.thumb, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="music" size={16} color={primary} />
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={[ts.trackTitle, { color: textColor }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[ts.trackArtist, { color: muted }]} numberOfLines={1}>{item.artist}</Text>
                  </View>
                  {item.durationFmt && <Text style={[ts.duration, { color: muted }]}>{item.durationFmt}</Text>}
                  <View style={[ts.platformDot, { backgroundColor: item.platform === 'spotify' ? "#1DB954" : "#FF0000" }]} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};
const ts = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  platformRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  platformBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  platformLabel: { fontSize: 12, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  trackTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  trackArtist: { fontSize: 11 },
  duration: { fontSize: 11 },
  platformDot: { width: 7, height: 7, borderRadius: 4 },
});

// ── Track row in playlist ─────────────────────────────────────────────────────
const TrackRow = memo(({ track, rank, voted, onVote, onRemove, canRemove, primary, textColor, muted, surface }) => {
  const voteAnim = useRef(new Animated.Value(1)).current;

  const handleVote = () => {
    Animated.sequence([
      Animated.timing(voteAnim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(voteAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onVote(track.id, voted);
  };

  return (
    <View style={[tr.row, { backgroundColor: rank <= 3 ? `${primary}08` : 'transparent', borderColor: rank === 1 ? `${primary}30` : `${primary}10` }]}>
      {/* Rank */}
      <Text style={[tr.rank, { color: rank <= 3 ? primary : muted }]}>
        {rank === 1 ? '🔥' : rank === 2 ? '2' : rank === 3 ? '3' : rank}
      </Text>

      {/* Thumbnail */}
      {track.thumbnail
        ? <Image source={{ uri: track.thumbnail }} style={tr.thumb} />
        : <View style={[tr.thumb, { backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="music" size={14} color={primary} />
          </View>
      }

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={[tr.title, { color: textColor }]} numberOfLines={1}>{track.title}</Text>
        <Text style={[tr.artist, { color: muted }]} numberOfLines={1}>{track.artist}</Text>
        {track.duration_ms && <Text style={[tr.duration, { color: muted }]}>{fmtDuration(track.duration_ms)}</Text>}
      </View>

      {/* Platform open */}
      <TouchableOpacity
        onPress={() => {
          const url = MusicService.getOpenUrl({ platform: track.platform, id: track.track_id, externalUrl: null });
          Linking.openURL(url).catch(() => {});
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={[tr.platformIcon, { backgroundColor: track.platform === 'spotify' ? '#1DB95420' : '#FF000020' }]}>
          <Feather name="external-link" size={12} color={track.platform === 'spotify' ? "#1DB954" : "#FF0000"} />
        </View>
      </TouchableOpacity>

      {/* Vote */}
      <TouchableOpacity onPress={handleVote} style={[tr.voteBtn, { borderColor: voted ? primary : `${primary}30`, backgroundColor: voted ? `${primary}20` : 'transparent' }]}>
        <Animated.View style={{ transform: [{ scale: voteAnim }] }}>
          <Feather name="arrow-up" size={14} color={voted ? primary : muted} />
        </Animated.View>
        <Text style={[tr.voteCount, { color: voted ? primary : muted }]}>{track.votes || 0}</Text>
      </TouchableOpacity>

      {/* Remove (own track or moderator) */}
      {canRemove && (
        <TouchableOpacity onPress={() => onRemove(track.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={14} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  );
});
const tr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  rank: { width: 20, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  thumb: { width: 40, height: 40, borderRadius: 8 },
  title: { fontSize: 13, fontWeight: '800', marginBottom: 1 },
  artist: { fontSize: 11 },
  duration: { fontSize: 10, marginTop: 1 },
  platformIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  voteCount: { fontSize: 12, fontWeight: '900' },
});

// ── Main EventPlaylistSection ─────────────────────────────────────────────────
export const EventPlaylistSection = ({ eventId, canModerate = false }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#1a1f21";

  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [userVotes, setUserVotes] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!eventId || !user?.id) return;
    try {
      const pl = await PlaylistManager.getOrCreate(eventId, user.id);
      setPlaylist(pl);
      const [tkList, votes] = await Promise.all([
        PlaylistManager.fetchTracks(pl.id),
        PlaylistManager.fetchUserVotes(pl.id, user.id),
      ]);
      setTracks(tkList);
      setUserVotes(votes);
    } catch { /* playlist unavailable */ }
    finally { setLoading(false); }
  }, [eventId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!playlist?.id) return;
    const unsub = PlaylistManager.subscribe(playlist.id, () => load());
    return () => unsub();
  }, [playlist?.id, load]);

  const handleAddTrack = async (track) => {
    if (!playlist || !user) return;
    setAdding(true);
    try {
      await PlaylistManager.addTrack(playlist.id, user.id, track);
      load();
    } catch (e) {
      Alert.alert('Could not add track', e.message);
    } finally { setAdding(false); }
  };

  const handleVote = async (trackRowId, alreadyVoted) => {
    if (!user) return;
    // Optimistic
    setUserVotes(prev => {
      const next = new Set(prev);
      alreadyVoted ? next.delete(trackRowId) : next.add(trackRowId);
      return next;
    });
    setTracks(prev => prev.map(t => t.id === trackRowId ? { ...t, votes: (t.votes || 0) + (alreadyVoted ? -1 : 1) } : t));
    try {
      alreadyVoted
        ? await PlaylistManager.unvote(trackRowId, user.id)
        : await PlaylistManager.vote(trackRowId, user.id);
    } catch {
      // Roll back
      setUserVotes(prev => { const next = new Set(prev); alreadyVoted ? next.add(trackRowId) : next.delete(trackRowId); return next; });
      setTracks(prev => prev.map(t => t.id === trackRowId ? { ...t, votes: (t.votes || 0) + (alreadyVoted ? 1 : -1) } : t));
    }
  };

  const handleRemove = async (trackRowId) => {
    setTracks(prev => prev.filter(t => t.id !== trackRowId));
    try { await PlaylistManager.removeTrack(trackRowId); } catch { load(); }
  };

  const sortedTracks = [...tracks].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  if (loading) return <ActivityIndicator color={primary} style={{ marginVertical: 20 }} />;

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: textColor, fontSize: 17, fontWeight: '900' }}>Vibe Playlist</Text>
          <Text style={{ color: muted, fontSize: 12 }}>
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} · vote to move tracks up
          </Text>
        </View>
        {user && (
          <TouchableOpacity
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
            onPress={() => setSearchVisible(true)}
            disabled={adding}
          >
            {adding
              ? <ActivityIndicator size="small" color={primary} />
              : <Feather name="plus" size={14} color={primary} />
            }
            <Text style={{ color: primary, fontSize: 12, fontWeight: '900' }}>Add Track</Text>
          </TouchableOpacity>
        )}
      </View>

      {sortedTracks.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🎵</Text>
          <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>
            No tracks yet. Add the first song to set the vibe!
          </Text>
        </View>
      ) : (
        sortedTracks.map((track, idx) => (
          <TrackRow
            key={track.id}
            track={track}
            rank={idx + 1}
            voted={userVotes.has(track.id)}
            onVote={handleVote}
            onRemove={handleRemove}
            canRemove={canModerate || track.added_by === user?.id}
            primary={primary}
            textColor={textColor}
            muted={muted}
            surface={surface}
          />
        ))
      )}

      <TrackSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleAddTrack}
        primary={primary}
        bg={bg}
        textColor={textColor}
        muted={muted}
        surface={surface}
      />
    </View>
  );
};
