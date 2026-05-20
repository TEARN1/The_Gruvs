import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const avatarBg = (name) => {
  const cols = ['#0891b2', '#7c3aed', '#dc2626', '#059669', '#d97706', '#0d9488'];
  return cols[(name?.charCodeAt(0) || 0) % cols.length];
};

const formatDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const CrewJourneyPanel = ({ onEventPress }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        // Get people I follow
        const { data: followData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .limit(100);

        if (!followData || followData.length === 0) return;

        const followingIds = followData.map(f => f.following_id);

        // Get events those people RSVP'd as "going" in the future
        const now = new Date().toISOString();
        const { data: rsvpData } = await supabase
          .from('event_rsvps')
          .select(`
            user_id,
            events!inner(id, title, event_date, address, city, category, media),
            profiles!inner(username, avatar_url)
          `)
          .in('user_id', followingIds)
          .eq('status', 'going')
          .gte('events.event_date', now)
          .order('events.event_date', { ascending: true })
          .limit(50);

        if (!rsvpData) return;

        // Group by event
        const eventMap = {};
        rsvpData.forEach(r => {
          const ev = r.events;
          if (!ev) return;
          if (!eventMap[ev.id]) {
            eventMap[ev.id] = { event: ev, attendees: [] };
          }
          eventMap[ev.id].attendees.push(r.profiles);
        });

        setJourneys(Object.values(eventMap).slice(0, 10));
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (!user || (journeys.length === 0 && !loading)) return null;

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={cj.sectionHeader}>
        <Feather name="map" size={16} color={primary} />
        <Text style={[cj.sectionTitle, { color: primary }]}>CREW'S NEXT MOVES</Text>
      </View>
      <Text style={[cj.sectionSub, { color: muted }]}>Events people you follow are attending</Text>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 20 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {journeys.map(({ event, attendees }) => {
            const thumb = Array.isArray(event.media) && event.media.find(m => m.type === 'image');
            return (
              <TouchableOpacity
                key={event.id}
                onPress={() => onEventPress?.(event)}
                activeOpacity={0.85}
              >
                <GlassView style={[cj.card, { borderColor: `${primary}20` }]}>
                  {/* Category pill */}
                  <View style={[cj.catPill, { backgroundColor: `${primary}20` }]}>
                    <Text style={[cj.catText, { color: primary }]}>{event.category || 'Event'}</Text>
                  </View>

                  <Text style={[cj.eventTitle, { color: textColor }]} numberOfLines={2}>{event.title}</Text>

                  <View style={cj.metaRow}>
                    <Feather name="calendar" size={11} color={muted} />
                    <Text style={[cj.metaText, { color: muted }]}>{formatDate(event.event_date)}</Text>
                  </View>
                  {(event.city || event.address) ? (
                    <View style={cj.metaRow}>
                      <Feather name="map-pin" size={11} color={muted} />
                      <Text style={[cj.metaText, { color: muted }]} numberOfLines={1}>{event.city || event.address}</Text>
                    </View>
                  ) : null}

                  {/* Crew avatars */}
                  <View style={cj.crewRow}>
                    <View style={cj.avatarStack}>
                      {attendees.slice(0, 4).map((p, i) => (
                        p?.avatar_url
                          ? <Image key={i} source={{ uri: p.avatar_url }} style={[cj.avatar, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }]} />
                          : <View key={i} style={[cj.avatar, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i, backgroundColor: avatarBg(p?.username), alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={cj.avatarLetter}>{(p?.username || 'V')[0].toUpperCase()}</Text>
                            </View>
                      ))}
                    </View>
                    <Text style={[cj.goingText, { color: muted }]}>
                      {attendees.length} going
                    </Text>
                  </View>
                </GlassView>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const cj = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  sectionSub: { fontSize: 11, paddingHorizontal: 16, marginBottom: 12 },
  card: { width: 200, padding: 14, borderRadius: 18, borderWidth: 1 },
  catPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  catText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventTitle: { fontSize: 14, fontWeight: '800', lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  metaText: { fontSize: 11 },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  avatarStack: { flexDirection: 'row' },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#000' },
  avatarLetter: { color: '#fff', fontSize: 8, fontWeight: '900' },
  goingText: { fontSize: 11, fontWeight: '700' },
});
