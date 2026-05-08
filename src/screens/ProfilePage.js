import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Animated, Alert, TextInput, ActivityIndicator,
  Switch, Dimensions, Share, Platform, RefreshControl,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { FadeInView } from '../components/FadeInView';
import { AuraEffect } from '../components/AuraEffect';
import { THEMES, GENDERS } from '../constants/Themes';
import { BrandLogo } from '../components/BrandLogo';
import { supabase } from '../services/supabase';
import { DiscoveryManager } from '../services/dataFlow';
import { LocationService } from '../services/locationService';
import * as ImagePicker from 'expo-image-picker';
import { CategoryPickerModal } from '../components/CategoryPickerModal';
import { ALL_CATEGORIES_MAP } from '../constants/AllCategories';
import { useToast } from '../components/ToastNotification';
import { SAMPLE_EVENTS } from '../constants/SampleData';
import { StreakBadge } from '../components/StreakBadge';
import { AchievementBadges } from '../components/AchievementBadges';
import { ReferralCard } from '../components/ReferralCard';
import { LeaderboardScreen } from './LeaderboardScreen';

const { width } = Dimensions.get('window');

const DIST_OPTIONS = [1, 5, 10, 25, 50];

const INTEREST_OPTIONS = ['Music', 'Art', 'Food', 'Sports', 'Tech', 'Fashion', 'Film', 'Dance', 'Comedy', 'Gaming', 'Wellness', 'Nature', 'Travel', 'Books'];

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ── Vibe Level Component ──────────────────────────────────────────────────────
const VibeLevel = ({ score, primary, muted, textColor }) => {
  const levels = [
    { name: 'Viber', min: 0, max: 100 },
    { name: 'Elite Viber', min: 101, max: 500 },
    { name: 'Royal Viber', min: 501, max: 2000 },
    { name: 'Gruv Master', min: 2001, max: 10000 },
  ];

  const current = levels.find(l => score >= l.min && score <= l.max) || levels[levels.length - 1];
  const next = levels[levels.indexOf(current) + 1];
  const progress = next ? ((score - current.min) / (next.max - current.min)) * 100 : 100;

  return (
    <View style={lvl.wrap}>
      <View style={lvl.row}>
        <Text style={[lvl.name, { color: textColor }]}>{current.name}</Text>
        <Text style={[lvl.score, { color: primary }]}>{score} pts</Text>
      </View>
      <View style={[lvl.track, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <Animated.View style={[lvl.fill, { width: `${progress}%`, backgroundColor: primary }]} />
      </View>
      {next && (
        <Text style={[lvl.next, { color: muted }]}>
          {next.max - score} more points to reach {next.name}
        </Text>
      )}
    </View>
  );
};

const lvl = StyleSheet.create({
  wrap: { marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  score: { fontSize: 13, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  next: { fontSize: 10, fontWeight: '600', marginTop: 6, textAlign: 'right' },
});

// ── Analytics Bar Chart ───────────────────────────────────────────────────────
const AnalyticsChart = ({ primary, muted, textColor, userId }) => {
  const [values, setValues] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [stats, setStats] = useState({ views: 0, visits: 0, avgVibes: 0, rsvpRate: 0 });

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const [rsvpRes, vibeRes] = await Promise.all([
          supabase
            .from('event_rsvps')
            .select('created_at, events!inner(user_id)')
            .eq('events.user_id', userId)
            .gte('created_at', since),
          supabase
            .from('event_vibes')
            .select('created_at, events!inner(user_id)')
            .eq('events.user_id', userId)
            .gte('created_at', since),
        ]);
        const rsvps = rsvpRes.data || [];
        const vibes = vibeRes.data || [];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        [...rsvps, ...vibes].forEach(item => {
          const day = new Date(item.created_at).getDay();
          const idx = day === 0 ? 6 : day - 1;
          dayCounts[idx]++;
        });
        setValues(dayCounts);
        const total = rsvps.length + vibes.length;
        const avgVibes = vibes.length > 0 ? (vibes.length / 7).toFixed(1) : '0';
        const rsvpRate = total > 0 ? Math.round((rsvps.length / total) * 100) : 0;
        setStats({ views: total, visits: rsvps.length, avgVibes, rsvpRate: `${rsvpRate}%` });
      } catch {}
    };
    load();
  }, [userId]);

  const max = Math.max(...values, 1);
  return (
    <View>
      <View style={chart.row}>
        {values.map((v, i) => (
          <View key={i} style={chart.barCol}>
            <View style={[chart.barBg, { height: 80 }]}>
              <View
                style={[chart.bar, {
                  height: (v / max) * 80,
                  backgroundColor: primary,
                  opacity: i === new Date().getDay() - 1 ? 1 : 0.55,
                }]}
              />
            </View>
            <Text style={[chart.dayLabel, { color: muted }]}>{WEEK_DAYS[i]}</Text>
          </View>
        ))}
      </View>
      <View style={chart.statsGrid}>
        {[
          { label: 'Total Activity', value: stats.views > 999 ? `${(stats.views / 1000).toFixed(1)}k` : String(stats.views) },
          { label: 'RSVPs', value: String(stats.visits) },
          { label: 'Avg Daily Vibes', value: String(stats.avgVibes) },
          { label: 'RSVP Rate', value: stats.rsvpRate },
        ].map(s => (
          <View key={s.label} style={[chart.statBox, { backgroundColor: `${primary}10`, borderColor: `${primary}20` }]}>
            <Text style={[chart.statVal, { color: primary }]}>{s.value}</Text>
            <Text style={[chart.statLab, { color: muted }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const chart = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 12 },
  barCol: { flex: 1, alignItems: 'center' },
  barBg: { width: '100%', borderRadius: 4, justifyContent: 'flex-end', backgroundColor: 'rgba(255,255,255,0.07)' },
  bar: { width: '100%', borderRadius: 4 },
  dayLabel: { fontSize: 9, fontWeight: '700', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { width: '47%', borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLab: { fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
});

// ── Person Card for Find Them ─────────────────────────────────────────────────
const pAvatarInitials = (name) => name ? name.slice(0, 2).toUpperCase() : 'G';
const pAvatarBg = (name) => {
  const colors = ['#0891b2', '#7c3aed', '#dc2626', '#059669', '#d97706', '#0d9488'];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
};

const PersonCard = ({ person, primary, muted, textColor, onFollow }) => (
  <View style={[pcard.wrap, { borderColor: `${primary}18` }]}>
    {person.avatar_url
      ? <Image source={{ uri: person.avatar_url }} style={[pcard.avatar, { borderColor: `${primary}50` }]} />
      : <View style={[pcard.avatar, { borderColor: `${primary}50`, backgroundColor: pAvatarBg(person.username), alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{pAvatarInitials(person.username)}</Text>
        </View>
    }
    {person.is_online && <View style={pcard.onlineDot} />}
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={[pcard.name, { color: textColor }]}>@{person.username}</Text>
      <Text style={[pcard.meta, { color: muted }]}>{person.distance_km?.toFixed(1) || '?'} km away</Text>
      <View style={pcard.interestRow}>
        {(person.interests || ['Music', 'Art']).slice(0, 2).map(int => (
          <Text key={int} style={[pcard.pill, { backgroundColor: `${primary}18`, color: primary }]}>{int}</Text>
        ))}
      </View>
    </View>
    <View style={pcard.actions}>
      <TouchableOpacity style={[pcard.followBtn, { backgroundColor: primary }]} onPress={onFollow}>
        <Text style={pcard.followText}>Follow</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[pcard.msgBtn, { borderColor: `${primary}40` }]}>
        <Feather name="message-circle" size={16} color={primary} />
      </TouchableOpacity>
    </View>
  </View>
);

const pcard = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2 },
  onlineDot: { position: 'absolute', top: 14, left: 50, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#000' },
  name: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 11, marginTop: 2 },
  interestRow: { flexDirection: 'row', gap: 4, marginTop: 5 },
  pill: { fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  actions: { gap: 8, alignItems: 'center' },
  followBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  followText: { color: '#000', fontWeight: '900', fontSize: 12 },
  msgBtn: { padding: 8, borderRadius: 20, borderWidth: 1 },
});

// ── Find Me Sub-View ──────────────────────────────────────────────────────────
const FindMePage = ({ primary, muted, textColor, bg, user, profile, toast }) => {
  const [discoverable, setDiscoverable] = useState(profile?.is_discoverable ?? true);
  const [showOnline, setShowOnline] = useState(profile?.show_online ?? true);
  const [shareEvents, setShareEvents] = useState(profile?.share_events ?? false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [selectedInterests, setSelectedInterests] = useState(profile?.interests || []);
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      bio: bio.trim() || null,
      location: location.trim() || null,
      interests: selectedInterests,
      is_discoverable: discoverable,
    }).eq('id', user.id);
    setSaving(false);
    if (!error) toast?.show('Profile saved!', 'success');
    else toast?.show('Save failed: ' + error.message, 'error');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Discoverable Settings</Text>

        {[
          { label: 'Discoverable', sub: 'Let others find you nearby', val: discoverable, set: setDiscoverable },
          { label: 'Show Online Status', sub: 'Let others see when you\'re active', val: showOnline, set: setShowOnline },
          { label: 'Share Events', sub: 'Show your event activity on your profile', val: shareEvents, set: setShareEvents },
        ].map(item => (
          <View key={item.label} style={[fm.toggleRow, { borderBottomColor: `${primary}15` }]}>
            <View style={{ flex: 1 }}>
              <Text style={[fm.toggleLabel, { color: textColor }]}>{item.label}</Text>
              <Text style={[fm.toggleSub, { color: muted }]}>{item.sub}</Text>
            </View>
            <Switch
              value={item.val}
              onValueChange={item.set}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: `${primary}80` }}
              thumbColor={item.val ? primary : '#aaa'}
            />
          </View>
        ))}
      </GlassView>

      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>My Interests</Text>
        <Text style={[{ color: muted, fontSize: 12, marginBottom: 12, lineHeight: 18 }]}>
          {selectedInterests.length > 0
            ? `${selectedInterests.length} interests selected — shown to nearby vibers.`
            : 'Add your interests to help people discover you.'}
        </Text>
        {selectedInterests.length > 0 && (
          <View style={fm.pillWrap}>
            {selectedInterests.slice(0, 15).map(key => {
              const meta = ALL_CATEGORIES_MAP[key];
              const label = meta?.label || key.replace('custom_', '').replace(/_/g, ' ');
              const color = meta?.color || primary;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSelectedInterests(prev => prev.filter(k => k !== key))}
                  style={[fm.pill, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}
                >
                  <Text style={{ fontSize: 12 }}>{meta?.icon || '✦'}</Text>
                  <Text style={[fm.pillText, { color }]}>{label}</Text>
                  <Feather name="x" size={10} color={color} />
                </TouchableOpacity>
              );
            })}
            {selectedInterests.length > 15 && (
              <Text style={[fm.pillText, { color: muted }]}>+{selectedInterests.length - 15} more</Text>
            )}
          </View>
        )}
        <TouchableOpacity
          style={[fm.catBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}08` }]}
          onPress={() => setCatPickerVisible(true)}
        >
          <Feather name="tag" size={16} color={primary} />
          <Text style={[fm.pillText, { color: primary, fontWeight: '800' }]}>
            {selectedInterests.length > 0 ? 'Edit interests' : 'Choose from 1000+ interests'}
          </Text>
          <Feather name="chevron-right" size={16} color={`${primary}80`} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </GlassView>

      <CategoryPickerModal
        visible={catPickerVisible}
        onClose={() => setCatPickerVisible(false)}
        selected={selectedInterests}
        onConfirm={setSelectedInterests}
        title="My Interests"
      />

      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Bio & Location</Text>
        <TextInput
          style={[fm.input, { color: textColor, borderColor: `${primary}30` }]}
          placeholder="Tell others about yourself..."
          placeholderTextColor={muted}
          multiline
          numberOfLines={3}
          value={bio}
          onChangeText={setBio}
          maxLength={200}
        />
        <View style={[fm.locationRow, { borderColor: `${primary}30` }]}>
          <Feather name="map-pin" size={14} color={muted} style={{ marginRight: 8 }} />
          <TextInput
            style={[fm.locationInput, { color: textColor }]}
            placeholder="Your city or area..."
            placeholderTextColor={muted}
            value={location}
            onChangeText={setLocation}
          />
        </View>
      </GlassView>

      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Put Me Out There</Text>
        <Text style={[{ color: muted, fontSize: 12, marginBottom: 14, lineHeight: 18 }]}>
          When active, nearby vibers can discover your profile in real time.
        </Text>
        <TouchableOpacity
          style={[fm.outThereBtn, discoverable
            ? { backgroundColor: primary, borderColor: primary }
            : { backgroundColor: 'transparent', borderColor: `${primary}40` }
          ]}
          onPress={() => setDiscoverable(d => !d)}
          activeOpacity={0.85}
        >
          <Feather name={discoverable ? 'radio' : 'wifi-off'} size={18} color={discoverable ? '#000' : primary} />
          <Text style={[fm.outThereText, { color: discoverable ? '#000' : primary }]}>
            {discoverable ? 'Discoverable — I\'m out there' : 'Hidden — Go invisible'}
          </Text>
        </TouchableOpacity>
      </GlassView>

      {/* Preview Card */}
      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Preview — How others see you</Text>
        <View style={[fm.previewCard, { borderColor: `${primary}25` }]}>
          {profile?.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={[fm.previewAvatar, { borderColor: primary }]} />
            : <View style={[fm.previewAvatar, { borderColor: primary, backgroundColor: pAvatarBg(profile?.username), alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{pAvatarInitials(profile?.username)}</Text>
              </View>
          }
          <View style={fm.previewInfo}>
            <Text style={[fm.previewName, { color: textColor }]}>@{profile?.username || 'you'}</Text>
            <Text style={[fm.previewBio, { color: muted }]} numberOfLines={2}>{bio || 'No bio yet...'}</Text>
            {location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Feather name="map-pin" size={11} color={muted} />
                <Text style={[fm.previewMeta, { color: muted }]}>{location}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </GlassView>

      {/* Save button */}
      <TouchableOpacity
        style={[fm.saveBtn, { backgroundColor: primary }]}
        onPress={saveProfile}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#000" size="small" />
          : <>
              <Feather name="save" size={16} color="#000" />
              <Text style={fm.saveBtnText}>Save Profile</Text>
            </>
        }
      </TouchableOpacity>
    </ScrollView>
  );
};

const fm = StyleSheet.create({
  section: { margin: 16, padding: 18, borderRadius: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleSub: { fontSize: 11, marginTop: 2 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  locationInput: { flex: 1, fontSize: 13 },
  qrBox: { alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 24 },
  qrInner: { width: 100, height: 100, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  qrText: { fontSize: 10 },
  qrHandle: { fontSize: 16, fontWeight: '900', marginBottom: 4 },
  qrSub: { fontSize: 11 },
  outThereBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 30, borderWidth: 1.5 },
  outThereText: { fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
  previewCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 14 },
  previewAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2 },
  previewInfo: { flex: 1, marginLeft: 12 },
  previewName: { fontSize: 15, fontWeight: '800' },
  previewBio: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  previewMeta: { fontSize: 11 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 20, paddingVertical: 15, borderRadius: 30 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
});

// ── Find Them Sub-View ────────────────────────────────────────────────────────
const FindThemPage = ({ primary, muted, textColor, user, onAuthRequired, toast }) => {
  const [distance, setDistance] = useState(5);
  const [activeFilter, setActiveFilter] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);

  const SAMPLE_PEOPLE = [
    { id: '1', username: 'kayla_vibes', avatar_url: 'https://i.pravatar.cc/80?img=5', distance_km: 1.2, interests: ['Music', 'Art'], is_online: true },
    { id: '2', username: 'thabo_rsa', avatar_url: 'https://i.pravatar.cc/80?img=8', distance_km: 3.7, interests: ['Sports', 'Tech'], is_online: false },
    { id: '3', username: 'nadia_g', avatar_url: 'https://i.pravatar.cc/80?img=9', distance_km: 4.9, interests: ['Fashion', 'Food'], is_online: true },
  ];

  const search = async () => {
    if (!user) { onAuthRequired(); return; }
    setLoading(true);
    const coords = await LocationService.requestAndGet();
    if (coords) LocationService.saveToProfile(user.id, coords.lat, coords.lon);
    const data = await DiscoveryManager.findNobility(user.id, distance);
    setLoading(false);
    setPeople(data && data.length > 0 ? data : SAMPLE_PEOPLE);
    if (!data || data.length === 0) toast.show('Showing nearby viber matches', 'info');
  };

  const displayed = activeFilter
    ? people.filter(p => (p.interests || []).some(i => i === activeFilter || (typeof i === 'string' && i.toLowerCase().includes(activeFilter.toLowerCase()))))
    : people;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Search Radius</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {DIST_OPTIONS.map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setDistance(d)}
              style={[ft.distBtn, { backgroundColor: distance === d ? primary : `${primary}15`, borderColor: distance === d ? primary : `${primary}30` }]}
            >
              <Text style={[ft.distText, { color: distance === d ? '#000' : primary }]}>{d}km</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[fm.sectionTitle, { color: primary }]}>Filter by Interest</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {INTEREST_OPTIONS.slice(0, 8).map(int => {
            const sel = activeFilter === int;
            return (
              <TouchableOpacity
                key={int}
                style={[ft.filterPill, { backgroundColor: sel ? primary : `${primary}15`, borderColor: sel ? primary : `${primary}30` }]}
                onPress={() => setActiveFilter(sel ? null : int)}
              >
                <Text style={[ft.filterText, { color: sel ? '#000' : primary }]}>{int}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[ft.searchBtn, { backgroundColor: primary }]}
          onPress={search}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="search" size={16} color="#000" />
                <Text style={ft.searchText}>Find People Nearby</Text>
              </View>
            )
          }
        </TouchableOpacity>
      </GlassView>

      <View style={{ paddingHorizontal: 16 }}>
        {displayed.length === 0 && !loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 36 }}>📍</Text>
            <Text style={{ color: textColor, fontSize: 15, fontWeight: '800', marginTop: 12 }}>
              No one found nearby
            </Text>
            <Text style={{ color: muted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
              Try increasing your search radius or adjusting your interests filter. Make sure your location is enabled.
            </Text>
          </View>
        ) : (
          displayed.map(person => (
            <FadeInView key={person.id} delay={50} direction="up">
              <PersonCard
                person={person}
                primary={primary}
                muted={muted}
                textColor={textColor}
                onFollow={async () => {
                  if (!user) return;
                  await supabase.from('follows').upsert(
                    { follower_id: user.id, following_id: person.id },
                    { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
                  );
                  toast?.show(`Following @${person.username}`, 'success');
                }}
              />
            </FadeInView>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const ft = StyleSheet.create({
  distBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  distText: { fontSize: 11, fontWeight: '800' },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  filterText: { fontSize: 11, fontWeight: '800' },
  searchBtn: { paddingVertical: 13, borderRadius: 30, alignItems: 'center' },
  searchText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
});

// ── Main Profile Page ─────────────────────────────────────────────────────────
export const ProfilePage = ({ onAuthRequired }) => {
  const { currentTheme, gender, themeIndex, changeTheme } = useTheme();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const toast = useToast();

  const [subView, setSubView] = useState(null); // null | 'findme' | 'findthem'
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('gruvs'); // gruvs|saved|vibed|gallery
  const [settingsTab, setSettingsTab] = useState('discover'); // discover|aura
  const [eventCount, setEventCount] = useState(0);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const username  = profile?.username   || user?.user_metadata?.username || 'Viber';
  const avatarUrl = profile?.avatar_url || null;
  const vibeScore = profile?.vibe_score || 0;

  const avatarInitials = (name) =>
    name ? name.split(/[\s_]/).map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'G';
  const avatarBgColor = (name) => {
    const colors = ['#0891b2', '#0d9488', '#7c3aed', '#dc2626', '#d97706', '#059669'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const handleAvatarUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { toast.show('Photo library permission needed', 'error'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `avatars/${user.id}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: upErr } = await supabase.storage.from('avatars').upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
      refreshProfile();
      toast.show('Avatar updated!', 'success');
    } catch (e) {
      toast.show('Upload failed: ' + e.message, 'error');
    }
  };

  const handleCoverUpload = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { toast.show('Photo library permission needed', 'error'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `covers/${user.id}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ cover_url: urlData.publicUrl }).eq('id', user.id);
      refreshProfile();
      toast.show('Cover photo updated!', 'success');
    } catch (e) {
      toast.show('Cover upload failed: ' + e.message, 'error');
    }
  };

  useEffect(() => {
    if (user) {
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => setEventCount(count || 0))
        .catch(() => {});
    }
  }, [user]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim() || !user) return;
    setSavingUsername(true);
    const { error } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', user.id);
    setSavingUsername(false);
    if (!error) { refreshProfile(); setEditingUsername(false); toast.show('Username updated!', 'success'); }
    else toast.show('Failed to update.', 'error');
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Sign out of The Gruvs?')) signOut();
      return;
    }
    Alert.alert('Sign Out?', 'Are you sure?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out my vibe on The Gruvs! @${username} 👑`,
        url: 'https://thegruvs.com/profile/' + username,
      });
    } catch {}
  };

  // Guest view
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <AuraEffect />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.guestContent}>
          <GlassView style={styles.guestCard} glow>
            <Feather name="user" size={52} color={primary} style={{ marginBottom: 16 }} />
            <Text style={[styles.guestTitle, { color: primary }]}>Join the Gruvs</Text>
            <Text style={[styles.guestSub, { color: muted }]}>
              Sign in to unlock your profile, find nearby people, and track your vibe.
            </Text>
            <TouchableOpacity style={[styles.guestBtn, { backgroundColor: primary }]} onPress={onAuthRequired}>
              <Text style={styles.guestBtnText}>SIGN IN / JOIN NOW</Text>
            </TouchableOpacity>
          </GlassView>
        </ScrollView>
      </View>
    );
  }

  // Sub-views
  if (subView === 'findme') {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.subHeader, { borderBottomColor: `${primary}20` }]}>
          <TouchableOpacity onPress={() => setSubView(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={primary} />
          </TouchableOpacity>
          <Text style={[styles.subTitle, { color: textColor }]}>Find Me</Text>
          <View style={{ width: 40 }} />
        </View>
        <FindMePage primary={primary} muted={muted} textColor={textColor} bg={bg} user={user} profile={profile} toast={toast} />
      </View>
    );
  }

  if (subView === 'findthem') {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.subHeader, { borderBottomColor: `${primary}20` }]}>
          <TouchableOpacity onPress={() => setSubView(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={primary} />
          </TouchableOpacity>
          <Text style={[styles.subTitle, { color: textColor }]}>Find Them</Text>
          <View style={{ width: 40 }} />
        </View>
        <FindThemPage
          primary={primary} muted={muted} textColor={textColor}
          user={user} onAuthRequired={onAuthRequired} toast={toast}
        />
      </View>
    );
  }

  // Main profile
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <AuraEffect />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refreshProfile(); setRefreshing(false); }}
            tintColor={primary}
          />
        }
      >

        {/* Brand Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandLogo size={32} showGlow />
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '900', letterSpacing: 2 }}>MY ROYALTY</Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: `${primary}15`, borderWidth: 1, borderColor: `${primary}30` }}
            onPress={() => setLeaderboardVisible(true)}
          >
            <Feather name="award" size={14} color={primary} />
            <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>Leaderboard</Text>
          </TouchableOpacity>
        </View>

        {/* Cover Photo */}
        <View style={[styles.coverPhoto, { backgroundColor: `${primary}18` }]}>
          {profile?.cover_url
            ? <Image source={{ uri: profile.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <>
                <View style={[styles.coverPattern, { borderColor: `${primary}12` }]} />
                <View style={[styles.coverPatternAlt, { borderColor: `${primary}10` }]} />
              </>
          }
          <TouchableOpacity style={styles.coverEditBtn} onPress={handleCoverUpload}>
            <Feather name="camera" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Avatar Row */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handleAvatarUpload} activeOpacity={0.85}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: primary }]} />
              : <View style={[styles.avatar, { borderColor: primary, backgroundColor: avatarBgColor(username), alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{avatarInitials(username)}</Text>
                </View>
            }
            <View style={[styles.onlineDot, { backgroundColor: '#10b981' }]} />
            <View style={[styles.avatarEditBadge, { backgroundColor: primary }]}>
              <Feather name="camera" size={10} color="#000" />
            </View>
          </TouchableOpacity>
          <View style={styles.avatarActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: primary }]}
              onPress={() => { setNewUsername(username); setEditingUsername(true); }}
            >
              <Feather name="edit-2" size={13} color="#000" />
              <Text style={styles.actionBtnText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: `${primary}50` }]} onPress={handleShareProfile}>
              <Feather name="share-2" size={14} color={primary} />
              <Text style={[styles.actionBtnOutlineText, { color: primary }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name + bio */}
        <View style={styles.nameSection}>
          {editingUsername ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.usernameInput, { color: textColor, borderColor: `${primary}60` }]}
                value={newUsername}
                onChangeText={setNewUsername}
                autoFocus
                placeholder="New username..."
                placeholderTextColor={muted}
              />
              <TouchableOpacity onPress={handleSaveUsername} disabled={savingUsername}>
                {savingUsername
                  ? <ActivityIndicator color={primary} size="small" />
                  : <Text style={[styles.saveText, { color: primary }]}>Save</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingUsername(false)}>
                <Text style={[styles.cancelText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.profileName, { color: textColor }]}>@{username}</Text>
          )}
          <Text style={[styles.profileBio, { color: muted }]}>
            {profile?.bio || 'The Gruvs — I got you ✦'}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={[styles.statsBar, { borderColor: `${primary}18` }]}>
          {[
            { label: 'Gruvs', value: eventCount },
            { label: 'Crew', value: profile?.followers_count || 0 },
            { label: 'Saved', value: profile?.saved_count || 0 },
            { label: 'Vibed', value: vibeScore },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: primary }]}>{s.value}</Text>
                <Text style={[styles.statLab, { color: muted }]}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.statDiv, { backgroundColor: `${primary}20` }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Vibe Level */}
        <View style={{ paddingHorizontal: 16 }}>
            <VibeLevel score={vibeScore} primary={primary} muted={muted} textColor={textColor} />
        </View>

        {/* Streak + Referral */}
        {user && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
            <StreakBadge userId={user.id} primary={primary} muted={muted} />
            <ReferralCard userId={user.id} primary={primary} muted={muted} textColor={textColor} bg={bg} />
          </View>
        )}

        {/* Achievement badges */}
        {user && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <AchievementBadges userId={user.id} primary={primary} muted={muted} textColor={textColor} />
          </View>
        )}

        {/* Find Me / Find Them buttons */}
        <View style={styles.findRow}>
          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
            onPress={() => setSubView('findme')}
          >
            <Feather name="user-check" size={16} color={primary} />
            <Text style={[styles.findBtnText, { color: primary }]}>Find Me</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
            onPress={() => setSubView('findthem')}
          >
            <Feather name="users" size={16} color={primary} />
            <Text style={[styles.findBtnText, { color: primary }]}>Find Them</Text>
          </TouchableOpacity>
        </View>

        {/* Gruv Analytics */}
        <GlassView style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primary }]}>Gruv Analytics</Text>
          <Text style={[styles.sectionSub, { color: muted }]}>This week's activity</Text>
          <AnalyticsChart primary={primary} muted={muted} textColor={textColor} userId={user?.id} />
        </GlassView>

        {/* Royal Pass Benefits */}
        <GlassView style={[styles.section, { backgroundColor: primary + '08' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <MaterialCommunityIcons name="crown" size={24} color={primary} />
                <Text style={[styles.sectionTitle, { color: primary, marginBottom: 0 }]}>ROYAL PASS BENEFITS</Text>
            </View>
            {[
                { icon: 'check-decagram', text: 'Priority Feed Placement' },
                { icon: 'map-marker-star', text: 'Unlimited Proximity Search' },
                { icon: 'camera-burst', text: 'HD Community Gallery Uploads' },
                { icon: 'shield-check', text: 'Exclusive "Royal" Aura Themes' },
            ].map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                    <MaterialCommunityIcons name={b.icon} size={16} color={primary} />
                    <Text style={[styles.benefitText, { color: textColor }]}>{b.text}</Text>
                </View>
            ))}
        </GlassView>

        {/* Profile Content Tabs */}
        <View style={[styles.contentTabRow, { borderColor: `${primary}20` }]}>
          {[
            { key: 'gruvs',   label: 'My Gruvs',  icon: 'calendar' },
            { key: 'saved',   label: 'Saved',      icon: 'bookmark' },
            { key: 'vibed',   label: 'Vibed',      icon: 'zap' },
            { key: 'gallery', label: 'Gallery',    icon: 'image' },
          ].map(t => {
            const isActive = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.contentTab, isActive && { borderBottomColor: primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(t.key)}
              >
                <Feather name={t.icon} size={15} color={isActive ? primary : muted} />
                <Text style={[styles.contentTabLabel, { color: isActive ? primary : muted }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'gruvs' && (
            <View style={{ gap: 10 }}>
              {SAMPLE_EVENTS.slice(0, 3).map((ev, i) => {
                const img = ev.media?.find(m => m.type === 'image');
                return (
                  <View key={i} style={[styles.miniCard, { borderColor: `${primary}20` }]}>
                    {img && <Image source={{ uri: img.url }} style={styles.miniCardImg} resizeMode="cover" />}
                    <View style={styles.miniCardInfo}>
                      <Text style={[styles.miniCardTitle, { color: textColor }]} numberOfLines={1}>{ev.title}</Text>
                      <Text style={[styles.miniCardMeta, { color: muted }]}>{ev.event_date ? new Date(ev.event_date).toDateString() : 'Upcoming'}</Text>
                      <View style={[styles.miniCardBadge, { backgroundColor: `${primary}18` }]}>
                        <Text style={[styles.miniCardBadgeText, { color: primary }]}>{ev.category || 'Gruv'}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {activeTab === 'saved' && (
            <View style={{ gap: 10 }}>
              {SAMPLE_EVENTS.slice(3, 6).map((ev, i) => {
                const img = ev.media?.find(m => m.type === 'image');
                return (
                  <View key={i} style={[styles.miniCard, { borderColor: `${primary}20` }]}>
                    {img && <Image source={{ uri: img.url }} style={styles.miniCardImg} resizeMode="cover" />}
                    <View style={styles.miniCardInfo}>
                      <Text style={[styles.miniCardTitle, { color: textColor }]} numberOfLines={1}>{ev.title}</Text>
                      <Text style={[styles.miniCardMeta, { color: muted }]}>{ev.location || 'Location TBD'}</Text>
                      <View style={[styles.miniCardBadge, { backgroundColor: `${primary}18` }]}>
                        <Feather name="bookmark" size={10} color={primary} />
                        <Text style={[styles.miniCardBadgeText, { color: primary }]}>Saved</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {activeTab === 'vibed' && (
            <View style={{ gap: 10 }}>
              {SAMPLE_EVENTS.slice(6, 9).map((ev, i) => {
                const img = ev.media?.find(m => m.type === 'image');
                return (
                  <View key={i} style={[styles.miniCard, { borderColor: `${primary}20` }]}>
                    {img && <Image source={{ uri: img.url }} style={styles.miniCardImg} resizeMode="cover" />}
                    <View style={styles.miniCardInfo}>
                      <Text style={[styles.miniCardTitle, { color: textColor }]} numberOfLines={1}>{ev.title}</Text>
                      <Text style={[styles.miniCardMeta, { color: muted }]}>{ev.vibe_count || 0} vibes</Text>
                      <View style={[styles.miniCardBadge, { backgroundColor: `${primary}18` }]}>
                        <Feather name="zap" size={10} color={primary} />
                        <Text style={[styles.miniCardBadgeText, { color: primary }]}>Vibed</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {activeTab === 'gallery' && (
            <View style={styles.galleryGrid}>
              {SAMPLE_EVENTS.slice(0, 9).map((ev, i) => {
                const media = ev.media?.find(m => m.type === 'image');
                return media ? (
                  <Image
                    key={i}
                    source={{ uri: media.url }}
                    style={[styles.galleryCell, { borderColor: `${primary}15` }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View key={i} style={[styles.galleryCell, { backgroundColor: `${primary}12`, borderColor: `${primary}15` }]}>
                    <Feather name="image" size={22} color={`${primary}40`} />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Settings Tabs */}
        <View style={[styles.settingsTabs, { borderColor: `${primary}20` }]}>
          {[
            { key: 'discover', label: 'Discover', icon: 'compass' },
            { key: 'aura',     label: 'My Aura',  icon: 'droplet' },
          ].map(t => {
            const isActive = settingsTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.settingsTab, isActive && { backgroundColor: primary }]}
                onPress={() => setSettingsTab(t.key)}
              >
                <Feather name={t.icon} size={14} color={isActive ? '#000' : muted} />
                <Text style={[styles.settingsTabText, { color: isActive ? '#000' : muted }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Discover Settings */}
        {settingsTab === 'discover' && (
          <GlassView style={styles.section}>
            <Text style={[styles.sectionTitle, { color: primary }]}>Discover People</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {DIST_OPTIONS.map(d => (
                <TouchableOpacity key={d} style={[ft.distBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}25` }]}>
                  <Text style={[ft.distText, { color: primary }]}>{d}km</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.findLargeBtn, { backgroundColor: primary }]}
              onPress={() => setSubView('findthem')}
            >
              <Feather name="users" size={16} color="#000" />
              <Text style={styles.findLargeBtnText}>Open Find Them</Text>
            </TouchableOpacity>
          </GlassView>
        )}

        {/* Aura / Theme Picker */}
        {settingsTab === 'aura' && (
          <GlassView style={styles.section}>
            <Text style={[styles.sectionTitle, { color: primary }]}>Switch Aura</Text>
            <View style={styles.genderRow}>
              {Object.entries(GENDERS).map(([key, val]) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => changeTheme(val, 0)}
                  style={[styles.genderBtn, {
                    backgroundColor: gender === val ? `${primary}22` : 'transparent',
                    borderColor: gender === val ? primary : 'rgba(255,255,255,0.15)',
                  }]}
                >
                  <Text style={[styles.genderText, { color: gender === val ? primary : muted }]}>
                    {val.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
              {THEMES[gender].map((t, idx) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => changeTheme(gender, idx)}
                  style={[styles.themeCard, {
                    backgroundColor: t.background,
                    borderColor: themeIndex === idx ? '#fff' : 'transparent',
                    borderWidth: themeIndex === idx ? 2.5 : 0,
                  }]}
                >
                  <View style={[styles.themeAccent, { backgroundColor: t.primary }]} />
                  <Text style={[styles.themeName, { color: t.text || '#fff' }]}>{t.name}</Text>
                  {themeIndex === idx && (
                    <View style={[styles.activeCheck, { backgroundColor: t.primary }]}>
                      <Feather name="check" size={10} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </GlassView>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Feather name="log-out" size={16} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      <LeaderboardScreen
        visible={leaderboardVisible}
        onClose={() => setLeaderboardVisible(false)}
        currentUserId={user?.id}
      />
    </View>
  );
};

const COVER_H = 140;
const AVATAR_SIZE = 86;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Sub-view header
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },

  // Cover
  coverPhoto: { height: COVER_H, overflow: 'hidden', position: 'relative' },
  coverPattern: { position: 'absolute', top: -30, left: -30, width: 220, height: 220, borderRadius: 110, borderWidth: 40 },
  coverPatternAlt: { position: 'absolute', bottom: -50, right: -30, width: 180, height: 180, borderRadius: 90, borderWidth: 35 },
  coverEditBtn: { position: 'absolute', bottom: 10, right: 14, backgroundColor: 'rgba(0,0,0,0.55)', padding: 8, borderRadius: 20 },

  // Avatar row
  avatarSection: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -(AVATAR_SIZE / 2), marginBottom: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 3, backgroundColor: '#111' },
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#000' },
  avatarEditBadge: { position: 'absolute', bottom: 18, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000' },
  avatarActions: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  actionBtnOutlineText: { fontWeight: '900', fontSize: 12 },

  // Name
  nameSection: { paddingHorizontal: 16, marginBottom: 14 },
  profileName: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  profileBio: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  usernameInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, fontSize: 15, fontWeight: '700', flex: 1 },
  saveText: { fontWeight: '900', fontSize: 14 },
  cancelText: { fontSize: 13 },

  // Stats
  statsBar: { flexDirection: 'row', marginHorizontal: 16, borderWidth: 1, borderRadius: 16, paddingVertical: 14, marginBottom: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLab: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 },
  statDiv: { width: 1, height: 36 },

  // Find row
  findRow: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 14 },
  findBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 16, borderWidth: 1 },
  findBtnText: { fontWeight: '900', fontSize: 13 },

  // Analytics
  section: { margin: 16, padding: 18, borderRadius: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  sectionSub: { fontSize: 11, marginBottom: 14 },

  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  benefitText: { fontSize: 12, fontWeight: '600', opacity: 0.9 },

  // Content tabs
  contentTabRow: { flexDirection: 'row', marginHorizontal: 16, borderBottomWidth: 1, marginBottom: 14 },
  contentTab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  contentTabLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  tabContent: { paddingHorizontal: 16, marginBottom: 14 },
  emptyTab: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 36, alignItems: 'center', gap: 12 },
  emptyTabText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  miniCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  miniCardImg: { width: 72, height: 72 },
  miniCardInfo: { flex: 1, padding: 10, gap: 4 },
  miniCardTitle: { fontSize: 13, fontWeight: '800' },
  miniCardMeta: { fontSize: 11 },
  miniCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  miniCardBadgeText: { fontSize: 10, fontWeight: '800' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryCell: { width: (width - 44) / 3, height: (width - 44) / 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  // Settings tabs
  settingsTabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, borderRadius: 30, borderWidth: 1, overflow: 'hidden' },
  settingsTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  settingsTabText: { fontWeight: '800', fontSize: 12 },

  // Discover section
  findLargeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 30 },
  findLargeBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  // Aura
  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  genderText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  themeCard: { width: 110, height: 110, borderRadius: 16, marginRight: 12, justifyContent: 'flex-end', padding: 10, overflow: 'hidden' },
  themeAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  themeName: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  activeCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Guest
  guestContent: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 80, alignItems: 'center' },
  guestCard: { width: '100%', padding: 36, alignItems: 'center', marginBottom: 20, borderRadius: 24 },
  guestTitle: { fontSize: 26, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
  guestSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  guestBtn: { paddingVertical: 15, paddingHorizontal: 32, borderRadius: 30 },
  guestBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  // Sign out
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, marginBottom: 20, paddingVertical: 14, borderRadius: 30, borderWidth: 1.5, borderColor: '#ef4444' },
  signOutText: { color: '#ef4444', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
