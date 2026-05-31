import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AwardManager, MembershipManager, ClubManager } from '../services/clubEngine';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Animated, Alert, TextInput, ActivityIndicator,
  Switch, Dimensions, Share, Platform, RefreshControl, Modal,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GlassView } from '../components/GlassView';
import { FadeInView } from '../components/FadeInView';
import { Biometric } from '../services/biometric';
import { haptics } from '../utils/haptics';
import { LiquidBackground } from '../components/LiquidBackground';
import { THEMES, GENDERS } from '../constants/Themes';
import { BrandLogo } from '../components/BrandLogo';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { thumb } from '../utils/storageThumb';
import { DiscoveryManager, UserManager, AnalyticsManager, BehavioralEngine, ActivityFeedManager, isOnline as checkOnline } from '../services/dataFlow';
import { resilient, resilientRead } from '../utils/resilience';
import { LocationService } from '../services/locationService';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { ALL_CATEGORIES_MAP } from '../constants/AllCategories';
import { useToast } from '../components/ToastNotification';
import { StreakBadge, useStreak } from '../components/StreakBadge';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SafeSection } from '../components/SafeSection';
import { useIdentity } from '../context/IdentityContext';
import { RoyalGovernance } from '../services/royalGovernance';
import { BiometricAuth, RichHaptics } from '../services/smartphoneFeatures';
import { useTutorial } from '../context/TutorialContext';
import { uploadToStorage } from '../services/storageService';
import { AchievementBadges } from '../components/AchievementBadges';
import { StreakBadges } from '../components/StreakBadges';
import { ReferralCard } from '../components/ReferralCard';
import { SocialIntegrityBadge } from '../components/SocialIntegrityBadge';

// ── Lazy-loaded section components ──
const DirectMessageModal    = React.lazy(() => import('../components/DirectMessageModal').then(m => ({ default: m.DirectMessageModal })));
const CategoryPickerModal   = React.lazy(() => import('../components/CategoryPickerModal').then(m => ({ default: m.CategoryPickerModal })));
const PostEventModal        = React.lazy(() => import('../components/PostEventModal').then(m => ({ default: m.PostEventModal })));
const EditEventModal        = React.lazy(() => import('../components/EditEventModal').then(m => ({ default: m.EditEventModal })));
const LeaderboardScreen     = React.lazy(() => import('./LeaderboardScreen').then(m => ({ default: m.LeaderboardScreen })));
const PathMapScreen         = React.lazy(() => import('./PathMapScreen').then(m => ({ default: m.PathMapScreen })));
const BusinessDashboardScreen = React.lazy(() => import('./BusinessDashboardScreen').then(m => ({ default: m.BusinessDashboardScreen })));
const WalletScreen          = React.lazy(() => import('./WalletScreen').then(m => ({ default: m.WalletScreen })));
const ProviderDashboardScreen = React.lazy(() => import('./ProviderDashboardScreen').then(m => ({ default: m.ProviderDashboardScreen })));
const TutorialCenter        = React.lazy(() => import('../components/TutorialCenter').then(m => ({ default: m.TutorialCenter })));
const WhoWasThereModal      = React.lazy(() => import('../components/WhoWasThereModal').then(m => ({ default: m.WhoWasThereModal })));
const EventTicketModal      = React.lazy(() => import('../components/EventTicketModal').then(m => ({ default: m.EventTicketModal })));
const CreateReelModal       = React.lazy(() => import('../components/CreateReelModal').then(m => ({ default: m.CreateReelModal })));

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
  const span = next ? (next.min - current.min) : 1;
  const progress = next ? Math.min(100, ((score - current.min) / span) * 100) : 100;

  return (
    <View style={lvl.wrap}>
      <View style={lvl.row}>
        <Text style={[lvl.name, { color: textColor }]}>{current.name}</Text>
        <Text style={[lvl.score, { color: primary }]}>{score} pts</Text>
      </View>
      <View
        style={[lvl.track, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
        accessibilityRole="progressbar"
        accessibilityLabel={`Vibe level progress: ${score} points, ${Math.round(progress)}% to ${next ? next.name : 'max level'}`}
        {...(Platform.OS === 'web' ? { role: 'progressbar', 'aria-valuenow': Math.round(progress), 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}
      >
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
      // Removed demo mode fallback. Real data required.
      try {
        const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const [rsvpSettled, vibeSettled] = await Promise.allSettled([
          supabase
            .from('event_rsvps')
            .select('created_at, events!inner(author_id)')
            .eq('events.author_id', userId)
            .gte('created_at', since),
          supabase
            .from('event_vibes')
            .select('created_at, events!inner(author_id)')
            .eq('events.author_id', userId)
            .gte('created_at', since),
        ]);
        const rsvps = rsvpSettled.status === 'fulfilled' ? (rsvpSettled.value?.data || []) : [];
        const vibes = vibeSettled.status === 'fulfilled' ? (vibeSettled.value?.data || []) : [];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        [...rsvps, ...vibes].forEach(item => {
          if (!item.created_at) return;
          const day = new Date(item.created_at).getDay();
          const idx = day === 0 ? 6 : day - 1;
          dayCounts[idx]++;
        });
        setValues(dayCounts);
        const total = rsvps.length + vibes.length;
        const avgVibes = vibes.length > 0 ? (vibes.length / 7).toFixed(1) : '0';
        const rsvpRate = total > 0 ? Math.round((rsvps.length / total) * 100) : 0;
        setStats({ views: total, visits: rsvps.length, avgVibes, rsvpRate: `${rsvpRate}%` });
      } catch { }
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

const PersonCard = ({ person, primary, muted, textColor, onFollow, onMessage }) => (
  <View style={[pcard.wrap, { borderColor: `${primary}18` }]}>
    {person.avatar_url
      ? <Image source={{ uri: thumb.avatar(person.avatar_url) }} style={[pcard.avatar, { borderColor: `${primary}50` }]} />
      : <View style={[pcard.avatar, { borderColor: `${primary}50`, backgroundColor: pAvatarBg(person.username), alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{pAvatarInitials(person.username)}</Text>
      </View>
    }
    {checkOnline(person) && <View style={pcard.onlineDot} />}
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={[pcard.name, { color: textColor }]}>@{person.username}</Text>
      <Text style={[pcard.meta, { color: muted }]}>{person.distance_km?.toFixed(1) || '?'} km away</Text>
      <View style={pcard.interestRow}>
        {(person.interests || []).slice(0, 2).map(int => (
          <Text key={int} style={[pcard.pill, { backgroundColor: `${primary}18`, color: primary }]}>{int}</Text>
        ))}
      </View>
    </View>
    <View style={pcard.actions}>
      <TouchableOpacity style={[pcard.followBtn, { backgroundColor: primary }]} onPress={onFollow}>
        <Text style={pcard.followText}>Follow</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[pcard.msgBtn, { borderColor: `${primary}40` }]} onPress={onMessage}>
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
  const [looksDescription, setLooksDescription] = useState('');
  const [careerTitle, setCareerTitle] = useState('');
  const [careerDescription, setCareerDescription] = useState('');
  const [profileGallery, setProfileGallery] = useState([]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_url, bio, location, interests, career_title, career_description, looks_description, profile_gallery, vibe_score, is_verified, share_events, show_online, identity_mode, is_discoverable, is_beacon_active, push_token, first_name, surname, email, age, siblings, emergency_contacts').eq('id', user.id).single();
      if (data) {
        setBio(data.bio || '');
        setLocation(data.location || '');
        setInterests(data.interests || []);
        setSelectedInterests(data.interests || []);
        setLooksDescription(data.looks_description || '');
        setCareerTitle(data.career_title || '');
        setCareerDescription(data.career_description || '');
        setProfileGallery(data.profile_gallery || []);
        setFirstName(data.first_name || '');
        setSurname(data.surname || '');
        setProfileEmail(data.email || '');
        setProfileAge(data.age ? String(data.age) : '');
        setSiblings(data.siblings || []);
        setEmergencyContacts(data.emergency_contacts || []);
      }
    } catch (err) {
      toast?.show('Failed to refresh profile', 'error');
    }
  }, [user]);

  const [shareEvents, setShareEvents] = useState(profile?.share_events ?? false);
  // AI bio generation — HIDDEN under development
  // const [aiBioOptions, setAiBioOptions]     = useState([]);
  // const [aiBioLoading, setAiBioLoading]     = useState(false);
  // const [aiBioVisible, setAiBioVisible]     = useState(false);
  // const handleGenerateBio = async () => { /* disabled */ };
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [selectedInterests, setSelectedInterests] = useState(profile?.interests || []);
  const [interests, setInterests] = useState(profile?.interests || []);
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  // Shared fields (also used by linked Next.js app)
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [surname, setSurname] = useState(profile?.surname || '');
  const [profileEmail, setProfileEmail] = useState(profile?.email || '');
  const [profileAge, setProfileAge] = useState(profile?.age ? String(profile.age) : '');
  const [siblings, setSiblings] = useState(profile?.siblings || []);
  const [emergencyContacts, setEmergencyContacts] = useState(profile?.emergency_contacts || []);
  const [newSibling, setNewSibling] = useState({ name: '', age: '', relationship: '' });
  const [newContact, setNewContact] = useState({ name: '', phone: '', relationship: '' });
  const [addingSibling, setAddingSibling] = useState(false);
  const [addingContact, setAddingContact] = useState(false);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        bio: bio.trim() || null,
        location: location.trim() || null,
        interests: selectedInterests,
        first_name: firstName.trim() || null,
        surname: surname.trim() || null,
        email: profileEmail.trim() || null,
        age: profileAge ? parseInt(profileAge, 10) : null,
        siblings,
        emergency_contacts: emergencyContacts,
      };
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (!error) {
        // Best-effort: update discoverable (column may not exist yet)
        await supabase.from('profiles').update({ is_discoverable: discoverable }).eq('id', user.id).catch(() => {});
        toast?.show('Profile saved!', 'success');
      } else {
        toast?.show('Save failed: ' + error.message, 'error');
      }
    } catch (e) {
      toast?.show('Save failed: ' + (e?.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={[fm.sectionTitle, { color: primary, marginBottom: 0 }]}>Bio & Location</Text>
          {/* AI Write button — HIDDEN under development */}
        </View>
        {/* AI bio options picker — HIDDEN under development */}

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
          <TouchableOpacity
            onPress={async () => {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') { toast?.show('Location permission required', 'error'); return; }

              const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.BestForNavigation,
              });

              const coords = loc.coords;
              setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
            }}
            style={{ padding: 4 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="crosshair" size={16} color={primary} />
          </TouchableOpacity>
        </View>
      </GlassView>

      {/* ── Personal Info (shared with linked apps) ── */}
      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Personal Info</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <TextInput
            style={[fm.input, { flex: 1, color: textColor, borderColor: `${primary}30` }]}
            placeholder="First name"
            placeholderTextColor={muted}
            value={firstName}
            onChangeText={setFirstName}
            maxLength={50}
          />
          <TextInput
            style={[fm.input, { flex: 1, color: textColor, borderColor: `${primary}30` }]}
            placeholder="Surname"
            placeholderTextColor={muted}
            value={surname}
            onChangeText={setSurname}
            maxLength={50}
          />
        </View>
        <TextInput
          style={[fm.input, { color: textColor, borderColor: `${primary}30`, marginBottom: 10 }]}
          placeholder="Email address"
          placeholderTextColor={muted}
          value={profileEmail}
          onChangeText={setProfileEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={120}
        />
        <TextInput
          style={[fm.input, { color: textColor, borderColor: `${primary}30`, marginBottom: 10 }]}
          placeholder="Age"
          placeholderTextColor={muted}
          value={profileAge}
          onChangeText={v => setProfileAge(v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          maxLength={3}
        />

        {/* Siblings */}
        <Text style={[fm.subLabel, { color: muted }]}>SIBLINGS</Text>
        {siblings.map((s, i) => (
          <View key={i} style={[fm.contactRow, { borderColor: `${primary}20` }]}>
            <Text style={{ color: textColor, flex: 1 }}>{s.name}{s.age ? `, ${s.age}` : ''} — {s.relationship}</Text>
            <TouchableOpacity onPress={() => setSiblings(prev => prev.filter((_, idx) => idx !== i))}>
              <Feather name="x" size={16} color={muted} />
            </TouchableOpacity>
          </View>
        ))}
        {addingSibling ? (
          <View style={{ gap: 6, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput style={[fm.input, { flex: 2, marginBottom: 0, color: textColor, borderColor: `${primary}30` }]} placeholder="Name" placeholderTextColor={muted} value={newSibling.name} onChangeText={v => setNewSibling(p => ({ ...p, name: v }))} />
              <TextInput style={[fm.input, { flex: 1, marginBottom: 0, color: textColor, borderColor: `${primary}30` }]} placeholder="Age" placeholderTextColor={muted} value={newSibling.age} onChangeText={v => setNewSibling(p => ({ ...p, age: v.replace(/[^0-9]/g, '') }))} keyboardType="numeric" maxLength={3} />
            </View>
            <TextInput style={[fm.input, { marginBottom: 0, color: textColor, borderColor: `${primary}30` }]} placeholder="Relationship (e.g. sister)" placeholderTextColor={muted} value={newSibling.relationship} onChangeText={v => setNewSibling(p => ({ ...p, relationship: v }))} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[fm.addRowBtn, { flex: 1, justifyContent: 'center', borderColor: `${primary}50`, borderStyle: 'solid', backgroundColor: `${primary}15` }]} onPress={() => { if (newSibling.name) { setSiblings(prev => [...prev, { name: newSibling.name, age: parseInt(newSibling.age) || 0, relationship: newSibling.relationship }]); setNewSibling({ name: '', age: '', relationship: '' }); setAddingSibling(false); } }}>
                <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[fm.addRowBtn, { flex: 1, justifyContent: 'center', borderColor: `${muted}40`, borderStyle: 'solid' }]} onPress={() => { setAddingSibling(false); setNewSibling({ name: '', age: '', relationship: '' }); }}>
                <Text style={{ color: muted, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[fm.addRowBtn, { borderColor: `${primary}30` }]} onPress={() => setAddingSibling(true)}>
            <Feather name="plus" size={14} color={primary} />
            <Text style={{ color: primary, fontSize: 13, fontWeight: '700' }}>Add sibling</Text>
          </TouchableOpacity>
        )}

        {/* Emergency Contacts */}
        <Text style={[fm.subLabel, { color: muted, marginTop: 12 }]}>EMERGENCY CONTACTS</Text>
        {emergencyContacts.map((c, i) => (
          <View key={i} style={[fm.contactRow, { borderColor: `${primary}20` }]}>
            <Text style={{ color: textColor, flex: 1 }}>{c.name} — {c.phone} ({c.relationship})</Text>
            <TouchableOpacity onPress={() => setEmergencyContacts(prev => prev.filter((_, idx) => idx !== i))}>
              <Feather name="x" size={16} color={muted} />
            </TouchableOpacity>
          </View>
        ))}
        {addingContact ? (
          <View style={{ gap: 6, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput style={[fm.input, { flex: 1, marginBottom: 0, color: textColor, borderColor: `${primary}30` }]} placeholder="Name" placeholderTextColor={muted} value={newContact.name} onChangeText={v => setNewContact(p => ({ ...p, name: v }))} />
              <TextInput style={[fm.input, { flex: 1, marginBottom: 0, color: textColor, borderColor: `${primary}30` }]} placeholder="+27821234567" placeholderTextColor={muted} value={newContact.phone} onChangeText={v => setNewContact(p => ({ ...p, phone: v }))} keyboardType="phone-pad" />
            </View>
            <TextInput style={[fm.input, { marginBottom: 0, color: textColor, borderColor: `${primary}30` }]} placeholder="Relationship (e.g. mother)" placeholderTextColor={muted} value={newContact.relationship} onChangeText={v => setNewContact(p => ({ ...p, relationship: v }))} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[fm.addRowBtn, { flex: 1, justifyContent: 'center', borderColor: `${primary}50`, borderStyle: 'solid', backgroundColor: `${primary}15` }]} onPress={() => { if (newContact.name && newContact.phone) { setEmergencyContacts(prev => [...prev, { name: newContact.name, phone: newContact.phone, relationship: newContact.relationship }]); setNewContact({ name: '', phone: '', relationship: '' }); setAddingContact(false); } }}>
                <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[fm.addRowBtn, { flex: 1, justifyContent: 'center', borderColor: `${muted}40`, borderStyle: 'solid' }]} onPress={() => { setAddingContact(false); setNewContact({ name: '', phone: '', relationship: '' }); }}>
                <Text style={{ color: muted, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[fm.addRowBtn, { borderColor: `${primary}30` }]} onPress={() => setAddingContact(true)}>
            <Feather name="plus" size={14} color={primary} />
            <Text style={{ color: primary, fontSize: 13, fontWeight: '700' }}>Add emergency contact</Text>
          </TouchableOpacity>
        )}
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
            ? <Image source={{ uri: thumb.avatar(profile.avatar_url) }} style={[fm.previewAvatar, { borderColor: primary }]} />
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
  subLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
});

// ── Royal Council Sub-View ────────────────────────────────────────────────────
const RoyalCouncilPage = ({ primary, textColor, muted, user, toast }) => {
  const [proposals, setProposals] = useState([]);
  const [mintStats, setMintStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      supabase.from('governance_proposals').select('*').eq('status', 'voting_open'),
      supabase.from('profiles').select('vibe_equity', { count: 'exact', head: true })
    ]).then(([propSettled, supplySettled]) => {
      const propData = propSettled.status === 'fulfilled' ? propSettled.value?.data : null;
      const totalSupply = supplySettled.status === 'fulfilled' ? supplySettled.value?.count : 0;
      setProposals(propData || []);
      const halvingInterval = projectDNA.sovereign_mint_params.halving_interval_equity;
      const phase = Math.floor((totalSupply || 0) / halvingInterval);
      setMintStats({
        totalSupply: totalSupply || 0,
        phase: phase + 1,
        nextHalving: (phase + 1) * halvingInterval,
        burnRate: projectDNA.sovereign_mint_params.vibe_burn_rate * 100
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const vote = async (id, type) => {
    try {
      await RoyalGovernance.castRoyalVote(user.id, id, type);
      toast.show("Your decree has been recorded, Royal Viber.", "success");
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
      {/* Sovereign Mint Stats */}
      <GlassView style={[fm.section, { borderColor: '#FFD70040', marginBottom: 20 }]}>
        <Text style={[fm.sectionTitle, { color: '#FFD700' }]}>Sovereign Mint Status</Text>
        {mintStats ? (
          <View style={{ gap: 8, marginTop: 10 }}>
            <View style={styles.mintStatRow}>
              <Text style={{ color: muted, fontSize: 12 }}>Global Supply</Text>
              <Text style={{ color: textColor, fontWeight: '800' }}>{mintStats.totalSupply.toLocaleString()} Equity</Text>
            </View>
            <View style={styles.mintStatRow}>
              <Text style={{ color: muted, fontSize: 12 }}>Minting Phase</Text>
              <Text style={{ color: '#FFD700', fontWeight: '900' }}>Phase {mintStats.phase}</Text>
            </View>
            <View style={styles.mintStatRow}>
              <Text style={{ color: muted, fontSize: 12 }}>Next Halving</Text>
              <Text style={{ color: textColor }}>at {mintStats.nextHalving.toLocaleString()}</Text>
            </View>
            <View style={styles.mintStatRow}>
              <Text style={{ color: muted, fontSize: 12 }}>Protocol Burn Rate</Text>
              <Text style={{ color: '#ef4444', fontWeight: '700' }}>{mintStats.burnRate}%</Text>
            </View>
          </View>
        ) : <ActivityIndicator color="#FFD700" />}
      </GlassView>

      <GlassView style={[fm.section, { borderColor: '#FFD70060', backgroundColor: '#FFD70008' }]}>
        <Text style={[fm.sectionTitle, { color: '#FFD700' }]}>Active Decrees</Text>
        <Text style={{ color: muted, fontSize: 11, marginBottom: 16 }}>
          Stake your Vibe-Equity to shape the Kingdom's economic laws.
        </Text>

        {loading ? <ActivityIndicator color="#FFD700" /> : proposals.map(p => (
          <View key={p.id} style={{ marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,215,0,0.1)', paddingBottom: 16 }}>
            <Text style={{ color: textColor, fontWeight: '900', fontSize: 15 }}>{p.title}</Text>
            <Text style={{ color: muted, fontSize: 12, marginTop: 4, lineHeight: 18 }}>{p.description}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => vote(p.id, 'yes')} style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#10b98120', borderWidth: 1, borderColor: '#10b98150', alignItems: 'center' }}>
                <Text style={{ color: '#10b981', fontWeight: '900', fontSize: 12 }}>DECREE YES</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => vote(p.id, 'no')} style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#ef444420', borderWidth: 1, borderColor: '#ef444450', alignItems: 'center' }}>
                <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 12 }}>DECREE NO</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </GlassView>
    </ScrollView>
  );
};

// ── Security & Privacy Sub-View ───────────────────────────────────────────────
const SecurityPage = ({ primary, muted, textColor, user, toast }) => {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [avail, on, label] = await Promise.all([
        Biometric.isAvailable(), Biometric.isLockEnabled(), Biometric.label(),
      ]);
      if (!alive) return;
      setBioAvailable(avail); setLockEnabled(on); setBioLabel(label);
    })();
    return () => { alive = false; };
  }, []);

  const toggleLock = async () => {
    haptics.select();
    if (!lockEnabled) {
      // Require a successful auth before turning the lock ON
      const ok = await Biometric.authenticate('Confirm to enable app lock');
      if (!ok) { toast.show('Could not verify — lock not enabled', 'error'); return; }
      await Biometric.setLockEnabled(true); setLockEnabled(true);
      haptics.success(); toast.show(`App lock on — ${bioLabel} required to open`, 'success');
    } else {
      await Biometric.setLockEnabled(false); setLockEnabled(false);
      toast.show('App lock off', 'info');
    }
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    Alert.alert(
      "Delete Account?",
      "Your profile will be hidden immediately and your data will be permanently removed after review. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ok = await SecurityService.requestAccountDeletion(user.id);
            if (ok) toast.show("Deletion requested. You will be signed out.", "info");
          }
        }
      ]
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Encryption & Safety</Text>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="lock" size={18} color={primary} />
            <View>
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>End-to-End Encryption</Text>
              <Text style={{ color: muted, fontSize: 11 }}>Your DMs are private and encrypted.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="shield" size={18} color={primary} />
            <View>
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>Session Integrity</Text>
              <Text style={{ color: muted, fontSize: 11 }}>Protected by Supabase Auth with secure tokens.</Text>
            </View>
          </View>

          {/* Biometric app lock */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            onPress={toggleLock}
            activeOpacity={0.8}
            disabled={!bioAvailable && Platform.OS !== 'web'}
          >
            <Feather name="smartphone" size={18} color={lockEnabled ? primary : muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>App Lock ({bioLabel})</Text>
              <Text style={{ color: muted, fontSize: 11 }}>
                {bioAvailable || Platform.OS === 'web'
                  ? `Require ${bioLabel} every time the app opens.`
                  : 'No biometrics enrolled on this device.'}
              </Text>
            </View>
            <View style={{
              width: 44, height: 26, borderRadius: 13, padding: 3,
              backgroundColor: lockEnabled ? primary : `${muted}40`,
              alignItems: lockEnabled ? 'flex-end' : 'flex-start', justifyContent: 'center',
            }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
            </View>
          </TouchableOpacity>
        </View>
      </GlassView>

      <GlassView style={fm.section}>
        <Text style={[fm.sectionTitle, { color: primary }]}>Privacy Preferences</Text>
        <Text style={{ color: muted, fontSize: 12, marginBottom: 16 }}>
          Manage your presence and visibility. Use Identity Modes (Ghost/Celebrity) on the main profile to fuzz your location or stay invisible.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: `${primary}15`, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: `${primary}30`, marginBottom: 12 }}
          onPress={() => Share.share({ message: 'Join me on The Gruvs — safer social discovery.' })}
        >
          <Text style={{ color: primary, fontWeight: '900', textAlign: 'center' }}>Invite a Friend</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ padding: 14 }}
          onPress={() => Linking.openURL('https://thegruvs.com/privacy')}
        >
          <Text style={{ color: muted, fontWeight: '700', textAlign: 'center', fontSize: 12 }}>View Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 24, padding: 10 }}
          onPress={handleDeleteAccount}
        >
          <Text style={{ color: '#ef4444', fontWeight: '800', textAlign: 'center', fontSize: 12, opacity: 0.8 }}>Request Account Deletion</Text>
        </TouchableOpacity>
      </GlassView>

      <Text style={{ color: muted, fontSize: 10, textAlign: 'center', marginTop: 20 }}>
        Version 2.0.4 (Security Hardened)
      </Text>
    </ScrollView>
  );
};

// ── Find Them Sub-View ────────────────────────────────────────────────────────
const FindThemPage = ({ primary, muted, textColor, user, onAuthRequired, toast, applyLocationPrivacy }) => {
  const [distance, setDistance] = useState(5);
  const [activeFilter, setActiveFilter] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);

  const search = async () => {
    if (!user) { onAuthRequired(); return; }
    setLoading(true);
    try {
      const coords = await LocationService.requestAndGet();
      if (coords && applyLocationPrivacy) {
        const privateCoords = applyLocationPrivacy(coords.lat, coords.lon);
        if (privateCoords) {
          LocationService.saveToProfile(user.id, privateCoords.lat, privateCoords.lon);
        }
      }
      const data = await DiscoveryManager.findNearbyVibers(user.id, distance);
      setPeople(data || []);
      if (!data || data.length === 0) toast.show('No vibers found nearby — try a wider range', 'info');
    } catch {
      toast.show('Search failed — check your connection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const displayed = useMemo(() => activeFilter
    ? people.filter(p => (p.interests || []).some(i => i === activeFilter || (typeof i === 'string' && i.toLowerCase().includes(activeFilter.toLowerCase()))))
    : people,
  [people, activeFilter]);

  return (
    <>
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
                    await UserManager.follow(user.id, person.id);
                    toast?.show(`Following @${person.username}`, 'success');
                  }}
                  onMessage={() => setDmTarget(person)}
                />
              </FadeInView>
            ))
          )}
        </View>
      </ScrollView>

      {dmTarget && (
        <SafeSection label="Message" primary={primary}>
          <DirectMessageModal
            visible={!!dmTarget}
            recipient={dmTarget}
            onClose={() => setDmTarget(null)}
          />
        </SafeSection>
      )}
    </>
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

// ── Profile tab skeleton ──────────────────────────────────────────────────────
const ProfileTabSkeleton = ({ primary }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, gap: 10, paddingVertical: 4 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: `${primary}08` }}>
          <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: `${primary}20` }} />
          <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
            <View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: `${primary}20` }} />
            <View style={{ height: 10, width: '40%', borderRadius: 5, backgroundColor: `${primary}12` }} />
            <View style={{ height: 9, width: '75%', borderRadius: 5, backgroundColor: `${primary}10` }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
};

// ── Mini event card for profile tabs ─────────────────────────────────────────
const MiniEventCard = ({ ev, primary, textColor, muted, badge, badgeIcon, onPress }) => {
  // media_urls is a string[] saved by PostEventModal; media is the legacy object[] format
  const imgUrl = ev.cover_url ||
    ev.media_urls?.[0] ||
    (Array.isArray(ev.media) ? ev.media.find(m => m?.type === 'image')?.url : null) ||
    ev.cover_image || ev.image_url || null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[mec.wrap, { borderColor: `${primary}20` }]}>
      {imgUrl
        ? <Image source={{ uri: imgUrl }} style={mec.img} resizeMode="cover" />
        : <View style={[mec.img, { backgroundColor: `${primary}12`, alignItems: 'center', justifyContent: 'center' }]}><Feather name="image" size={18} color={`${primary}40`} /></View>
      }
      <View style={mec.info}>
        <Text style={[mec.title, { color: textColor }]} numberOfLines={1}>{ev.title || 'Untitled'}</Text>
        <Text style={[mec.meta, { color: muted }]}>
          {ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' }) : ev.venue_name || ''}
        </Text>
        <View style={[mec.badge, { backgroundColor: `${primary}15` }]}>
          {badgeIcon && <Feather name={badgeIcon} size={9} color={primary} />}
          <Text style={[mec.badgeText, { color: primary }]}>{badge}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const mec = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  img: { width: 72, height: 72 },
  info: { flex: 1, padding: 10, gap: 4 },
  title: { fontSize: 13, fontWeight: '800' },
  meta: { fontSize: 11 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '800' },
});

const isVideoUrl = (url) => /\.(mp4|mov|webm|avi|m4v)(\?|$)/i.test(url || '');

// ── Clubs modal — create, browse clubs + pending invitations ─────────────────
const ClubsModal = ({ userId, primary, textColor, muted, surface, onClose }) => {
  const [tab, setTab]               = useState('my');  // 'my' | 'invitations' | 'create'
  const [myClubs, setMyClubs]       = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ name: '', short_name: '', sport_type: '', city: '', bio: '' });
  const toast = useToast?.() || { show: () => {} };

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [clubs, invs] = await Promise.all([
      MembershipManager.getPlayerClubs(userId).catch(() => []),
      MembershipManager.getPendingInvitations(userId).catch(() => []),
    ]);
    setMyClubs(clubs);
    setInvitations(invs);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await ClubManager.create(userId, {
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        sport_type: form.sport_type.trim() || null,
        city: form.city.trim() || null,
        bio: form.bio.trim() || null,
      });
      setForm({ name: '', short_name: '', sport_type: '', city: '', bio: '' });
      setTab('my');
      load();
    } catch (e) { toast.show?.(e.message || 'Error creating club', 'error'); }
    setSaving(false);
  };

  const handleRespond = async (inv, accept) => {
    try {
      await MembershipManager.respondToInvitation(inv.id, accept);
      load();
    } catch (e) { toast.show?.(e.message || 'Error', 'error'); }
  };

  const SPORT_TYPES = ['soccer','rugby','basketball','cricket','athletics','tennis','boxing','volleyball','esports','golf','swimming','cycling','other'];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingBottom: 32 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
            <Text style={{ color: textColor, fontSize: 18, fontWeight: '900' }}>⚔️ My Clubs</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={muted} /></TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 }}>
            {[
              { key: 'my',          label: `My Clubs (${myClubs.length})` },
              { key: 'invitations', label: `Invites${invitations.length ? ` (${invitations.length})` : ''}` },
              { key: 'create',      label: '+ Create' },
            ].map(t => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: active ? primary : `${primary}15`, borderColor: active ? primary : `${primary}30` }}
                  onPress={() => setTab(t.key)}
                >
                  <Text style={{ color: active ? '#000' : primary, fontSize: 12, fontWeight: '800' }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={{ paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {loading && <ActivityIndicator color={primary} style={{ marginTop: 24 }} />}

            {/* My Clubs */}
            {!loading && tab === 'my' && (
              <View style={{ gap: 10 }}>
                {myClubs.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                    <Feather name="shield" size={32} color={muted} />
                    <Text style={{ color: muted, fontSize: 13 }}>No clubs yet — create one or accept an invitation</Text>
                  </View>
                )}
                {myClubs.map(m => (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: `${primary}08`, borderRadius: 14, borderWidth: 1, borderColor: `${primary}20`, padding: 14 }}>
                    {m.clubs?.logo_url
                      ? <Image source={{ uri: m.clubs.logo_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                      : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}><Feather name="shield" size={20} color={primary} /></View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontSize: 14, fontWeight: '900' }}>{m.clubs?.name}</Text>
                      <Text style={{ color: primary, fontSize: 12, fontWeight: '700' }}>{m.role}{m.position ? ` · ${m.position}` : ''}</Text>
                      {m.clubs?.city && <Text style={{ color: muted, fontSize: 11 }}>{m.clubs.city}</Text>}
                    </View>
                    {m.clubs?.sport_type && (
                      <View style={{ backgroundColor: `${primary}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                        <Text style={{ color: primary, fontSize: 10, fontWeight: '800' }}>{m.clubs.sport_type}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Invitations */}
            {!loading && tab === 'invitations' && (
              <View style={{ gap: 12 }}>
                {invitations.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                    <Feather name="mail" size={32} color={muted} />
                    <Text style={{ color: muted, fontSize: 13 }}>No pending invitations</Text>
                  </View>
                )}
                {invitations.map(inv => (
                  <View key={inv.id} style={{ backgroundColor: `${primary}08`, borderRadius: 16, borderWidth: 1, borderColor: `${primary}25`, padding: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {inv.clubs?.logo_url
                        ? <Image source={{ uri: inv.clubs.logo_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                        : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}><Feather name="shield" size={18} color={primary} /></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textColor, fontSize: 14, fontWeight: '900' }}>{inv.clubs?.name}</Text>
                        <Text style={{ color: primary, fontSize: 12 }}>Invited as {inv.role}</Text>
                        <Text style={{ color: muted, fontSize: 11 }}>from @{inv.profiles?.username}</Text>
                      </View>
                    </View>
                    {inv.message ? <Text style={{ color: muted, fontSize: 13 }}>"{inv.message}"</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
                        onPress={() => handleRespond(inv, true)}
                      >
                        <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, borderWidth: 1, borderColor: `${primary}40`, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
                        onPress={() => handleRespond(inv, false)}
                      >
                        <Text style={{ color: muted, fontWeight: '800', fontSize: 13 }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Create Club */}
            {tab === 'create' && (
              <View style={{ gap: 12 }}>
                <Text style={{ color: muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>CLUB NAME *</Text>
                <TextInput
                  style={{ color: textColor, borderWidth: 1, borderColor: `${primary}30`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: `${primary}08` }}
                  placeholder="e.g. Soweto United FC"
                  placeholderTextColor={muted}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                />
                <Text style={{ color: muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>ABBREVIATION</Text>
                <TextInput
                  style={{ color: textColor, borderWidth: 1, borderColor: `${primary}30`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: `${primary}08` }}
                  placeholder="e.g. SUF"
                  placeholderTextColor={muted}
                  maxLength={6}
                  value={form.short_name}
                  onChangeText={v => setForm(f => ({ ...f, short_name: v }))}
                />
                <Text style={{ color: muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>SPORT / TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {SPORT_TYPES.map(s => {
                      const active = form.sport_type === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: active ? primary : `${primary}12`, borderColor: active ? primary : `${primary}30` }}
                          onPress={() => setForm(f => ({ ...f, sport_type: active ? '' : s }))}
                        >
                          <Text style={{ color: active ? '#000' : primary, fontSize: 12, fontWeight: '700' }}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={{ color: muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>CITY</Text>
                <TextInput
                  style={{ color: textColor, borderWidth: 1, borderColor: `${primary}30`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: `${primary}08` }}
                  placeholder="e.g. Johannesburg"
                  placeholderTextColor={muted}
                  value={form.city}
                  onChangeText={v => setForm(f => ({ ...f, city: v }))}
                />
                <Text style={{ color: muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>BIO</Text>
                <TextInput
                  style={{ color: textColor, borderWidth: 1, borderColor: `${primary}30`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: `${primary}08`, minHeight: 70 }}
                  placeholder="About the club..."
                  placeholderTextColor={muted}
                  multiline
                  value={form.bio}
                  onChangeText={v => setForm(f => ({ ...f, bio: v }))}
                />
                <TouchableOpacity
                  style={{ backgroundColor: primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: !form.name.trim() || saving ? 0.5 : 1 }}
                  onPress={handleCreate}
                  disabled={!form.name.trim() || saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Create Club</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Clubs & Awards section (shown on profile above tabs) ─────────────────────
const ClubsAndAwardsSection = ({ userId, primary, textColor, muted, surface }) => {
  const [clubs, setClubs]   = useState([]);
  const [awards, setAwards] = useState([]);

  useEffect(() => {
    if (!userId) return;
    MembershipManager.getPlayerClubs(userId).then(setClubs).catch(() => {});
    AwardManager.listForUser(userId).then(setAwards).catch(() => {});
  }, [userId]);

  if (!clubs.length && !awards.length) return null;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
      {/* Clubs */}
      {clubs.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>CLUBS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {clubs.map(m => (
              <View key={m.id} style={{ alignItems: 'center', gap: 4, width: 70 }}>
                {m.clubs?.logo_url
                  ? <Image source={{ uri: m.clubs.logo_url }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: `${primary}40` }} />
                  : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}><Feather name="shield" size={18} color={primary} /></View>
                }
                <Text style={{ color: textColor, fontSize: 10, fontWeight: '800', textAlign: 'center' }} numberOfLines={2}>{m.clubs?.short_name || m.clubs?.name}</Text>
                <Text style={{ color: primary, fontSize: 9, fontWeight: '700' }}>{m.role}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Awards */}
      {awards.length > 0 && (
        <View>
          <Text style={{ color: muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>AWARDS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {awards.map(a => (
              <View key={a.id} style={{ alignItems: 'center', gap: 3, width: 70, backgroundColor: `${primary}10`, borderRadius: 12, borderWidth: 1, borderColor: `${primary}25`, padding: 8 }}>
                <Text style={{ fontSize: 22 }}>{a.award_icon || '🏆'}</Text>
                <Text style={{ color: textColor, fontSize: 9, fontWeight: '800', textAlign: 'center' }} numberOfLines={2}>{a.award_label}</Text>
                <Text style={{ color: muted, fontSize: 8, textAlign: 'center' }} numberOfLines={1}>{a.events?.title}</Text>
                {a.stat_value != null && (
                  <Text style={{ color: primary, fontSize: 10, fontWeight: '900' }}>{a.stat_value} {a.stat_label}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const FollowingTab = ({ userId, primary, textColor, muted, surface, onNavigateToEvent }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      // Fetch from both event_followers and sport_event_followers, merge
      const [{ data: ef }, { data: sf }] = await Promise.all([
        supabase.from('event_followers')
          .select('event_id, created_at, events(id, title, event_date, category, venue_name, media)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('sport_event_followers')
          .select('event_id, created_at, events(id, title, event_date, category, venue_name, media)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      const merged = [...(ef || []), ...(sf || [])]
        .map(r => r.events)
        .filter(Boolean)
        .sort((a, b) => new Date(b.event_date || 0) - new Date(a.event_date || 0));
      // Deduplicate by id
      const seen = new Set();
      setItems(merged.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }));
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) return <ActivityIndicator color={primary} style={{ marginTop: 32 }} />;

  if (!items.length) return (
    <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
      <Feather name="bell-off" size={32} color={muted} />
      <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>
        {"You're not following any events yet.\nTap Follow on any event to track it here."}
      </Text>
    </View>
  );

  return (
    <View style={{ gap: 10 }}>
      {items.map(ev => (
        <MiniEventCard
          key={ev.id}
          ev={ev}
          primary={primary}
          textColor={textColor}
          muted={muted}
          badge="Following"
          badgeIcon="bell"
          onPress={() => onNavigateToEvent?.(ev)}
        />
      ))}
    </View>
  );
};

const GalleryTab = ({ userId, primary, muted, myEvents, profileGallery }) => {
  const [lightboxItem, setLightboxItem] = useState(null); // { url, isVideo }
  const [userReels, setUserReels] = useState([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('reels').select('media_url, media_type').eq('user_id', userId).eq('is_deleted', false).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (data) setUserReels(data); });
  }, [userId]);

  const allItems = useMemo(() => {
    const items = [
      ...(profileGallery || []).map(url => ({ url, isVideo: isVideoUrl(url) })),
      ...userReels.map(r => ({ url: r.media_url, isVideo: r.media_type === 'video' })).filter(r => r.url),
      ...myEvents.flatMap(ev => {
        let mediaArr = ev.media;
        if (typeof mediaArr === 'string') { try { mediaArr = JSON.parse(mediaArr); } catch { mediaArr = null; } }
        if (Array.isArray(mediaArr) && mediaArr.length > 0) {
          return mediaArr.map(m => {
            const url = typeof m === 'string' ? m : m?.url;
            return url ? { url, isVideo: m?.type === 'video' || isVideoUrl(url) } : null;
          }).filter(Boolean);
        }
        if (Array.isArray(ev.media_urls) && ev.media_urls.length > 0) {
          return ev.media_urls.map(url => ({ url, isVideo: isVideoUrl(url) }));
        }
        if (ev.cover_url) return [{ url: ev.cover_url, isVideo: false }];
        return [];
      }),
    ];
    return items.filter(item => item?.url).slice(0, 60);
  }, [profileGallery, userReels, myEvents]);

  const cellSize = Math.floor((width - 44) / 3);

  if (allItems.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
        <Feather name="image" size={32} color={primary} style={{ opacity: 0.4 }} />
        <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>Your gallery will appear here{'\n'}as you post reels and event media</Text>
      </View>
    );
  }

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {allItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setLightboxItem(item)}
            activeOpacity={0.85}
            style={{ width: cellSize, height: cellSize, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: `${primary}15` }}
          >
            <Image source={{ uri: item.url }} style={{ width: cellSize, height: cellSize }} resizeMode="cover" />
            {item.isVideo && (
              <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                <Feather name="play-circle" size={28} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Lightbox */}
      <Modal visible={!!lightboxItem} transparent animationType="fade" onRequestClose={() => setLightboxItem(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setLightboxItem(null)}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setLightboxItem(null)}
          >
            <Feather name="x" size={28} color="#fff" />
          </TouchableOpacity>
          {lightboxItem?.isVideo ? (
            <Pressable onPress={e => e.stopPropagation()}>
              <Video
                source={{ uri: lightboxItem.url }}
                style={{ width: width - 32, height: (width - 32) * 9 / 16, borderRadius: 12 }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                useNativeControls
              />
            </Pressable>
          ) : (
            <Image
              source={{ uri: lightboxItem?.url }}
              style={{ width: width - 32, height: width - 32, borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </>
  );
};

// ── App Updates Section ───────────────────────────────────────────────────────
const UPDATE_TYPE_COLOR = { feature: '#00f2ff', fix: '#10b981', improvement: '#8b5cf6', security: '#ef4444' };
const UPDATE_TYPE_ICON  = { feature: 'star', fix: 'tool', improvement: 'trending-up', security: 'shield' };

const AppUpdatesSection = ({ primary, muted, textColor, surface }) => {
  const [updates, setUpdates] = React.useState([]);

  React.useEffect(() => {
    supabase
      .from('app_updates')
      .select('*')
      .order('released_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setUpdates(data || []));
  }, []);

  if (!updates.length) return null;

  const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <GlassView style={[{ marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: `${primary}18` }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Feather name="zap" size={16} color={primary} />
        <Text style={{ color: primary, fontSize: 14, fontWeight: '900' }}>App Updates</Text>
      </View>
      {updates.map((u, i) => {
        const color = UPDATE_TYPE_COLOR[u.type] || primary;
        const icon  = UPDATE_TYPE_ICON[u.type]  || 'zap';
        return (
          <View key={u.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.06)' }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${color}18`, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name={icon} size={14} color={color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '800' }}>{u.title}</Text>
                <View style={{ backgroundColor: `${color}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>{u.type}</Text>
                </View>
              </View>
              {u.description ? <Text style={{ color: muted, fontSize: 11, lineHeight: 16 }}>{u.description}</Text> : null}
              <Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>v{u.version} · {fmtDate(u.released_at)}</Text>
            </View>
          </View>
        );
      })}
    </GlassView>
  );
};

// ── Main Profile Page ─────────────────────────────────────────────────────────
export const ProfilePage = ({ onAuthRequired, onNavigateToEvent }) => {
  const { currentTheme, gender, themeIndex, changeTheme } = useTheme();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const toast = useToast();

  const [subView, setSubView] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [pathMapVisible, setPathMapVisible] = useState(false);
  const [bizDashVisible, setBizDashVisible] = useState(false);
  const [whoWasThereVisible, setWhoWasThereVisible] = useState(false);
  const [walletVisible, setWalletVisible] = useState(false);
  const [ticketsVisible, setTicketsVisible] = useState(false);
  const [providerDashVisible, setProviderDashVisible] = useState(false);
  const [vibeCoachData, setVibeCoachData]   = useState(null);
  const [vibeCoachLoading, setVibeCoachLoading] = useState(false);

  const loadVibeCoach = async () => {
    if (vibeCoachLoading) return;
    setVibeCoachLoading(true);
    try {
      const result = await BehavioralEngine.analyze(user?.id, profile);
      if (result) setVibeCoachData(result);
    } catch {}
    setVibeCoachLoading(false);
  };
  const [tutorialCenterVisible, setTutorialCenterVisible] = useState(false);
  const { completed: tutorialsDone } = useTutorial();
  const streak = useStreak();
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [createReelVisible, setCreateReelVisible] = useState(false);
  const [clubsModalVisible, setClubsModalVisible] = useState(false);
  const [pendingInvites, setPendingInvites] = useState(0);
  const { identityMode, modeConfig, setIdentityMode, applyLocationPrivacy } = useIdentity();
  const [activeTab, setActiveTab] = useState('gruvs');
  const [myCoHostEvents, setMyCoHostEvents] = useState([]);
  const [activityItems, setActivityItems] = useState([]);
  const [settingsTab, setSettingsTab] = useState('discover');
  const [eventCount, setEventCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // New Profile Extension Fields
  const [looksDescription, setLooksDescription] = useState(profile?.looks_description || '');
  const [careerTitle, setCareerTitle] = useState(profile?.career_title || '');
  const [careerDescription, setCareerDescription] = useState(profile?.career_description || '');
  const [profileGallery, setProfileGallery] = useState(profile?.profile_gallery || []);
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [interests, setInterests] = useState(profile?.interests || []);
  const [profileGender, setProfileGender] = useState(profile?.gender || '');
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '');
  const [lookingFor, setLookingFor] = useState(profile?.looking_for || '');
  const [preferredAreas, setPreferredAreas] = useState(profile?.preferred_areas || '');

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
      setInterests(profile.interests || []);
      setLooksDescription(profile.looks_description || '');
      setCareerTitle(profile.career_title || '');
      setCareerDescription(profile.career_description || '');
      setProfileGallery(profile.profile_gallery || []);
      setProfileGender(profile.gender || '');
      setBirthYear(profile.birth_year ? String(profile.birth_year) : '');
      setLookingFor(profile.looking_for || '');
      setPreferredAreas(profile.preferred_areas || '');
    }
  }, [profile]);
  const [savedCount, setSavedCount] = useState(0);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [myEvents, setMyEvents] = useState([]);
  const [mySavedEvents, setMySavedEvents] = useState([]);
  const [myVibedEvents, setMyVibedEvents] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [imageViewerUri, setImageViewerUri] = useState(null);
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const surface   = currentTheme?.surface    || '#1a1f21';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const username = profile?.username || user?.user_metadata?.username || 'Viber';
  const avatarUrl = profile?.avatar_url || null;
  const vibeScore = profile?.vibe_score || 0;

  const avatarInitials = (name) =>
    name ? name.split(/[\s_]/).map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'G';
  const avatarBgColor = (name) => {
    const colors = ['#0891b2', '#0d9488', '#7c3aed', '#dc2626', '#d97706', '#059669'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const pickImage = async (opts = {}) => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { toast.show('Photo library permission needed', 'error'); return null; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      ...opts,
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0]; // includes .uri, .mimeType, .fileName
  };

  const handleAvatarUpload = async () => {
    try {
      const asset = await pickImage({ allowsEditing: true, aspect: [1, 1] });
      if (!asset) return;
      toast.show('Uploading profile picture...', 'info');
      // Derive extension from the original filename when available — blob URIs have no extension
      const fileName = asset.fileName || asset.uri.split('/').pop().split('?')[0];
      const rawExt = fileName.includes('.') ? fileName.split('.').pop() : '';
      const ext = (rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg').toLowerCase().slice(0, 5);
      const storagePath = `${user.id}/avatar_${Date.now()}.${ext}`;
      const publicUrl = await uploadToStorage(asset.uri, 'avatars', storagePath, { mimeType: asset.mimeType });
      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateErr) throw new Error(updateErr.message);
      refreshProfile();
      toast.show('Profile picture updated!', 'success');
    } catch (e) {
      toast.show('Upload failed: ' + (e.message || 'Unknown error'), 'error');
    }
  };

  const handleGalleryUpload = async () => {
    try {
      const asset = await pickImage({ allowsEditing: false });
      if (!asset) return;
      toast.show('Uploading to gallery...', 'info');
      const fileName = asset.fileName || asset.uri.split('/').pop().split('?')[0];
      const rawExt = fileName.includes('.') ? fileName.split('.').pop() : '';
      const ext = (rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg').toLowerCase().slice(0, 5);
      // Gallery images live in event-media/gallery/<user_id>/ so the new
      // storage policy (folder[1]='gallery', filename starts with user_id) allows it.
      const storagePath = `gallery/${user.id}/${user.id}_${Date.now()}.${ext}`;
      const publicUrl = await uploadToStorage(asset.uri, 'event-media', storagePath, { mimeType: asset.mimeType });
      const newGallery = [...(profileGallery || []), publicUrl];
      const { error: updateErr } = await supabase.from('profiles').update({ profile_gallery: newGallery }).eq('id', user.id);
      if (updateErr) throw new Error(updateErr.message);
      setProfileGallery(newGallery);
      refreshProfile();
      toast.show('Added to gallery!', 'success');
    } catch (e) {
      toast.show('Upload failed: ' + (e.message || 'Unknown error'), 'error');
    }
  };


  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const parsedBirthYear = birthYear.trim() ? parseInt(birthYear.trim(), 10) : null;
      const { error } = await supabase.from('profiles').update({
        bio, location, website, interests,
        looks_description: looksDescription,
        career_title: careerTitle,
        career_description: careerDescription,
        gender: profileGender || null,
        birth_year: parsedBirthYear && !isNaN(parsedBirthYear) ? parsedBirthYear : null,
        looking_for: lookingFor || null,
        preferred_areas: preferredAreas || null,
      }).eq('id', user.id);
      if (error) throw error;
      toast.show('Profile updated!', 'success');
    } catch (e) {
      toast.show('Save failed: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadCounts = async () => {
      const [evRes, followRes, saveRes] = await Promise.allSettled([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('saved_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      if (evRes.status === 'fulfilled') setEventCount(evRes.value.count || 0);
      if (followRes.status === 'fulfilled') setFollowerCount(followRes.value.count || 0);
      if (saveRes.status === 'fulfilled') setSavedCount(saveRes.value.count || 0);
    };
    loadCounts();

    // Load pending club invitations count
    if (user) {
      MembershipManager.getPendingInvitations(user.id)
        .then(invs => setPendingInvites(invs?.length || 0))
        .catch(() => {});
    }
  }, [user]);

  const loadTab = useCallback(async (tab) => {
    if (!user) return;
    setTabLoading(true);
    try {
      if (tab === 'gruvs') {
        const data = await resilientRead(
          async () => {
            const { data: d, error } = await supabase
              .from('events')
              .select('*, profiles(username, avatar_url)')
              .or(`author_id.eq.${user.id},user_id.eq.${user.id}`)
              .order('created_at', { ascending: false })
              .limit(20);
            if (error) throw error;
            return d;
          },
          async () => {
            const { data: d, error } = await supabase
              .from('events')
              .select('id, title, date, cover_url, status')
              .eq('author_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20);
            if (error) throw error;
            return d;
          },
          async () => {
            const { data: d, error } = await supabase
              .from('events')
              .select('id, title, event_date, event_time, venue_name, category, media, media_urls, cover_url, cover_image, vibe_count, going, is_cancelled, is_deleted, created_at')
              .eq('author_id', user.id)
              .neq('is_deleted', true)
              .order('created_at', { ascending: false })
              .limit(30);
            if (error) throw error;
            return d;
          },
          [],
          'ProfilePage.loadTab:gruvs'
        );
        setMyEvents(data || []);
      } else if (tab === 'saved') {
        const data = await resilientRead(
          async () => {
            const { data: d, error } = await supabase
              .from('saved_events')
              .select('events(*)')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20);
            if (error) throw error;
            return (d || []).map(r => r.events).filter(Boolean);
          },
          async () => {
            const { data: d, error } = await supabase
              .from('saved_events')
              .select('event_id, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20);
            if (error) throw error;
            return (d || []).map(r => ({ id: r.event_id }));
          },
          async () => {
            const { data: d, error } = await supabase
              .from('saved_events')
              .select('event_id')
              .eq('user_id', user.id)
              .limit(10);
            if (error) throw error;
            return (d || []).map(r => ({ id: r.event_id }));
          },
          [],
          'ProfilePage.loadTab:saved'
        );
        setMySavedEvents(data || []);
      } else if (tab === 'vibed') {
        const data = await resilientRead(
          async () => {
            const { data: d, error } = await supabase
              .from('event_vibes')
              .select('events(*)')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20);
            if (error) throw error;
            return (d || []).map(r => r.events).filter(Boolean);
          },
          async () => {
            const { data: d, error } = await supabase
              .from('event_vibes')
              .select('event_id, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20);
            if (error) throw error;
            return (d || []).map(r => ({ id: r.event_id }));
          },
          async () => {
            const { data: d, error } = await supabase
              .from('event_vibes')
              .select('event_id')
              .eq('user_id', user.id)
              .limit(10);
            if (error) throw error;
            return (d || []).map(r => ({ id: r.event_id }));
          },
          [],
          'ProfilePage.loadTab:vibed'
        );
        setMyVibedEvents(data || []);
      } else if (tab === 'cohost') {
        // Events where the current user is a co_host in event_roles
        const { data: d } = await supabase
          .from('event_roles')
          .select('events(id, title, date, cover_url, status, category, author_id, profiles:author_id(username))')
          .eq('user_id', user.id)
          .eq('role', 'co_host')
          .order('created_at', { ascending: false })
          .limit(20);
        setMyCoHostEvents((d || []).map(r => r.events).filter(Boolean));
      } else if (tab === 'activity') {
        const items = await ActivityFeedManager.fetch(user.id, { limit: 40 });
        setActivityItems(items || []);
      }
    } catch { }
    finally { setTabLoading(false); }
  }, [user]);

  useEffect(() => {
    if (user) loadTab(activeTab);
  }, [user, activeTab]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim() || !user) return;
    setSavingUsername(true);
    try {
      const trimmed = newUsername.trim();
      const ok = await resilient(
        [
          () => supabase.from('profiles').update({ username: trimmed }).eq('id', user.id),
          () => supabase.rpc('update_username', { p_user_id: user.id, p_username: trimmed }),
          () => supabase.from('profiles').upsert({ id: user.id, username: trimmed }, { onConflict: 'id' }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: 'ProfilePage.saveUsername', fallbackValue: null }
      );
      if (ok !== null) {
        refreshProfile();
        setEditingUsername(false);
        toast.show('Username updated!', 'success');
      } else {
        toast.show('Failed to update username.', 'error');
      }
    } catch (e) {
      toast.show('Failed to update.', 'error');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim() || !user) return;
    setSavingDisplayName(true);
    try {
      const { error } = await supabase.from('profiles').update({ display_name: newDisplayName.trim() }).eq('id', user.id);
      if (error) throw error;
      refreshProfile();
      setEditingDisplayName(false);
      toast.show('Name updated!', 'success');
    } catch {
      toast.show('Failed to update name.', 'error');
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleDeleteEvent = (ev) => {
    const doDelete = async () => {
      setMyEvents(prev => prev.filter(e => e.id !== ev.id));
      try {
        const ok = await resilient(
          [
            () => supabase.from('events').delete().eq('id', ev.id).eq('author_id', user.id),
            () => supabase.from('events').update({ status: 'deleted' }).eq('id', ev.id).eq('author_id', user.id),
            () => supabase.rpc('delete_event', { p_event_id: ev.id }),
          ],
          { attemptsPerTier: 3, baseMs: 400, label: `ProfilePage.deleteEvent:${ev.id}`, fallbackValue: null }
        );
        if (ok !== null) {
          toast.show('Event deleted.', 'success');
        } else {
          setMyEvents(prev => [ev, ...prev]);
          toast.show('Could not delete event.', 'error');
        }
      } catch {
        setMyEvents(prev => [ev, ...prev]);
        toast.show('Could not delete event.', 'error');
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete "${ev.title}"? This cannot be undone.`)) doDelete();
    } else {
      Alert.alert('Delete Event', `Delete "${ev.title}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
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
    } catch { }
  };

  const handleCoverUpload = async () => {
    try {
      const asset = await pickImage({ allowsEditing: true, aspect: [16, 9] });
      if (!asset) return;
      toast.show('Uploading cover photo...', 'info');
      const fileName = asset.fileName || asset.uri.split('/').pop().split('?')[0];
      const rawExt = fileName.includes('.') ? fileName.split('.').pop() : '';
      const ext = (rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg').toLowerCase().slice(0, 5);
      const storagePath = `${user.id}/cover_${Date.now()}.${ext}`;
      const publicUrl = await uploadToStorage(asset.uri, 'covers', storagePath, { mimeType: asset.mimeType });
      const { error: updateErr } = await supabase.from('profiles').update({ cover_url: publicUrl }).eq('id', user.id);
      if (updateErr) throw new Error(updateErr.message);
      refreshProfile();
      toast.show('Cover updated!', 'success');
    } catch (e) {
      toast.show('Upload failed: ' + (e.message || 'Unknown error'), 'error');
    }
  };

  // Guest view
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
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
          applyLocationPrivacy={applyLocationPrivacy}
        />
      </View>
    );
  }

  if (subView === 'security') {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.subHeader, { borderBottomColor: `${primary}20` }]}>
          <TouchableOpacity onPress={() => setSubView(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={primary} />
          </TouchableOpacity>
          <Text style={[styles.subTitle, { color: textColor }]}>Privacy & Security</Text>
          <View style={{ width: 40 }} />
        </View>
        <SecurityPage primary={primary} muted={muted} textColor={textColor} user={user} toast={toast} />
      </View>
    );
  }

  if (subView === 'council') {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.subHeader, { borderBottomColor: '#FFD70020' }]}>
          <TouchableOpacity onPress={() => setSubView(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#FFD700" />
          </TouchableOpacity>
          <Text style={[styles.subTitle, { color: '#FFD700' }]}>Royal Council</Text>
          <View style={{ width: 40 }} />
        </View>
        <RoyalCouncilPage primary={primary} textColor={textColor} muted={muted} user={user} toast={toast} />
      </View>
    );
  }

  // Main profile
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <LiquidBackground intensity={0.8} />
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
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: `${primary}15`, borderWidth: 1, borderColor: `${primary}30` }}
              onPress={() => setBizDashVisible(true)}
            >
              <Feather name="briefcase" size={14} color={primary} />
              <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>Business</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: `${primary}15`, borderWidth: 1, borderColor: `${primary}30` }}
              onPress={() => setClubsModalVisible(true)}
            >
              <Feather name="shield" size={14} color={primary} />
              <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>Clubs</Text>
              {pendingInvites > 0 && (
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{pendingInvites}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: `${primary}15`, borderWidth: 1, borderColor: `${primary}30` }}
              onPress={() => setLeaderboardVisible(true)}
            >
              <Feather name="award" size={14} color={primary} />
              <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>Leaderboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)' }}
              onPress={() => setTutorialCenterVisible(true)}
            >
              <Feather name="book-open" size={14} color="#8b5cf6" />
              <Text style={{ color: '#8b5cf6', fontSize: 11, fontWeight: '800' }}>Tutorials</Text>
              {tutorialsDone.length < 3 && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Cover Photo */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.coverPhoto, { backgroundColor: `${primary}18` }]}
          onPress={() => profile?.cover_url && setImageViewerUri(profile.cover_url)}
        >
          {profile?.cover_url
            ? <Image source={{ uri: thumb.cover(profile.cover_url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <>
              <View style={[styles.coverPattern, { borderColor: `${primary}12` }]} />
              <View style={[styles.coverPatternAlt, { borderColor: `${primary}10` }]} />
            </>
          }
          {user && (
            <TouchableOpacity style={styles.coverEditBtn} onPress={handleCoverUpload}>
              <Feather name="camera" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Avatar Row */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => avatarUrl ? setImageViewerUri(avatarUrl) : (user && handleAvatarUpload())}
            onLongPress={() => user && handleAvatarUpload()}
            activeOpacity={0.85}
          >
            {avatarUrl
              ? <Image source={{ uri: thumb.avatarLg(avatarUrl) }} style={[styles.avatar, { borderColor: primary }]} />
              : <View style={[styles.avatar, { borderColor: primary, backgroundColor: avatarBgColor(username), alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{avatarInitials(username)}</Text>
              </View>
            }
            <View style={[styles.onlineDot, { backgroundColor: '#10b981' }]} />
            {user && (
              <View style={[styles.avatarEditBadge, { backgroundColor: primary }]}>
                <Feather name="camera" size={10} color="#000" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.avatarActions}>
            {user && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: primary }]}
                onPress={() => setEditProfileVisible(true)}
              >
                <Feather name="edit-2" size={13} color="#000" />
                <Text style={styles.actionBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: `${primary}50` }]} onPress={handleShareProfile}>
              <Feather name="share-2" size={14} color={primary} />
              <Text style={[styles.actionBtnOutlineText, { color: primary }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name + bio */}
        <View style={styles.nameSection}>
          {/* Display name row */}
          {editingDisplayName ? (
            <View style={[styles.editRow, { marginBottom: 4 }]}>
              <TextInput
                style={[styles.usernameInput, { color: textColor, borderColor: `${primary}60`, fontSize: 18, fontWeight: '900' }]}
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                autoFocus
                placeholder="Your display name..."
                placeholderTextColor={muted}
                maxLength={40}
              />
              <TouchableOpacity onPress={handleSaveDisplayName} disabled={savingDisplayName}>
                {savingDisplayName ? <ActivityIndicator color={primary} size="small" /> : <Text style={[styles.saveText, { color: primary }]}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingDisplayName(false)}>
                <Text style={[styles.cancelText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => { setNewDisplayName(profile?.display_name || ''); setEditingDisplayName(true); }}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Text style={[styles.profileName, { color: textColor }]}>
                {profile?.display_name || username}
              </Text>
              <Feather name="edit-2" size={13} color={muted} />
            </TouchableOpacity>
          )}

          {/* Username row */}
          {editingUsername ? (
            <View style={[styles.editRow, { marginTop: 4 }]}>
              <TextInput
                style={[styles.usernameInput, { color: textColor, borderColor: `${primary}60` }]}
                value={newUsername}
                onChangeText={setNewUsername}
                autoFocus
                placeholder="New username..."
                placeholderTextColor={muted}
              />
              <TouchableOpacity onPress={handleSaveUsername} disabled={savingUsername}>
                {savingUsername ? <ActivityIndicator color={primary} size="small" /> : <Text style={[styles.saveText, { color: primary }]}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingUsername(false)}>
                <Text style={[styles.cancelText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setNewUsername(username); setEditingUsername(true); }} activeOpacity={0.7}>
              <Text style={[styles.profileBio, { color: primary, fontWeight: '700', marginTop: 2 }]}>@{username} ✎</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.profileBio, { color: muted, marginTop: 4 }]}>
            {profile?.bio || 'The Gruvs — I got you ✦'}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={[styles.statsBar, { borderColor: `${primary}18` }]}>
          {[
            { label: 'Gruvs', value: eventCount },
            { label: 'Crew', value: followerCount },
            { label: 'Saved', value: savedCount },
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

        {/* XP Level bar */}
        {user && (() => {
          const xp = profile?.xp || 0;
          const level = Math.min(100, Math.floor(Math.sqrt(xp / 50)) + 1);
          const xpForLevel = (n) => Math.pow(n - 1, 2) * 50;
          const xpStart = xpForLevel(level);
          const xpEnd   = xpForLevel(level + 1);
          const pct = level >= 100 ? 100 : Math.round(((xp - xpStart) / (xpEnd - xpStart)) * 100);
          return (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ backgroundColor: `${primary}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${primary}40` }}>
                    <Text style={{ color: primary, fontWeight: '900', fontSize: 11 }}>LVL {level}</Text>
                  </View>
                  <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>XP Progress</Text>
                </View>
                <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>{xp} XP</Text>
              </View>
              <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: primary, borderRadius: 3 }} />
              </View>
              {level < 100 && (
                <Text style={{ color: muted, fontSize: 10, marginTop: 4 }}>{xpEnd - xp} XP to Level {level + 1}</Text>
              )}
            </View>
          );
        })()}

        {/* Streak Badge */}
        {user && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <StreakBadge streak={streak} />
          </View>
        )}

        {user && <ReferralCard userId={user.id} />}

        {user && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <StreakBadges userId={user.id} primary={primary} textColor={textColor} muted={muted} surface={surface} />
          </View>
        )}

        {user && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <AchievementBadges userId={user.id} primary={primary} muted={muted} textColor={textColor} />
          </View>
        )}

        {user && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <SocialIntegrityBadge score={user.social_integrity_score ?? 50} size="large" primary={primary} muted={muted} textColor={textColor} bg={bg} />
          </View>
        )}

        {/* Path Map button */}
        {user && (
          <TouchableOpacity
            onPress={() => setPathMapVisible(true)}
            style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: `${primary}18`, borderWidth: 1, borderColor: `${primary}30` }}
          >
            <Feather name="map" size={18} color={primary} />
            <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>My Path Map</Text>
            <Text style={{ color: muted, fontSize: 11, marginLeft: 'auto' }}>Digital footprint →</Text>
          </TouchableOpacity>
        )}

        {/* Pathfinder Badges (New Section) */}
        {user && (
          <GlassView style={styles.section}>
            <Text style={[styles.sectionTitle, { color: primary }]}>Pathfinder Badges</Text>
            <Text style={[styles.sectionSub, { color: muted }]}>Recognitions for your movement patterns</Text>
            <View style={styles.badgeGrid}>
              {/* Placeholder for actual badges */}
              <Text style={{ color: muted, fontSize: 12 }}>No Pathfinder badges earned yet. Keep exploring!</Text>
              {/* Example: <Feather name="award" size={30} color={primary} /> */}
            </View>
          </GlassView>
        )}

        {/* Identity Mode Switcher */}
        {user && (
          <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
            <Text style={{ color: muted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>IDENTITY MODE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Object.values({ public: { key: 'public', label: 'Public', icon: 'eye', color: '#10b981', desc: 'Fully visible' }, ghost: { key: 'ghost', label: 'Ghost', icon: 'eye-off', color: '#8b5cf6', desc: 'Alias + fuzzed' }, celebrity: { key: 'celebrity', label: 'Celebrity', icon: 'star', color: '#f59e0b', desc: 'Read-only' } }).map(mode => {
                const isActive = identityMode === mode.key;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    onPress={() => setIdentityMode(mode.key)}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: isActive ? 2 : 1, borderColor: isActive ? mode.color : `${muted}40`, backgroundColor: isActive ? `${mode.color}20` : 'transparent' }}
                  >
                    <Feather name={mode.icon} size={16} color={isActive ? mode.color : muted} />
                    <Text style={{ color: isActive ? mode.color : muted, fontSize: 10, fontWeight: '800', marginTop: 4 }}>{mode.label}</Text>
                    <Text style={{ color: muted, fontSize: 8, marginTop: 2, opacity: 0.7 }}>{mode.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
            onPress={() => setWhoWasThereVisible(true)}
          >
            <Feather name="clock" size={16} color={primary} />
            <Text style={[styles.findBtnText, { color: primary }]}>History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.findRow}>
          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
            onPress={async () => {
              const passed = await BiometricAuth.gate('Confirm your identity to open Wallet');
              if (passed) { await RichHaptics.tap(); setWalletVisible(true); }
            }}
          >
            <Feather name="wallet" size={16} color={primary} />
            <Text style={[styles.findBtnText, { color: primary }]}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
            onPress={() => setTicketsVisible(true)}
          >
            <Feather name="ticket" size={16} color={primary} />
            <Text style={[styles.findBtnText, { color: primary }]}>Tickets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
            onPress={() => setProviderDashVisible(true)}
          >
            <Feather name="briefcase" size={16} color={primary} />
            <Text style={[styles.findBtnText, { color: primary }]}>Hub</Text>
          </TouchableOpacity>

          {(profile?.vibe_equity >= 500) && (
            <TouchableOpacity
              style={[styles.findBtn, { backgroundColor: '#FFD70018', borderColor: '#FFD70040' }]}
              onPress={() => setSubView('council')}
            >
              <Feather name="shield" size={16} color="#FFD700" />
              <Text style={[styles.findBtnText, { color: '#FFD700' }]}>Council</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}
            onPress={() => setSubView('security')}
          >
            <Feather name="shield" size={16} color={primary} />
            <Text style={[styles.findBtnText, { color: primary }]}>Privacy</Text>
          </TouchableOpacity>
        </View>

        {/* Tutorials — Prominent Card */}
        <TouchableOpacity
          onPress={() => setTutorialCenterVisible(true)}
          activeOpacity={0.85}
          style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.35)', backgroundColor: 'rgba(139,92,246,0.08)', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="book-open" size={22} color="#8b5cf6" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Text style={{ color: '#8b5cf6', fontSize: 14, fontWeight: '900' }}>Tutorials</Text>
              {tutorialsDone.length < 3 && (
                <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>NEW</Text>
                </View>
              )}
            </View>
            <Text style={{ color: muted, fontSize: 11, lineHeight: 15 }}>
              {tutorialsDone.length >= 3
                ? 'All done! Tap to review how The Gruvs works.'
                : `${tutorialsDone.length}/3 completed — finish to unlock your first badge.`}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color="rgba(139,92,246,0.6)" />
        </TouchableOpacity>

        {/* App Updates (changelog) */}
        <ErrorBoundary inline label="App Updates" primary={primary}>
          <AppUpdatesSection primary={primary} muted={muted} textColor={textColor} surface={surface} />
        </ErrorBoundary>

        {/* Gruv Analytics */}
        <ErrorBoundary inline label="Gruv Analytics" primary={primary}>
          <GlassView style={styles.section}>
            <Text style={[styles.sectionTitle, { color: primary }]}>Gruv Analytics</Text>
            <Text style={[styles.sectionSub, { color: muted }]}>This week's activity</Text>
            <AnalyticsChart primary={primary} muted={muted} textColor={textColor} userId={user?.id} />
          </GlassView>
        </ErrorBoundary>

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

        {/* ── AI Vibe Coach ──────────────────────────────────────── */}
        <GlassView style={[styles.section, { borderColor: `${primary}30` }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>✦</Text>
              <Text style={[styles.sectionTitle, { color: primary, marginBottom: 0 }]}>Vibe Coach</Text>
            </View>
            <TouchableOpacity
              onPress={loadVibeCoach}
              disabled={vibeCoachLoading}
              style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: `${primary}40`, backgroundColor: `${primary}10` }}
            >
              {vibeCoachLoading
                ? <ActivityIndicator size="small" color={primary} />
                : <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>{vibeCoachData ? 'Refresh' : 'Get Tips'}</Text>
              }
            </TouchableOpacity>
          </View>
          {vibeCoachData ? (
            <>
              {/* Trend + Cohort row */}
              {(vibeCoachData.trend || vibeCoachData.cohort) && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  {vibeCoachData.trend && (
                    <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: `${primary}10`, alignItems: 'center' }}>
                      <Text style={{ color: vibeCoachData.trend.direction === 'up' ? '#10b981' : vibeCoachData.trend.direction === 'down' ? '#ef4444' : muted, fontSize: 16, fontWeight: '900' }}>
                        {vibeCoachData.trend.direction === 'up' ? '↑' : vibeCoachData.trend.direction === 'down' ? '↓' : '→'} {Math.abs(vibeCoachData.trend.pct)}%
                      </Text>
                      <Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>vs last week</Text>
                    </View>
                  )}
                  {vibeCoachData.cohort && (
                    <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: `${primary}10`, alignItems: 'center' }}>
                      <Text style={{ color: primary, fontSize: 13, fontWeight: '800' }}>{vibeCoachData.cohort.percentile}th %ile</Text>
                      <Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>{vibeCoachData.cohort.label}</Text>
                    </View>
                  )}
                  {vibeCoachData.decay_score !== undefined && (
                    <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: `${primary}10`, alignItems: 'center' }}>
                      <Text style={{ color: primary, fontSize: 13, fontWeight: '800' }}>{vibeCoachData.decay_score.toFixed(1)}</Text>
                      <Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>momentum</Text>
                    </View>
                  )}
                </View>
              )}
              {!!vibeCoachData.insight && (
                <Text style={{ color: textColor, fontSize: 13, lineHeight: 19, marginBottom: 10 }}>{vibeCoachData.insight}</Text>
              )}
              {(vibeCoachData.tips || []).map((tip, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: `${primary}08`, borderWidth: 1, borderColor: `${primary}15` }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#000', fontSize: 11, fontWeight: '900' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: textColor, fontSize: 12, lineHeight: 17, flex: 1 }}>{tip}</Text>
                </View>
              ))}
              {!!vibeCoachData.next_milestone && (
                <Text style={{ color: primary, fontSize: 11, fontWeight: '700', marginTop: 4 }}>🎯 {vibeCoachData.next_milestone}</Text>
              )}
            </>
          ) : (
            <Text style={{ color: muted, fontSize: 13 }}>Tap "Get Tips" for personalised coaching based on your activity.</Text>
          )}
        </GlassView>

        {/* Clubs & Awards */}
        <ClubsAndAwardsSection userId={user?.id} primary={primary} textColor={textColor} muted={muted} surface={surface} />

        {/* Profile Content Tabs */}
        <View style={[styles.contentTabRow, { borderColor: `${primary}20` }]}>
          {[
            { key: 'gruvs',     label: 'My Gruvs', icon: 'calendar' },
            { key: 'saved',     label: 'Saved',    icon: 'bookmark' },
            { key: 'vibed',     label: 'Vibed',    icon: 'zap' },
            { key: 'following', label: 'Following', icon: 'bell' },
            { key: 'cohost',    label: 'Co-Host',  icon: 'users' },
            { key: 'activity',  label: 'Activity', icon: 'activity' },
            { key: 'gallery',   label: 'Gallery',  icon: 'image' },
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
          {tabLoading ? (
            <ProfileTabSkeleton primary={primary} />
          ) : (
            <>
              {activeTab === 'gruvs' && (
                myEvents.length === 0 ? (
                  <TouchableOpacity
                    style={[styles.emptyTab, { borderColor: `${primary}20` }]}
                    onPress={() => setPostModalVisible(true)}
                  >
                    <Feather name="plus-circle" size={32} color={primary} style={{ opacity: 0.6 }} />
                    <Text style={[styles.emptyTabText, { color: muted }]}>No events posted yet{'\n'}Tap to drop your first Gruv</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 10 }}>
                    {myEvents.map((ev) => (
                      <View key={ev.id}>
                        <MiniEventCard ev={ev} primary={primary} textColor={textColor} muted={muted} badge={ev.category || 'Gruv'} badgeIcon={null} onPress={() => onNavigateToEvent?.(ev)} />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, paddingHorizontal: 4 }}>
                          <TouchableOpacity
                            onPress={() => setEditingEvent(ev)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: `${primary}40` }}
                          >
                            <Feather name="edit-2" size={13} color={primary} />
                            <Text style={{ color: primary, fontSize: 12, fontWeight: '700' }}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteEvent(ev)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#ef444440' }}
                          >
                            <Feather name="trash-2" size={13} color="#ef4444" />
                            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )
              )}
              {activeTab === 'saved' && (
                mySavedEvents.length === 0 ? (
                  <TouchableOpacity style={[styles.emptyTab, { borderColor: `${primary}20` }]} onPress={() => toast?.show('Head over to Explore to find more Gruvs!', 'info')}>
                    <Feather name="bookmark" size={32} color={primary} style={{ opacity: 0.6 }} />
                    <Text style={[styles.emptyTabText, { color: muted }]}>No saved events yet{'\n'}Bookmark gruvs from the feed</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 10 }}>
                    {mySavedEvents.map((ev) => <MiniEventCard key={ev.id} ev={ev} primary={primary} textColor={textColor} muted={muted} badge="Saved" badgeIcon="bookmark" onPress={() => onNavigateToEvent?.(ev)} />)}
                  </View>
                )
              )}
              {activeTab === 'vibed' && (
                myVibedEvents.length === 0 ? (
                  <TouchableOpacity style={[styles.emptyTab, { borderColor: `${primary}20` }]} onPress={() => toast?.show('Zap events in the feed to vibe!', 'info')}>
                    <Feather name="zap" size={32} color={primary} style={{ opacity: 0.6 }} />
                    <Text style={[styles.emptyTabText, { color: muted }]}>No vibed events yet{'\n'}Zap events in the feed to vibe</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 10 }}>
                    {myVibedEvents.map((ev) => <MiniEventCard key={ev.id} ev={ev} primary={primary} textColor={textColor} muted={muted} badge={`${ev.vibe_count || 0} vibes`} badgeIcon="zap" onPress={() => onNavigateToEvent?.(ev)} />)}
                  </View>
                )
              )}
              {activeTab === 'cohost' && (
                myCoHostEvents.length === 0 ? (
                  <View style={[styles.emptyTab, { borderColor: `${primary}20` }]}>
                    <Feather name="users" size={32} color={primary} style={{ opacity: 0.6 }} />
                    <Text style={[styles.emptyTabText, { color: muted }]}>Not co-hosting any events yet{'\n'}Get invited by an organiser</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {myCoHostEvents.map(ev => (
                      <View key={ev.id}>
                        <MiniEventCard ev={ev} primary={primary} textColor={textColor} muted={muted} badge="Co-Host" badgeIcon="users" onPress={() => onNavigateToEvent?.(ev)} />
                        {ev.profiles?.username && (
                          <Text style={{ color: muted, fontSize: 11, marginTop: 3, paddingHorizontal: 4 }}>
                            Organiser: @{ev.profiles.username}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )
              )}
              {activeTab === 'following' && (
                <FollowingTab userId={user?.id} primary={primary} textColor={textColor} muted={muted} surface={surface} onNavigateToEvent={onNavigateToEvent} />
              )}
              {activeTab === 'activity' && (
                activityItems.length === 0 ? (
                  <View style={[styles.emptyTab, { borderColor: `${primary}20` }]}>
                    <Feather name="activity" size={32} color={primary} style={{ opacity: 0.6 }} />
                    <Text style={[styles.emptyTabText, { color: muted }]}>No activity yet{'\n'}Your interactions will appear here</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {activityItems.map(item => {
                      const iconMap = {
                        rsvp: 'calendar', vibe: 'zap', comment: 'message-circle',
                        follow: 'user-plus', reel: 'film', checkin: 'map-pin',
                        poll_vote: 'bar-chart-2', track_vote: 'music',
                      };
                      const icon = iconMap[item.activity_type] || 'bell';
                      const timeAgo = item.created_at ? (() => {
                        const d = Math.floor((Date.now() - new Date(item.created_at)) / 1000);
                        if (d < 60) return `${d}s ago`;
                        if (d < 3600) return `${Math.floor(d / 60)}m ago`;
                        if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
                        return `${Math.floor(d / 86400)}d ago`;
                      })() : '';
                      return (
                        <View key={item.id} style={[af.row, { borderColor: `${primary}15` }]}>
                          <View style={[af.iconWrap, { backgroundColor: `${primary}20` }]}>
                            <Feather name={icon} size={14} color={primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[af.bodyText, { color: textColor }]} numberOfLines={2}>
                              {item.body || item.title || item.activity_type}
                            </Text>
                            <Text style={[af.time, { color: muted }]}>{timeAgo}</Text>
                          </View>
                          {!item.is_read && (
                            <View style={[af.unreadDot, { backgroundColor: primary }]} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )
              )}
              {activeTab === 'gallery' && (
                <View>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={handleGalleryUpload}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 11, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: `${primary}40`, justifyContent: 'center' }}
                    >
                      <Feather name="image" size={15} color={primary} />
                      <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>Add Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCreateReelVisible(true)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 11, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: `${primary}40`, justifyContent: 'center' }}
                    >
                      <Feather name="film" size={15} color={primary} />
                      <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>Post Reel</Text>
                    </TouchableOpacity>
                  </View>
                  <GalleryTab userId={user?.id} primary={primary} muted={muted} myEvents={myEvents} profileGallery={profileGallery} />
                </View>
              )}
            </>
          )}
        </View>

        {/* Settings Tabs */}
        <View style={[styles.settingsTabs, { borderColor: `${primary}20` }]}>
          {[
            { key: 'discover', label: 'Discover', icon: 'compass' },
            { key: 'career', label: 'Professional', icon: 'briefcase' },
            { key: 'aura', label: 'My Aura', icon: 'droplet' },
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
                <TouchableOpacity
                  key={d}
                  onPress={() => setSubView('findthem')}
                  style={[ft.distBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}25` }]}
                >
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

        {/* Career & Looks Settings */}
        {settingsTab === 'career' && (
          <GlassView style={styles.section}>
            <Text style={[styles.sectionTitle, { color: primary }]}>Career & Looks</Text>
            <Text style={[styles.sectionSub, { color: muted, marginBottom: 12 }]}>Let others know your vibe and profession to get invited to exclusive Gruvs.</Text>

            <View style={styles.editRow}>
              <Text style={[styles.editLabel, { color: primary }]}>Career Title</Text>
              <TextInput
                style={[styles.editInput, { color: textColor, borderColor: `${primary}20` }]}
                value={careerTitle}
                onChangeText={setCareerTitle}
                placeholder="e.g. Model, DJ, Event Planner..."
                placeholderTextColor={muted}
              />
            </View>

            <View style={styles.editRow}>
              <Text style={[styles.editLabel, { color: primary }]}>Career Description</Text>
              <TextInput
                style={[styles.editInput, { color: textColor, borderColor: `${primary}20`, height: 80 }]}
                value={careerDescription}
                onChangeText={setCareerDescription}
                placeholder="What do you do? Tell the vibers..."
                placeholderTextColor={muted}
                multiline
              />
            </View>

            <View style={styles.editRow}>
              <Text style={[styles.editLabel, { color: primary }]}>Looks & Aura</Text>
              <TextInput
                style={[styles.editInput, { color: textColor, borderColor: `${primary}20`, height: 80 }]}
                value={looksDescription}
                onChangeText={setLooksDescription}
                placeholder="Style, appearance, or general vibe..."
                placeholderTextColor={muted}
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: primary, marginTop: 10 }]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Save Career Profile</Text>}
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

      {postModalVisible && (
        <SafeSection label="Post Event" primary={primary}>
          <PostEventModal
            visible={postModalVisible}
            onClose={() => setPostModalVisible(false)}
            onCreated={(ev) => { setMyEvents(prev => [ev, ...prev]); setActiveTab('gruvs'); }}
            onPostSuccess={() => { loadTab('gruvs'); setActiveTab('gruvs'); }}
          />
        </SafeSection>
      )}
      {!!editingEvent && (
        <SafeSection label="Edit Event" primary={primary}>
          <EditEventModal
            visible={!!editingEvent}
            event={editingEvent}
            onClose={() => setEditingEvent(null)}
            onUpdated={(ev) => setMyEvents(prev => prev.map(e => e.id === ev.id ? { ...e, ...ev } : e))}
            onDeleted={(id) => { setMyEvents(prev => prev.filter(e => e.id !== id)); setEditingEvent(null); }}
            onSaved={() => { setEditingEvent(null); loadTab('gruvs'); }}
          />
        </SafeSection>
      )}
      {leaderboardVisible && (
        <SafeSection label="Leaderboard" primary={primary}>
          <LeaderboardScreen
            visible={leaderboardVisible}
            onClose={() => setLeaderboardVisible(false)}
            currentUserId={user?.id}
          />
        </SafeSection>
      )}
      {clubsModalVisible && (
        <ClubsModal
          userId={user?.id}
          primary={primary}
          textColor={textColor}
          muted={muted}
          surface={surface}
          onClose={() => { setClubsModalVisible(false); setPendingInvites(0); }}
        />
      )}
      {pathMapVisible && (
        <SafeSection label="Path Map" primary={primary}>
          <PathMapScreen visible={pathMapVisible} onClose={() => setPathMapVisible(false)} />
        </SafeSection>
      )}
      {bizDashVisible && (
        <SafeSection label="Business Dashboard" primary={primary}>
          <View style={StyleSheet.absoluteFill}>
            <BusinessDashboardScreen onClose={() => setBizDashVisible(false)} />
          </View>
        </SafeSection>
      )}
      {whoWasThereVisible && (
        <SafeSection label="Who Was There" primary={primary}>
          <WhoWasThereModal
            visible={whoWasThereVisible}
            onClose={() => setWhoWasThereVisible(false)}
            onAuthRequired={onAuthRequired}
          />
        </SafeSection>
      )}
      {walletVisible && (
        <SafeSection label="Wallet" primary={primary}>
          <WalletScreen
            visible={walletVisible}
            onClose={() => setWalletVisible(false)}
          />
        </SafeSection>
      )}
      {ticketsVisible && (
        <SafeSection label="Tickets" primary={primary}>
          <EventTicketModal
            visible={ticketsVisible}
            onClose={() => setTicketsVisible(false)}
          />
        </SafeSection>
      )}
      {providerDashVisible && (
        <SafeSection label="Provider Dashboard" primary={primary}>
          <ProviderDashboardScreen
            visible={providerDashVisible}
            onClose={() => setProviderDashVisible(false)}
          />
        </SafeSection>
      )}
      {tutorialCenterVisible && (
        <SafeSection label="Tutorial" primary={primary}>
          <TutorialCenter
            visible={tutorialCenterVisible}
            onClose={() => setTutorialCenterVisible(false)}
          />
        </SafeSection>
      )}
      {createReelVisible && (
        <SafeSection label="Create Reel" primary={primary}>
          <CreateReelModal
            visible={createReelVisible}
            onClose={() => setCreateReelVisible(false)}
            onPosted={() => setCreateReelVisible(false)}
          />
        </SafeSection>
      )}

      {/* ── Full-screen image viewer ── */}
      <Modal
        visible={!!imageViewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerUri(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={1}
          onPress={() => setImageViewerUri(null)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', alignItems: 'center' }}>
            <Image
              source={{ uri: imageViewerUri }}
              style={{ width: width, height: width, resizeMode: 'contain' }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setImageViewerUri(null)}
            style={{ position: 'absolute', top: 52, right: 18, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8 }}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit Profile sheet ── */}
      <Modal
        visible={editProfileVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setEditProfileVisible(false)}
          />
          <View style={{ backgroundColor: bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 16, maxHeight: '88%' }}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: `${primary}40`, alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ color: textColor, fontSize: 18, fontWeight: '900', marginBottom: 6 }}>Edit Profile</Text>
            <Text style={{ color: primary, fontSize: 13, fontWeight: '700', marginBottom: 18, opacity: 0.8 }}>
              @{username}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Avatar */}
              <TouchableOpacity
                style={{ alignSelf: 'center', marginBottom: 20 }}
                onPress={handleAvatarUpload}
              >
                {avatarUrl
                  ? <Image source={{ uri: thumb.avatarLg(avatarUrl) }} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: primary }} />
                  : <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: primary, backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="user" size={32} color={primary} />
                    </View>
                }
                <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: primary, borderRadius: 12, padding: 5 }}>
                  <Feather name="camera" size={13} color="#000" />
                </View>
              </TouchableOpacity>

              {/* Cover photo */}
              <TouchableOpacity
                onPress={handleCoverUpload}
                style={{ height: 80, borderRadius: 14, backgroundColor: `${primary}15`, borderWidth: 1, borderColor: `${primary}30`, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 18 }}
              >
                {profile?.cover_url
                  ? <Image source={{ uri: thumb.coverSm(profile.cover_url) }} style={{ ...StyleSheet.absoluteFillObject, borderRadius: 14 }} resizeMode="cover" />
                  : null}
                <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Feather name="image" size={15} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Change Cover Photo</Text>
                </View>
              </TouchableOpacity>

              {/* Bio */}
              <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Bio</Text>
              <TextInput
                style={{ color: textColor, borderWidth: 1, borderColor: `${primary}25`, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 80, textAlignVertical: 'top', marginBottom: 14 }}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell vibers about yourself..."
                placeholderTextColor={muted}
                multiline
              />

              {/* Location */}
              <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Location</Text>
              <TextInput
                style={{ color: textColor, borderWidth: 1, borderColor: `${primary}25`, borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 14 }}
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                placeholderTextColor={muted}
              />

              {/* Website */}
              <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Website / Link</Text>
              <TextInput
                style={{ color: textColor, borderWidth: 1, borderColor: `${primary}25`, borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 14 }}
                value={website}
                onChangeText={setWebsite}
                placeholder="https://..."
                placeholderTextColor={muted}
                autoCapitalize="none"
                keyboardType="url"
              />

              {/* Gender */}
              <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Gender</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['Male', 'Female', 'Non-binary', 'Other'].map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setProfileGender(profileGender === g.toLowerCase() ? '' : g.toLowerCase())}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: profileGender === g.toLowerCase() ? primary : `${primary}30`, backgroundColor: profileGender === g.toLowerCase() ? `${primary}20` : 'transparent' }}
                  >
                    <Text style={{ color: profileGender === g.toLowerCase() ? primary : muted, fontSize: 12, fontWeight: '700' }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Birth Year */}
              <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Birth Year</Text>
              <TextInput
                style={{ color: textColor, borderWidth: 1, borderColor: `${primary}25`, borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 14 }}
                value={birthYear}
                onChangeText={setBirthYear}
                placeholder="e.g. 1998"
                placeholderTextColor={muted}
                keyboardType="numeric"
                maxLength={4}
              />

              {/* Looking For */}
              <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>What are you looking for?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {['Friends', 'Dating', 'Networking', 'Event Crew', 'Collaborations', 'Just Vibing'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setLookingFor(lookingFor === opt ? '' : opt)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: lookingFor === opt ? primary : `${primary}30`, backgroundColor: lookingFor === opt ? `${primary}20` : 'transparent' }}
                  >
                    <Text style={{ color: lookingFor === opt ? primary : muted, fontSize: 12, fontWeight: '700' }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preferred Areas */}
              <Text style={{ color: primary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Preferred Areas / Neighbourhoods</Text>
              <TextInput
                style={{ color: textColor, borderWidth: 1, borderColor: `${primary}25`, borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 22 }}
                value={preferredAreas}
                onChangeText={setPreferredAreas}
                placeholder="e.g. Sandton, Melville, Soweto..."
                placeholderTextColor={muted}
              />

              <TouchableOpacity
                style={{ backgroundColor: primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
                onPress={async () => {
                  await handleSaveProfile();
                  setEditProfileVisible(false);
                }}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save Profile</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  coverPattern: { position: 'absolute', top: -30, left: -30, width: Math.min(220, width * 0.5), height: Math.min(220, width * 0.5), borderRadius: Math.min(110, width * 0.25), borderWidth: 40 },
  coverPatternAlt: { position: 'absolute', bottom: -50, right: -30, width: Math.min(180, width * 0.42), height: Math.min(180, width * 0.42), borderRadius: Math.min(90, width * 0.21), borderWidth: 35 },
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

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  benefitText: { fontSize: 12, fontWeight: '600', opacity: 0.9 },

  // Content tabs
  contentTabRow: { flexDirection: 'row', marginHorizontal: 16, borderBottomWidth: 1, marginBottom: 14 },
  contentTab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  contentTabLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  tabContent: { paddingHorizontal: 16, marginBottom: 14 },
  emptyTab: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: width < 375 ? 24 : 36, alignItems: 'center', gap: 12 },
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
  guestCard: { width: '100%', padding: width < 375 ? 20 : 36, alignItems: 'center', marginBottom: 20, borderRadius: 24 },
  guestTitle: { fontSize: 26, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
  guestSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  guestBtn: { paddingVertical: 15, paddingHorizontal: width < 375 ? 20 : 32, borderRadius: 30 },
  guestBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  // Sign out
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, marginBottom: 20, paddingVertical: 14, borderRadius: 30, borderWidth: 1.5, borderColor: '#ef4444' },
  signOutText: { color: '#ef4444', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  // Career / Looks edit fields
  editRow: { marginBottom: 14 },
  editLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, opacity: 0.7 },
  editInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.04)', textAlignVertical: 'top' },
  mintStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
});

const af = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bodyText: { fontSize: 13, lineHeight: 18 },
  time: { fontSize: 11, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
