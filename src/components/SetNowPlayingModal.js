/**
 * SetNowPlayingModal — host control to set the current song/artist on stage.
 * Pulls from the event's setlist so hosts can tap a song instead of typing.
 * Writes to event_now_playing; the NowPlayingBar picks it up via realtime.
 *
 * Usage:
 *   <SetNowPlayingModal eventId={id} visible={open} onClose={() => setOpen(false)} />
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationService } from '../services/notificationService';

export const SetNowPlayingModal = ({ eventId, visible, onClose }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const primary    = colors?.primary    || '#00f2ff';
  const bg         = colors?.card       || '#111';
  const textColor  = colors?.text       || '#fff';
  const muted      = colors?.muted      || 'rgba(255,255,255,0.5)';
  const surface    = colors?.surface    || '#1a1f21';

  const [setlists, setSetlists] = useState([]);   // grouped by lineup_id
  const [lineups, setLineups]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [current, setCurrent]   = useState(null); // active now_playing row

  // Manual entry fallback
  const [manualArtist, setManualArtist] = useState('');
  const [manualSong, setManualSong]     = useState('');
  const [manualMode, setManualMode]     = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const [{ data: ldata }, { data: sdata }, { data: cdata }] = await Promise.all([
      supabase.from('event_lineup').select('id, name, role, stage').eq('event_id', eventId).is('deleted_at', null).order('position'),
      supabase.from('event_setlists').select('id, lineup_id, song_title, track_number, is_played').eq('event_id', eventId).order('track_number'),
      supabase.from('event_now_playing').select('*').eq('event_id', eventId).eq('is_active', true).maybeSingle(),
    ]);
    setLineups(ldata || []);
    setSetlists(sdata || []);
    setCurrent(cdata || null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const setPlaying = async ({ lineupId, setlistId, artistName, songTitle }) => {
    if (!eventId || saving) return;
    setSaving(true);
    try {
      await supabase.from('event_now_playing').insert({
        event_id:    eventId,
        lineup_id:   lineupId || null,
        setlist_id:  setlistId || null,
        artist_name: artistName,
        song_title:  songTitle || null,
        is_active:   true,
      });
      // Notify followers
      await NotificationService.notifyNowPlaying(eventId, artistName, songTitle);
      await load();
      onClose();
    } catch (e) {
      console.warn('SetNowPlaying error', e);
    }
    setSaving(false);
  };

  const clearPlaying = async () => {
    if (!current) return;
    setSaving(true);
    await supabase.from('event_now_playing')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', current.id);
    setCurrent(null);
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={[s.sheet, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={s.header}>
            <Text style={[s.title, { color: textColor }]}>🎵 Set Now Playing</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Current */}
          {current && (
            <View style={[s.currentBar, { backgroundColor: `${primary}15`, borderColor: `${primary}40` }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.currentLabel, { color: primary }]}>NOW PLAYING</Text>
                <Text style={[s.currentArtist, { color: textColor }]}>{current.artist_name}</Text>
                {current.song_title ? <Text style={[s.currentSong, { color: muted }]}>{current.song_title}</Text> : null}
              </View>
              <TouchableOpacity onPress={clearPlaying} disabled={saving}>
                <Feather name="x-circle" size={22} color={muted} />
              </TouchableOpacity>
            </View>
          )}

          {loading
            ? <ActivityIndicator color={primary} style={{ marginVertical: 32 }} />
            : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Manual entry */}
                <TouchableOpacity
                  style={[s.modeToggle, { borderColor: `${primary}30` }]}
                  onPress={() => setManualMode(m => !m)}
                >
                  <Feather name={manualMode ? 'chevron-up' : 'edit-2'} size={14} color={primary} />
                  <Text style={[s.modeText, { color: primary }]}>
                    {manualMode ? 'Hide manual entry' : 'Enter manually'}
                  </Text>
                </TouchableOpacity>

                {manualMode && (
                  <View style={[s.manualBox, { backgroundColor: surface }]}>
                    <TextInput
                      style={[s.input, { color: textColor, borderColor: `${primary}30` }]}
                      placeholder="Artist / performer name"
                      placeholderTextColor={muted}
                      value={manualArtist}
                      onChangeText={setManualArtist}
                    />
                    <TextInput
                      style={[s.input, { color: textColor, borderColor: `${primary}30`, marginTop: 8 }]}
                      placeholder="Song title (optional)"
                      placeholderTextColor={muted}
                      value={manualSong}
                      onChangeText={setManualSong}
                    />
                    <TouchableOpacity
                      style={[s.goBtn, { backgroundColor: primary, opacity: !manualArtist.trim() || saving ? 0.5 : 1 }]}
                      onPress={() => setPlaying({ artistName: manualArtist.trim(), songTitle: manualSong.trim() })}
                      disabled={!manualArtist.trim() || saving}
                    >
                      {saving
                        ? <ActivityIndicator size="small" color="#000" />
                        : <Text style={s.goBtnText}>Set Now Playing</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}

                {/* Setlist grouped by artist */}
                {lineups.map(lineup => {
                  const songs = setlists.filter(s => s.lineup_id === lineup.id);
                  if (!songs.length) return null;
                  return (
                    <View key={lineup.id} style={{ marginBottom: 16 }}>
                      {/* Artist header — tap to set artist on stage without a song */}
                      <TouchableOpacity
                        style={[s.artistRow, { borderColor: `${primary}25` }]}
                        onPress={() => setPlaying({ lineupId: lineup.id, artistName: lineup.name })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.artistName, { color: textColor }]}>{lineup.name}</Text>
                          {lineup.role ? <Text style={[s.artistRole, { color: muted }]}>{lineup.role}{lineup.stage ? ` · ${lineup.stage}` : ''}</Text> : null}
                        </View>
                        <Feather name="play-circle" size={20} color={primary} />
                      </TouchableOpacity>

                      {/* Songs */}
                      {songs.map(song => (
                        <TouchableOpacity
                          key={song.id}
                          style={[s.songRow, { opacity: song.is_played ? 0.45 : 1 }]}
                          onPress={() => setPlaying({ lineupId: lineup.id, setlistId: song.id, artistName: lineup.name, songTitle: song.song_title })}
                        >
                          <Text style={[s.trackNum, { color: muted }]}>{song.track_number}.</Text>
                          <Text style={[s.songTitle, { color: song.is_played ? muted : textColor }]} numberOfLines={1}>
                            {song.song_title}
                          </Text>
                          {song.is_played && <Feather name="check" size={14} color={primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}

                {/* Lineups with no setlist */}
                {lineups.filter(l => !setlists.some(s => s.lineup_id === l.id)).map(lineup => (
                  <TouchableOpacity
                    key={lineup.id}
                    style={[s.artistRow, { borderColor: `${primary}25` }]}
                    onPress={() => setPlaying({ lineupId: lineup.id, artistName: lineup.name })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.artistName, { color: textColor }]}>{lineup.name}</Text>
                      {lineup.role ? <Text style={[s.artistRole, { color: muted }]}>{lineup.role}</Text> : null}
                    </View>
                    <Feather name="play-circle" size={20} color={primary} />
                  </TouchableOpacity>
                ))}

                {!lineups.length && !manualMode && (
                  <Text style={[s.empty, { color: muted }]}>No lineup added yet. Use manual entry above.</Text>
                )}
              </ScrollView>
            )
          }
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '85%' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:         { fontSize: 17, fontWeight: '900' },
  currentBar:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 16, gap: 10 },
  currentLabel:  { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  currentArtist: { fontSize: 14, fontWeight: '800' },
  currentSong:   { fontSize: 12, marginTop: 1 },
  modeToggle:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: 1, marginBottom: 12 },
  modeText:      { fontSize: 13, fontWeight: '700' },
  manualBox:     { borderRadius: 14, padding: 14, marginBottom: 16 },
  input:         { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  goBtn:         { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  goBtnText:     { fontSize: 14, fontWeight: '900', color: '#000' },
  artistRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, marginBottom: 4 },
  artistName:    { fontSize: 14, fontWeight: '800' },
  artistRole:    { fontSize: 11, marginTop: 2 },
  songRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingLeft: 12 },
  trackNum:      { fontSize: 11, fontWeight: '700', width: 20 },
  songTitle:     { flex: 1, fontSize: 13, fontWeight: '600' },
  empty:         { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
});
