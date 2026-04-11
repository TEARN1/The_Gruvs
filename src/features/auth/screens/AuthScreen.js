import React, { useMemo, useState } from 'react';
import { useStore } from '../../../core/state/useStore';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, Alert, ActivityIndicator
} from 'react-native';
import { GENDERS, INTERESTS } from '../../../core/data';
import GruvsLogo from '../../../shared/components/GruvsLogo';

const THEME_PRESETS = {
  male: [
    {
      id: 'midnight-drive',
      name: 'Midnight Drive',
      accent: '#3b82f6',
      secondary: '#38bdf8',
      glow: 'rgba(59,130,246,0.35)',
      backgroundTop: '#020617',
      backgroundBottom: '#0f172a',
      card: 'rgba(8, 15, 31, 0.88)',
      border: 'rgba(96, 165, 250, 0.35)',
      muted: 'rgba(191,219,254,0.78)',
    },
    {
      id: 'emerald-league',
      name: 'Emerald League',
      accent: '#10b981',
      secondary: '#22c55e',
      glow: 'rgba(16,185,129,0.35)',
      backgroundTop: '#03140f',
      backgroundBottom: '#052e2b',
      card: 'rgba(6, 24, 20, 0.88)',
      border: 'rgba(52,211,153,0.35)',
      muted: 'rgba(167,243,208,0.78)',
    },
  ],
  female: [
    {
      id: 'rose-luxe',
      name: 'Rose Luxe',
      accent: '#ff4da6',
      secondary: '#fb7185',
      glow: 'rgba(255,77,166,0.35)',
      backgroundTop: '#1f1020',
      backgroundBottom: '#3b0a28',
      card: 'rgba(42, 13, 31, 0.84)',
      border: 'rgba(251,113,133,0.32)',
      muted: 'rgba(255,228,236,0.8)',
    },
    {
      id: 'violet-runway',
      name: 'Violet Runway',
      accent: '#a855f7',
      secondary: '#ec4899',
      glow: 'rgba(168,85,247,0.36)',
      backgroundTop: '#170b2c',
      backgroundBottom: '#2e1065',
      card: 'rgba(35, 11, 59, 0.84)',
      border: 'rgba(216,180,254,0.32)',
      muted: 'rgba(233,213,255,0.78)',
    },
  ],
  other: [
    {
      id: 'aurora-shift',
      name: 'Aurora Shift',
      accent: '#8b5cf6',
      secondary: '#22d3ee',
      glow: 'rgba(139,92,246,0.34)',
      backgroundTop: '#0b1020',
      backgroundBottom: '#1e1b4b',
      card: 'rgba(18, 22, 47, 0.86)',
      border: 'rgba(165,180,252,0.3)',
      muted: 'rgba(224,231,255,0.78)',
    },
    {
      id: 'sunset-wave',
      name: 'Sunset Wave',
      accent: '#f97316',
      secondary: '#facc15',
      glow: 'rgba(249,115,22,0.34)',
      backgroundTop: '#24120b',
      backgroundBottom: '#4a1d11',
      card: 'rgba(54, 24, 12, 0.84)',
      border: 'rgba(253,186,116,0.32)',
      muted: 'rgba(255,237,213,0.78)',
    },
  ],
  prefer_not: [
    {
      id: 'graphite-gold',
      name: 'Graphite Gold',
      accent: '#f59e0b',
      secondary: '#a3a3a3',
      glow: 'rgba(245,158,11,0.28)',
      backgroundTop: '#111111',
      backgroundBottom: '#27272a',
      card: 'rgba(24, 24, 27, 0.88)',
      border: 'rgba(245,158,11,0.24)',
      muted: 'rgba(228,228,231,0.72)',
    },
    {
      id: 'mono-ice',
      name: 'Mono Ice',
      accent: '#94a3b8',
      secondary: '#e2e8f0',
      glow: 'rgba(148,163,184,0.25)',
      backgroundTop: '#0f172a',
      backgroundBottom: '#1e293b',
      card: 'rgba(15, 23, 42, 0.88)',
      border: 'rgba(148,163,184,0.28)',
      muted: 'rgba(226,232,240,0.72)',
    },
  ],
};

const getPresetsForGender = (gender) => THEME_PRESETS[gender] || THEME_PRESETS.other;

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', gender: 'other' });
  const [interests, setInterests] = useState([]);

  const isSignup = mode === 'signup';
  const currentPresets = useMemo(() => getPresetsForGender(form.gender), [form.gender]);
  const [selectedPresetId, setSelectedPresetId] = useState(getPresetsForGender('other')[0].id);

  const selectedPreset = currentPresets.find((preset) => preset.id === selectedPresetId) || currentPresets[0];
  const previewAcc = selectedPreset?.accent || GENDERS.find((g) => g.value === form.gender)?.accent || '#ff4da6';

  const toggleInterest = (id) => {
    setInterests((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleGenderChange = (gender) => {
    const nextPresets = getPresetsForGender(gender);
    setForm((prev) => ({ ...prev, gender }));
    setSelectedPresetId(nextPresets[0].id);
  };

  const { signUp, signIn, loading, error } = useStore();

  const handleSubmit = async () => {
    if (isSignup) {
      if (!form.email || !form.password || !form.username) {
        Alert.alert('Missing Fields', 'Please fill in all required fields.');
        return;
      }
      if (form.password !== form.confirm) {
        Alert.alert('Mismatch', 'Passwords do not match.');
        return;
      }
      const res = await signUp(form.email, form.password, {
        username: form.username,
        gender: form.gender,
        interests,
        themePreset: selectedPreset.id,
      });
      if (res.success) Alert.alert('Success', `Account created with the ${selectedPreset.name} theme.`);
    } else {
      const res = await signIn(form.email || form.username, form.password);
      if (res.success) {
        // Login handles state change
      }
    }
  };

  const handleVisitor = () => {
    useStore.getState().setUser({
      id: 'visitor',
      name: 'Visitor',
      visitor: true,
      gender: form.gender,
      themePreset: selectedPreset.id,
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: selectedPreset.backgroundTop }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.center,
            {
              flexGrow: 1,
              paddingVertical: 40,
              paddingHorizontal: 20,
              backgroundColor: selectedPreset.backgroundBottom,
            },
          ]}
        >
          <View style={styles.previewStack}>
            <View style={[
              styles.heroGlow,
              {
                backgroundColor: selectedPreset.glow,
                ...Platform.select({
                  web: { boxShadow: `0 0 35px ${selectedPreset.accent}88` },
                  default: { shadowColor: selectedPreset.accent }
                })
              },
            ]} />
            <View style={[
              styles.glassContainerAuth,
              {
                backgroundColor: selectedPreset.card,
                borderColor: selectedPreset.border,
                ...Platform.select({
                  web: { boxShadow: `0 16px 22px rgba(0,0,0,0.24)` },
                  default: { shadowColor: selectedPreset.accent }
                })
              },
            ]}>
              <GruvsLogo size={80} style={{ marginBottom: 15 }} />
              <Text style={[styles.tagline, { color: selectedPreset.muted }]}>ADVANCED NETWORK</Text>

              <View style={styles.titleRow}>
                <Text style={styles.authTitle}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>
                <View style={[styles.accentDot, { backgroundColor: selectedPreset.accent }]} />
              </View>

              <Text style={[styles.previewLabel, { color: selectedPreset.muted }]}>
                {selectedPreset.name} • tuned for {form.gender.replace('_', ' ')}
              </Text>

              <TextInput
                style={[styles.glassInput, { borderColor: selectedPreset.border }]}
                placeholder={isSignup ? 'Username' : 'Email or Username'}
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={isSignup ? form.username : (form.email || form.username)}
                onChangeText={(t) => setForm((p) => ({ ...p, username: t, email: isSignup ? p.email : t }))}
              />

              {isSignup && (
                <TextInput
                  style={[styles.glassInput, { borderColor: selectedPreset.border }]}
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={form.email}
                  onChangeText={(t) => setForm((p) => ({ ...p, email: t }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}

              <TextInput
                style={[styles.glassInput, { borderColor: selectedPreset.border }]}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.6)"
                secureTextEntry
                value={form.password}
                onChangeText={(t) => setForm((p) => ({ ...p, password: t }))}
              />

              {isSignup && (
                <TextInput
                  style={[styles.glassInput, { borderColor: selectedPreset.border }]}
                  placeholder="Confirm Password"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  secureTextEntry
                  value={form.confirm}
                  onChangeText={(t) => setForm((p) => ({ ...p, confirm: t }))}
                />
              )}

              {isSignup && (
                <View style={styles.gap}>
                  <Text style={[styles.glassLabel, { color: selectedPreset.muted }]}>Select Gender</Text>
                  <View style={styles.row}>
                    {GENDERS.map((g) => (
                      <TouchableOpacity
                        key={g.value}
                        onPress={() => handleGenderChange(g.value)}
                        style={[
                          styles.glassPill,
                          {
                            borderColor: form.gender === g.value ? selectedPreset.secondary : 'rgba(255,255,255,0.24)',
                            backgroundColor: form.gender === g.value ? selectedPreset.accent : 'transparent',
                          },
                        ]}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{g.icon} {g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.glassLabel, styles.sectionSpacing, { color: selectedPreset.muted }]}>
                    Pick your theme vibe
                  </Text>
                  <View style={styles.themeGrid}>
                    {currentPresets.map((preset) => {
                      const active = preset.id === selectedPreset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={() => setSelectedPresetId(preset.id)}
                          style={[
                            styles.themeCard,
                            {
                              borderColor: active ? preset.secondary : 'rgba(255,255,255,0.16)',
                              backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                              ...Platform.select({
                                web: { boxShadow: `0 8px 10px ${preset.accent}33` },
                                default: { shadowColor: preset.accent }
                              }),
                            },
                          ]}
                        >
                          <View style={styles.themeSwatchRow}>
                            <View style={[styles.themeSwatch, { backgroundColor: preset.accent }]} />
                            <View style={[styles.themeSwatch, { backgroundColor: preset.secondary }]} />
                            <View style={[styles.themeSwatch, { backgroundColor: preset.backgroundBottom }]} />
                          </View>
                          <Text style={styles.themeCardTitle}>{preset.name}</Text>
                          <Text style={[styles.themeCardMeta, { color: selectedPreset.muted }]}>
                            Accent-first • cinematic look
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.glassLabel, styles.sectionSpacing, { color: selectedPreset.muted }]}>
                    What are your interests?
                  </Text>
                  <View style={styles.row}>
                    {INTERESTS.map((int) => (
                      <TouchableOpacity
                        key={int.id}
                        onPress={() => toggleInterest(int.id)}
                        style={[
                          styles.glassPill,
                          {
                            borderColor: interests.includes(int.id) ? int.color : 'rgba(255,255,255,0.24)',
                            backgroundColor: interests.includes(int.id) ? int.color : 'transparent',
                          },
                        ]}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{int.icon} {int.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[
                  styles.glassJoinBtn,
                  {
                    backgroundColor: selectedPreset.accent,
                    ...Platform.select({
                      web: { boxShadow: `0 12px 14px ${selectedPreset.accent}55` },
                      default: { shadowColor: selectedPreset.accent }
                    }),
                  },
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.glassJoinBtnText}>{isSignup ? 'SIGN UP' : 'LOGIN'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setMode(isSignup ? 'login' : 'signup')}>
                <Text style={styles.switchText}>
                  {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={{ color: selectedPreset.accent, fontWeight: '800' }}>{isSignup ? 'LOGIN' : 'SIGN UP'}</Text>
                </Text>
              </TouchableOpacity>

              {!isSignup && (
                <TouchableOpacity style={styles.visitorButton} onPress={handleVisitor}>
                  <Text style={styles.switchText}>Just Looking Around</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  previewStack: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  heroGlow: {
    position: 'absolute',
    top: 40,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.85,
    ...Platform.select({
        web: { boxShadow: '0 0 35px rgba(0,0,0,0.55)' },
        default: {
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.55,
            shadowRadius: 35,
            elevation: 10,
        }
    })
  },
  glassContainerAuth: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 30,
    padding: 30,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
        web: { boxShadow: '0 16px 22px rgba(0,0,0,0.24)' },
        default: {
            shadowOpacity: 0.24,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 16 },
            elevation: 15,
        }
    })
  },
  tagline: { letterSpacing: 4, fontSize: 10, fontWeight: '800', marginBottom: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authTitle: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  accentDot: { width: 10, height: 10, borderRadius: 5 },
  previewLabel: { fontSize: 13, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  glassInput: {
    width: '100%',
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
  },
  glassLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 10 },
  glassPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  themeGrid: { width: '100%', gap: 12 },
  themeCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    ...Platform.select({
        web: { boxShadow: '0 8px 10px rgba(0,0,0,0.18)' },
        default: {
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
        }
    })
  },
  themeSwatchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  themeSwatch: { width: 26, height: 26, borderRadius: 13 },
  themeCardTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  themeCardMeta: { fontSize: 12, fontWeight: '600' },
  glassJoinBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({
        web: { boxShadow: '0 12px 14px rgba(0,0,0,0.35)' },
        default: {
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 12 },
            elevation: 10,
        }
    })
  },
  glassJoinBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  switchText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  errorText: { color: '#fca5a5', marginBottom: 12, fontSize: 13, textAlign: 'center' },
  gap: { width: '100%', marginVertical: 10 },
  sectionSpacing: { marginTop: 12 },
  visitorButton: { marginTop: 30, opacity: 0.8 },
});
