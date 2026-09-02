/**
 * SettingsScreen — the single home for everything settings. Consolidates the
 * controls that used to be scattered across ProfilePage (discoverable toggles,
 * app lock, aura/writing/currency) plus identity mode, notifications, account
 * and about, into one organised screen.
 *
 * Drives the SAME state as before — there is no parallel store:
 *   • privacy toggles  → profiles.{is_discoverable,show_online,share_events}
 *   • identity mode    → IdentityContext (global)
 *   • aura / writing / currency → ThemeContext + the existing pickers
 *   • app lock         → Biometric service (AsyncStorage)
 *   • push             → NotificationService.registerForPush / profiles.push_token
 *
 * Rendered inline by ProfilePage as a `subView`, matching findme/findthem/etc.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Platform, Linking, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../components/ToastNotification';
import { GlassView } from '../components/GlassView';
import { WritingStylePicker } from '../components/WritingStylePicker';
import { CurrencyPicker } from '../components/CurrencyPicker';
import { Biometric } from '../services/biometric';
import { NotificationService } from '../services/notificationService';
import { SoundFX } from '../services/soundFX';
import { PanicMode } from '../services/panicMode';
import { SafetyHubModal } from '../components/SafetyHubModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { supabase } from '../services/supabase';
import { haptics } from '../utils/haptics';
import { THEMES } from '../constants/Themes';
import { exportMyData } from '../services/dataExport';
import { MfaSetupModal } from '../components/MfaSetupModal';
import { mfaStatus } from '../services/mfa';
import { PermissionsPanel } from '../components/PermissionsPanel';
import { GetHomeSafeModal } from '../components/GetHomeSafeModal';

const DIST_OPTIONS = [1, 5, 10, 25, 50];
const PRIVACY_URL = 'https://thegruvs.com/privacy.html';
const TERMS_URL = 'https://thegruvs.com/terms.html';

let APP_VERSION = '1.1.0';
try { APP_VERSION = require('../../app.json')?.expo?.version || APP_VERSION; } catch { /* keep fallback */ }

const genderKey = (g) => {
  const raw = (g || '').toLowerCase().trim();
  if (raw === 'male') return 'male';
  if (raw === 'female') return 'female';
  return 'non_binary';
};

const SectionCard = ({ icon, title, children, primary, muted, textColor }) => (
  <GlassView style={st.section}>
    <View style={st.sectionHead}>
      <View style={[st.sectionIcon, { backgroundColor: `${primary}18` }]}>
        <Feather name={icon} size={15} color={primary} />
      </View>
      <Text style={[st.sectionTitle, { color: textColor }]}>{title}</Text>
    </View>
    {children}
  </GlassView>
);

const ToggleRow = ({ label, sub, value, onValueChange, primary, muted, textColor, disabled }) => (
  <View style={[st.row, { borderBottomColor: `${primary}12` }]}>
    <View style={{ flex: 1, marginRight: 12 }}>
      <Text style={[st.rowLabel, { color: textColor }]}>{label}</Text>
      {!!sub && <Text style={[st.rowSub, { color: muted }]}>{sub}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: 'rgba(255,255,255,0.15)', true: `${primary}80` }}
      thumbColor={value ? primary : '#aaa'}
    />
  </View>
);

const LinkRow = ({ icon, label, value, onPress, primary, muted, textColor, danger }) => (
  <TouchableOpacity
    style={[st.row, { borderBottomColor: `${primary}12` }]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
  >
    {icon && <Feather name={icon} size={16} color={danger ? '#ef4444' : muted} style={{ marginRight: 12 }} />}
    <Text style={[st.rowLabel, { color: danger ? '#ef4444' : textColor, flex: 1 }]}>{label}</Text>
    {!!value && <Text style={[st.rowValue, { color: muted }]}>{value}</Text>}
    {onPress && <Feather name="chevron-right" size={16} color={muted} style={{ marginLeft: 6 }} />}
  </TouchableOpacity>
);

export const SettingsScreen = ({
  onBack, onEditProfile, onSignOut, onOpenFindThem,
  discoverRadius = 5, setDiscoverRadius,
}) => {
  const { currentTheme, changeTheme } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const { identityMode, allModes, setIdentityMode } = useIdentity();
  const toast = useToast();

  const primary = currentTheme?.primary || '#00f2ff';
  const background = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  // Privacy toggles mirror the profile; write-through on change.
  const [discoverable, setDiscoverable] = useState(profile?.is_discoverable ?? true);
  const [showOnline, setShowOnline] = useState(profile?.show_online ?? true);
  const [shareEvents, setShareEvents] = useState(profile?.share_events ?? false);
  const [wantsEmail, setWantsEmail] = useState(profile?.wants_email ?? true);
  const [pushOn, setPushOn] = useState(!!profile?.push_token || NotificationService.isWebPushEnabled());
  const [pushBusy, setPushBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(SoundFX.isEnabled());
  useEffect(() => { SoundFX.init().then(() => setSoundOn(SoundFX.isEnabled())); }, []);
  const toggleSound = useCallback((next) => {
    setSoundOn(next);
    SoundFX.setEnabled(next); // plays a confirmation chime when turned on
    toast?.show(next ? 'Sound effects on 🔊' : 'Sound effects off', next ? 'success' : 'info');
  }, [toast]);

  // Per-channel tone picker. SoundFX holds the actual state (persisted); this
  // is just a re-render trigger so the row values reflect it after each tap.
  const [toneTick, setToneTick] = useState(0);
  useEffect(() => { SoundFX.init().then(() => setToneTick((t) => t + 1)); }, []);
  const cycleChannelTone = useCallback(async (channelKey) => {
    const names = SoundFX.availableSounds();
    const current = SoundFX.getChannelSound(channelKey);
    const next = names[(names.indexOf(current) + 1) % names.length];
    await SoundFX.setChannelSound(channelKey, next); // also previews it
    setToneTick((t) => t + 1);
  }, []);

  // `wants_email` is NOT in AuthContext.PROFILE_FIELDS, so profile?.wants_email is
  // always undefined — the toggle showed "on" again after every reopen, which
  // makes the POPIA consent-withdrawal meaningless. Read it in its OWN guarded
  // query: it can't be added to PROFILE_FIELDS until the coordinate-lockdown
  // grant is re-run (new columns aren't readable until then), and a failure there
  // would break profile loading for everyone. Falls back to true if unreadable.
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles').select('wants_email').eq('id', user.id).maybeSingle();
        if (!alive || error || !data) return;
        if (typeof data.wants_email === 'boolean') setWantsEmail(data.wants_email);
      } catch { /* column not granted yet — keep the default */ }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Two-factor auth (#997)
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaOn, setMfaOn] = useState(false);
  useEffect(() => { mfaStatus().then((s) => setMfaOn(!!s.enabled)); }, []);

  // App lock
  const [safetyHubOpen, setSafetyHubOpen] = useState(false);
  const [getHomeSafeOpen, setGetHomeSafeOpen] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [lockEnabled, setLockEnabled] = useState(false);

  // Career & looks
  const [careerTitle, setCareerTitle] = useState(profile?.career_title || '');
  const [careerDescription, setCareerDescription] = useState(profile?.career_description || '');
  const [looksDescription, setLooksDescription] = useState(profile?.looks_description || '');
  const [savingCareer, setSavingCareer] = useState(false);

  useEffect(() => {
    setDiscoverable(profile?.is_discoverable ?? true);
    setShowOnline(profile?.show_online ?? true);
    setShareEvents(profile?.share_events ?? false);
    setWantsEmail(profile?.wants_email ?? true);
    setPushOn(!!profile?.push_token);
    setCareerTitle(profile?.career_title || '');
    setCareerDescription(profile?.career_description || '');
    setLooksDescription(profile?.looks_description || '');
  }, [profile?.is_discoverable, profile?.show_online, profile?.share_events, profile?.wants_email, profile?.push_token,
      profile?.career_title, profile?.career_description, profile?.looks_description]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [avail, label, enabled] = await Promise.all([
        Biometric.isAvailable(), Biometric.label(), Biometric.isLockEnabled(),
      ]);
      if (!alive) return;
      setBioAvailable(avail); setBioLabel(label); setLockEnabled(enabled);
    })();
    return () => { alive = false; };
  }, []);

  // Write a single profile field through, with optimistic local state + rollback.
  const writeField = useCallback(async (field, value, setter, prev) => {
    if (!user) return;
    setter(value);
    try {
      const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', user.id);
      if (error) throw error;
      refreshProfile?.();
    } catch {
      setter(prev); // roll back — never pretend it saved
      toast?.show('Could not save that setting. Try again.', 'error');
    }
  }, [user, refreshProfile, toast]);

  const togglePush = useCallback(async (next) => {
    if (!user) return;
    setPushBusy(true);
    const prev = pushOn;
    setPushOn(next);
    try {
      if (next) {
        const token = await NotificationService.registerForPush(user.id);
        if (!token) {
          setPushOn(false);
          toast?.show(Platform.OS === 'web'
            ? 'Allow notifications in your browser to turn these on.'
            : 'Enable notifications in your device settings.', 'info');
        } else toast?.show('Notifications on 🔔', 'success');
      } else {
        if (Platform.OS === 'web') NotificationService.disableWebPush();
        else await supabase.from('profiles').update({ push_token: null }).eq('id', user.id);
        toast?.show('Notifications off', 'info');
      }
      refreshProfile?.();
    } catch {
      setPushOn(prev);
      toast?.show('Could not change notifications.', 'error');
    } finally {
      setPushBusy(false);
    }
  }, [user, pushOn, refreshProfile, toast]);

  const handlePanic = useCallback(() => {
    if (!user) return;
    Alert.alert(
      'Disappear now?',
      "You'll instantly go invisible: switched to Ghost, hidden from discovery, and removed from every live 'here now' list. You can turn yourself back on any time.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disappear', style: 'destructive', onPress: async () => {
            const { ok } = await PanicMode.disappear(user.id);
            try { setIdentityMode?.('ghost'); } catch {}
            setDiscoverable(false);
            refreshProfile?.();
            toast?.show(ok ? 'You\'re invisible now 🫥' : 'Went invisible (some steps may retry).', ok ? 'success' : 'info');
          },
        },
      ],
    );
  }, [user, setIdentityMode, refreshProfile, toast]);

  const toggleLock = useCallback(async () => {
    const next = !lockEnabled;
    if (next) {
      const ok = await Biometric.authenticate(`Enable ${bioLabel} app lock`);
      if (!ok) { toast?.show('Authentication failed.', 'error'); return; }
    }
    await Biometric.setLockEnabled(next);
    setLockEnabled(next);
    try { haptics.success?.(); } catch {}
    toast?.show(next ? 'App lock enabled 🔒' : 'App lock disabled', next ? 'success' : 'info');
  }, [lockEnabled, bioLabel, toast]);

  const saveCareer = useCallback(async () => {
    if (!user) return;
    setSavingCareer(true);
    try {
      const { error } = await supabase.from('profiles').update({
        career_title: careerTitle.trim(),
        career_description: careerDescription.trim(),
        looks_description: looksDescription.trim(),
      }).eq('id', user.id);
      if (error) throw error;
      refreshProfile?.();
      try { haptics.success?.(); } catch {}
      toast?.show('Career profile saved!', 'success');
    } catch {
      toast?.show('Could not save. Try again.', 'error');
    } finally {
      setSavingCareer(false);
    }
  }, [user, careerTitle, careerDescription, looksDescription, refreshProfile, toast]);

  // Right to access / portability (POPIA s.23): hand the user a copy of their
  // own data. Read-only twin of delete-account — no new permissions.
  const [exportingData, setExportingData] = useState(false);
  const handleExportData = useCallback(async () => {
    if (exportingData || !user?.id) return;
    setExportingData(true);
    try {
      const { ok, tables } = await exportMyData(user.id);
      toast?.show(
        ok ? `Your data (${tables} record set${tables === 1 ? '' : 's'}) has been downloaded.`
           : 'Download is only available on the web app for now.',
        ok ? 'success' : 'info',
      );
    } finally {
      setExportingData(false);
    }
  }, [exportingData, user?.id, toast]);

  const confirmDelete = useCallback(() => {
    const doDelete = async () => {
      try {
        // Permanent deletion: JWT-verified edge function purges the user's data,
        // wipes their storage, and removes the login. Not reversible.
        const { data, error } = await supabase.functions.invoke('delete-account');
        if (error || !data?.deleted) throw error || new Error('Deletion failed');
        toast?.show('Your account and data have been permanently deleted.', 'success');
        onSignOut?.();
      } catch {
        // Fail safe: if the function is unreachable, mark for deletion + sign
        // out so the account still stops being usable and gets purged server-side.
        try { await supabase.from('profiles').update({ deletion_requested_at: new Date().toISOString(), deleted_at: new Date().toISOString(), is_discoverable: false }).eq('id', user.id); } catch {}
        toast?.show('Deletion requested — your account has been deactivated and will be erased.', 'info');
        onSignOut?.();
      }
    };
    const msg = 'Permanently delete your account? This erases your profile, posts, reels, messages and media. This cannot be undone.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Delete account permanently', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [user, toast, onSignOut]);

  const confirmSignOut = useCallback(() => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Sign out of The Gruvs?')) onSignOut?.();
    } else {
      Alert.alert('Sign out', 'Sign out of The Gruvs?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => onSignOut?.() },
      ]);
    }
  }, [onSignOut]);

  const openUrl = (url) => Linking.openURL(url).catch(() => toast?.show('Could not open link.', 'error'));

  const gKey = genderKey(profile?.gender);
  const themeList = THEMES[gKey] || THEMES.non_binary || [];

  return (
    <ErrorBoundary label="Settings" primary={primary}>
    <View style={[st.root, { backgroundColor: background }]}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: `${primary}18` }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={textColor} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: textColor }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* ACCOUNT */}
        <SectionCard icon="user" title="Account" primary={primary} muted={muted} textColor={textColor}>
          <LinkRow icon="edit-2" label="Edit profile" onPress={onEditProfile} primary={primary} muted={muted} textColor={textColor} />
          {!!(profile?.email || user?.email) && (
            <LinkRow icon="mail" label="Email" value={profile?.email || user?.email} primary={primary} muted={muted} textColor={textColor} />
          )}
          {!!profile?.username && (
            <LinkRow icon="at-sign" label="Username" value={`${profile.username}`} primary={primary} muted={muted} textColor={textColor} />
          )}
        </SectionCard>

        {/* PRIVACY & DISCOVERY */}
        <SectionCard icon="shield" title="Privacy & Discovery" primary={primary} muted={muted} textColor={textColor}>
          {/* Safety Center — one place that makes every protection legible (#150) */}
          <TouchableOpacity
            onPress={() => setSafetyHubOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open the Safety Center"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: `${primary}30`, backgroundColor: `${primary}0d`, marginBottom: 12 }}
          >
            <Feather name="shield" size={16} color={primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 14 }}>Safety Center</Text>
              <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>How you're protected + Disappear now</Text>
            </View>
            <Feather name="chevron-right" size={16} color={muted} />
          </TouchableOpacity>

          <ToggleRow label="Discoverable" sub="Let others find you nearby"
            value={discoverable} onValueChange={(v) => writeField('is_discoverable', v, setDiscoverable, discoverable)}
            primary={primary} muted={muted} textColor={textColor} />
          <ToggleRow label="Show online status" sub="Let others see when you're active"
            value={showOnline} onValueChange={(v) => writeField('show_online', v, setShowOnline, showOnline)}
            primary={primary} muted={muted} textColor={textColor} />
          <ToggleRow label="Share events" sub="Show your event activity on your profile"
            value={shareEvents} onValueChange={(v) => writeField('share_events', v, setShareEvents, shareEvents)}
            primary={primary} muted={muted} textColor={textColor} />

          {/* Panic — disappear from all presence instantly (#136) */}
          <TouchableOpacity
            onPress={handlePanic}
            accessibilityLabel="Disappear now — go invisible across the app"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' }}
          >
            <Feather name="eye-off" size={16} color="#ef4444" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>Disappear now</Text>
              <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>Instantly go invisible everywhere — Ghost + cleared presence</Text>
            </View>
          </TouchableOpacity>

          {/* Identity mode */}
          <Text style={[st.subLabel, { color: muted }]}>IDENTITY MODE</Text>
          <View style={st.chipRow}>
            {Object.values(allModes || {}).map((m) => {
              const on = identityMode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setIdentityMode(m.key)}
                  style={[st.modeChip, { borderColor: on ? m.color : `${primary}25`, backgroundColor: on ? `${m.color}1f` : 'transparent' }]}
                >
                  <Feather name={m.icon} size={13} color={on ? m.color : muted} />
                  <Text style={[st.modeChipText, { color: on ? m.color : muted }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!!allModes?.[identityMode]?.description && (
            <Text style={[st.modeDesc, { color: muted }]}>{allModes[identityMode].description}</Text>
          )}

          {/* Discover radius */}
          <Text style={[st.subLabel, { color: muted }]}>DISCOVER RADIUS</Text>
          <View style={st.chipRow}>
            {DIST_OPTIONS.map((d) => {
              const sel = discoverRadius === d;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDiscoverRadius?.(d)}
                  style={[st.distChip, { backgroundColor: sel ? primary : `${primary}10`, borderColor: sel ? primary : `${primary}25` }]}
                >
                  <Text style={[st.distText, { color: sel ? '#000' : primary }]}>{d}km</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {onOpenFindThem && (
            <TouchableOpacity style={[st.cta, { backgroundColor: primary }]} onPress={onOpenFindThem} activeOpacity={0.85}>
              <Feather name="users" size={15} color="#000" />
              <Text style={st.ctaText}>Find Vibers within {discoverRadius}km</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* NOTIFICATIONS */}
        <SectionCard icon="bell" title="Notifications" primary={primary} muted={muted} textColor={textColor}>
          <ToggleRow label="Push notifications" sub="RSVPs, messages, follows and event reminders"
            value={pushOn} onValueChange={togglePush} disabled={pushBusy}
            primary={primary} muted={muted} textColor={textColor} />
          {pushBusy && <ActivityIndicator color={primary} style={{ marginTop: 8 }} />}
          <ToggleRow label="Sound effects" sub="Signature Gruvs sounds for messages, pings & Touch Downs"
            value={soundOn} onValueChange={toggleSound}
            primary={primary} muted={muted} textColor={textColor} />
          {/* Per-channel tones. Tap a row to cycle to the next sound — it
              previews immediately, so this doubles as a picker without a
              separate modal. Hidden while sound is off entirely; there's
              nothing to preview. */}
          {soundOn && (
            <View key={toneTick} style={{ marginTop: 4 }}>
              {SoundFX.listChannels().map((c) => (
                <LinkRow
                  key={c.key}
                  label={c.label}
                  value={SoundFX.soundLabel(c.sound)}
                  onPress={() => cycleChannelTone(c.key)}
                  primary={primary} muted={muted} textColor={textColor}
                />
              ))}
            </View>
          )}
          {/* Consent to marketing email must be WITHDRAWABLE, not just opt-in at
              signup (POPIA s.11(2)). This is that off-switch. */}
          <ToggleRow label="Email me about new events & updates" sub="Marketing email — turn off any time"
            value={wantsEmail} onValueChange={(v) => writeField('wants_email', v, setWantsEmail, wantsEmail)}
            primary={primary} muted={muted} textColor={textColor} />
        </SectionCard>

        {/* DEVICE ACCESS — what the browser has allowed, and how to unblock it */}
        <SectionCard icon="shield" title="Device access" primary={primary} muted={muted} textColor={textColor}>
          <PermissionsPanel primary={primary} muted={muted} textColor={textColor} />
        </SectionCard>

        {/* CAREER & LOOKS */}
        <SectionCard icon="briefcase" title="Career & Looks" primary={primary} muted={muted} textColor={textColor}>
          <Text style={[st.rowSub, { color: muted, marginBottom: 10 }]}>
            Let others know your vibe and profession to get invited to exclusive Gruvs.
          </Text>
          <Text style={[st.subLabel, { color: muted, marginTop: 0 }]}>CAREER TITLE</Text>
          <TextInput
            value={careerTitle} onChangeText={setCareerTitle}
            placeholder="e.g. Model, DJ, Event Planner…" placeholderTextColor={muted}
            style={[st.input, { color: textColor, borderColor: `${primary}25` }]} maxLength={60}
          />
          <Text style={[st.subLabel, { color: muted }]}>CAREER DESCRIPTION</Text>
          <TextInput
            value={careerDescription} onChangeText={setCareerDescription}
            placeholder="What do you do? Tell the vibers…" placeholderTextColor={muted}
            style={[st.input, st.inputMultiline, { color: textColor, borderColor: `${primary}25` }]}
            maxLength={300} multiline
          />
          <Text style={[st.subLabel, { color: muted }]}>LOOKS & AURA</Text>
          <TextInput
            value={looksDescription} onChangeText={setLooksDescription}
            placeholder="Style, appearance, or general vibe…" placeholderTextColor={muted}
            style={[st.input, st.inputMultiline, { color: textColor, borderColor: `${primary}25` }]}
            maxLength={300} multiline
          />
          <TouchableOpacity style={[st.cta, { backgroundColor: primary }]} onPress={saveCareer} disabled={savingCareer} activeOpacity={0.85}>
            {savingCareer ? <ActivityIndicator size="small" color="#000" /> : <Text style={st.ctaText}>Save Career Profile</Text>}
          </TouchableOpacity>
        </SectionCard>

        {/* APPEARANCE */}
        <SectionCard icon="droplet" title="Appearance" primary={primary} muted={muted} textColor={textColor}>
          <Text style={[st.subLabel, { color: muted, marginTop: 0 }]}>AURA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {themeList.map((t, idx) => {
              const isActive = currentTheme?.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => changeTheme(gKey, idx)}
                  style={[st.themeCard, { backgroundColor: t.background, borderColor: isActive ? '#fff' : 'transparent', borderWidth: isActive ? 2.5 : 0 }]}
                >
                  <View style={[st.themeAccent, { backgroundColor: t.primary }]} />
                  <Text style={[st.themeName, { color: t.text || '#fff' }]} numberOfLines={1}>{t.name}</Text>
                  {isActive && (
                    <View style={[st.themeCheck, { backgroundColor: t.primary }]}>
                      <Feather name="check" size={10} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <WritingStylePicker gender={gKey} sample={profile?.username || profile?.display_name || 'The Gruvs'} userId={user?.id} primary={primary} muted={muted} />
          <CurrencyPicker primary={primary} muted={muted} />
        </SectionCard>

        {/* SECURITY */}
        <SectionCard icon="lock" title="Security" primary={primary} muted={muted} textColor={textColor}>
          {bioAvailable ? (
            <ToggleRow label="App lock" sub={`Require ${bioLabel} to open the app`}
              value={lockEnabled} onValueChange={toggleLock}
              primary={primary} muted={muted} textColor={textColor} />
          ) : (
            <Text style={[st.rowSub, { color: muted, paddingVertical: 6 }]}>
              Biometric app lock isn't available on this device.
            </Text>
          )}
          <LinkRow icon="shield" label="Two-factor authentication"
            value={mfaOn ? 'On' : 'Off'} onPress={() => setMfaOpen(true)}
            primary={primary} muted={muted} textColor={textColor} />
          <View style={st.infoRow}>
            <Feather name="shield" size={15} color={primary} />
            <Text style={[st.rowSub, { color: muted, flex: 1 }]}>Your session is protected by Supabase Auth with secure tokens.</Text>
          </View>
        </SectionCard>

        {/* ABOUT */}
        <SectionCard icon="info" title="About & Support" primary={primary} muted={muted} textColor={textColor}>
          <LinkRow icon="file-text" label="Privacy policy" onPress={() => openUrl(PRIVACY_URL)} primary={primary} muted={muted} textColor={textColor} />
          <LinkRow icon="book-open" label="Terms of service" onPress={() => openUrl(TERMS_URL)} primary={primary} muted={muted} textColor={textColor} />
          <LinkRow icon="tag" label="Version" value={APP_VERSION} primary={primary} muted={muted} textColor={textColor} />
        </SectionCard>

        {/* DANGER ZONE */}
        <SectionCard icon="alert-triangle" title="Account actions" primary={primary} muted={muted} textColor={textColor}>
          <LinkRow icon="download" label={exportingData ? 'Preparing your data…' : 'Download my data'} onPress={handleExportData} primary={primary} muted={muted} textColor={textColor} />
          <LinkRow icon="log-out" label="Sign out" onPress={confirmSignOut} danger primary={primary} muted={muted} textColor={textColor} />
          <LinkRow icon="trash-2" label="Delete account" onPress={confirmDelete} danger primary={primary} muted={muted} textColor={textColor} />
        </SectionCard>
      </ScrollView>

      {/* onManageContacts was a dangling prop — the row never rendered because
          nothing was passed. It now opens the check-in sheet. */}
      <SafetyHubModal
        visible={safetyHubOpen}
        onClose={() => setSafetyHubOpen(false)}
        onManageContacts={() => setGetHomeSafeOpen(true)}
      />
      <GetHomeSafeModal visible={getHomeSafeOpen} onClose={() => setGetHomeSafeOpen(false)} />
      <MfaSetupModal visible={mfaOpen} onClose={() => setMfaOpen(false)} onChanged={setMfaOn} />
    </View>
    </ErrorBoundary>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  section: { marginBottom: 16, padding: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  rowLabel: { fontSize: 13.5, fontWeight: '700' },
  rowSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  rowValue: { fontSize: 12, fontWeight: '600', maxWidth: 180, textAlign: 'right' },
  subLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 14, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  modeChipText: { fontSize: 12, fontWeight: '800' },
  modeDesc: { fontSize: 11, marginTop: 8, lineHeight: 15 },
  distChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  distText: { fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 4 },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 14 },
  ctaText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  themeCard: { width: 92, height: 76, borderRadius: 14, padding: 10, justifyContent: 'flex-end', overflow: 'hidden' },
  themeAccent: { position: 'absolute', top: 10, left: 10, width: 26, height: 26, borderRadius: 13 },
  themeName: { fontSize: 11, fontWeight: '800' },
  themeCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
});

export default SettingsScreen;