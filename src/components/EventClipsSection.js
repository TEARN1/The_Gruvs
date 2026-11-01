/**
 * EventClipsSection — reels tagged to this event, on the event page.
 *
 * The question an event page has to answer is "is it worth going?", and a
 * ten-second clip from the floor answers it better than any description. Clips
 * posted while the event is on carry a "Live" badge. Tapping one opens the
 * full-screen Reels player on it; "Add a clip" opens the reel creator already
 * tagged to this event.
 *
 * Hidden for a future event with no clips yet: there is nothing to show and
 * nobody can film it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { storageThumb } from '../utils/storageThumb';

const TILE_W = 104, TILE_H = 156;
const LIVE_MS = 2 * 3600 * 1000;

const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** A clip is "live" when it was posted in the last 2 hours of an event on today. Exported for tests. */
export function isLiveClip(clip, event, now = new Date()) {
  if (!clip?.created_at || String(event?.event_date || '').slice(0, 10) !== localDay(now)) return false;
  return now.getTime() - new Date(clip.created_at).getTime() < LIVE_MS;
}

export const EventClipsSection = ({ event, primary, textColor, muted, onOpenReel, onAddClip, refreshKey = 0 }) => {
  const [clips, setClips] = useState(null);

  useEffect(() => {
    if (!event?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('reels')
          .select('id, media_url, media_type, thumbnail_url, created_at, view_count, profiles:user_id(username)')
          .eq('event_id', event.id)
          .is('deleted_at', null)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(12);
        if (alive) setClips(error ? [] : data || []);
      } catch { if (alive) setClips([]); }
    })();
    return () => { alive = false; };
  }, [event?.id, refreshKey]);

  if (clips === null) return null;
  const started = String(event?.event_date || '').slice(0, 10) <= localDay();
  if (!clips.length && !started) return null;

  return (
    <View style={ec.wrap}>
      <View style={ec.header}>
        <Feather name="film" size={14} color={primary} />
        <Text style={[ec.title, { color: textColor }]}>Clips from this event</Text>
        {!!clips.length && <Text style={[ec.count, { color: muted }]}>{clips.length}</Text>}
        {onAddClip && (
          <TouchableOpacity
            onPress={onAddClip}
            style={[ec.addBtn, { borderColor: `${primary}55`, backgroundColor: `${primary}14` }]}
            accessibilityRole="button"
            accessibilityLabel="Add a clip from this event"
          >
            <Feather name="plus" size={12} color={primary} />
            <Text style={[ec.addText, { color: primary }]}>Add a clip</Text>
          </TouchableOpacity>
        )}
      </View>

      {clips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {clips.map((clip) => {
            const isVideo = clip.media_type === 'video' || /\.(mp4|mov|m4v|webm)/i.test(clip.media_url || '');
            const cover = clip.thumbnail_url || (!isVideo ? clip.media_url : null);
            const live = isLiveClip(clip, event);
            return (
              <TouchableOpacity
                key={clip.id}
                onPress={() => onOpenReel?.(clip.id)}
                disabled={!onOpenReel}
                activeOpacity={0.85}
                style={[ec.tile, { borderColor: `${primary}25` }]}
                accessibilityRole="button"
                accessibilityLabel={`Watch ${live ? 'live ' : ''}clip by ${clip.profiles?.username || 'a viber'}`}
              >
                {cover
                  ? <Image source={{ uri: storageThumb(cover, 210, 312, 60) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <View style={[StyleSheet.absoluteFill, { backgroundColor: `${primary}10` }]} />}
                <View style={ec.playWrap}><Feather name="play" size={16} color="#fff" style={{ marginLeft: 2 }} /></View>
                {live && <View style={ec.live}><Text style={ec.liveText}>LIVE</Text></View>}
                <Text style={ec.author} numberOfLines={1}>{clip.profiles?.username || 'viber'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[ec.empty, { color: muted }]}>
          No clips yet. If you're there, post ten seconds so others can see what it's like.
        </Text>
      )}
    </View>
  );
};

const ec = StyleSheet.create({
  wrap: { marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '900' },
  count: { fontSize: 12, fontWeight: '700' },
  addBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  addText: { fontSize: 11.5, fontWeight: '800' },
  tile: { width: TILE_W, height: TILE_H, borderRadius: 12, overflow: 'hidden', borderWidth: 1, backgroundColor: '#0b1112' },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  live: { position: 'absolute', top: 6, left: 6, backgroundColor: '#ef4444', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  liveText: { color: '#fff', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  author: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 7, paddingVertical: 5, color: '#fff', fontSize: 10.5, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.55)' },
  empty: { fontSize: 12, lineHeight: 17 },
});

export default EventClipsSection;
