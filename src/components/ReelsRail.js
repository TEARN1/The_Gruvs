/**
 * ReelsRail — a horizontal strip of the hottest recent reels ON The Drop, so
 * video discovery starts in the feed (tap → full-screen Reels player on that
 * reel, where double-tap-to-like lives). Real reels only; renders nothing when
 * there are none.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from '../services/supabase';
import { storageThumb } from '../utils/storageThumb';

const TILE_W = 118, TILE_H = 176;

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0));

export const ReelsRail = ({ onOpenReel, primary, textColor, muted }) => {
  const [reels, setReels] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Tolerate an un-migrated DB missing thumbnail_url.
        let r = await supabase.from('reels')
          .select('id, media_url, media_type, thumbnail_url, caption, like_count, view_count, profiles:user_id(username, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(12);
        if (r.error) {
          r = await supabase.from('reels')
            .select('id, media_url, media_type, caption, like_count, view_count, profiles:user_id(username, avatar_url)')
            .order('created_at', { ascending: false })
            .limit(12);
        }
        if (alive && r.data?.length) setReels(r.data);
      } catch { /* rail is best-effort — feed works without it */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!reels.length) return null;

  return (
    <View style={rr.wrap}>
      <View style={rr.header}>
        <Feather name="film" size={15} color={primary} />
        <Text style={[rr.title, { color: textColor }]}>Reels</Text>
        <Text style={[rr.sub, { color: muted }]}>tap to watch</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
        {reels.map(reel => {
          const isVideo = reel.media_type === 'video' || /\.(mp4|mov|m4v|webm)/i.test(reel.media_url || '');
          const thumb = reel.thumbnail_url || (!isVideo ? reel.media_url : null);
          return (
            <TouchableOpacity
              key={reel.id}
              style={[rr.tile, { borderColor: `${primary}25` }]}
              onPress={() => onOpenReel?.(reel.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Watch reel by ${reel.profiles?.username || 'a viber'}`}
            >
              {thumb
                ? <Image source={{ uri: storageThumb(thumb, 240, 360, 60) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: `${primary}10` }]} />}
              {/* play affordance */}
              <View style={rr.playWrap}>
                <View style={[rr.playBtn, { borderColor: `${primary}aa` }]}>
                  <Feather name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
                </View>
              </View>
              {/* bottom meta */}
              <View style={rr.meta}>
                <Text style={rr.author} numberOfLines={1}>{reel.profiles?.username || 'viber'}</Text>
                <Text style={rr.stats}>❤️ {fmt(reel.like_count)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const rr = StyleSheet.create({
  wrap: { marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  sub: { fontSize: 11, fontWeight: '600', marginLeft: 'auto' },
  tile: { width: TILE_W, height: TILE_H, borderRadius: 14, overflow: 'hidden', borderWidth: 1, backgroundColor: '#0b1112' },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  meta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  author: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  stats: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', marginTop: 1 },
});

export default ReelsRail;
