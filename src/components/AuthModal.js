import React, { useState, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, Animated, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const HM = SCREEN_W < 375 ? 12 : 25;
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { SecurityService } from '../services/securityService';
import { useToast } from './ToastNotification';

const QUICK_INTERESTS = [
  { label: 'Music', icon: '🎵' },
  { label: 'Art', icon: '🎨' },
  { label: 'Sports', icon: '⚽' },
  { label: 'Tech', icon: '💻' },
  { label: 'Food', icon: '🍽️' },
  { label: 'Fashion', icon: '👗' },
  { label: 'Dance', icon: '💃' },
  { label: 'Film', icon: '🎬' },
  { label: 'Gaming', icon: '🎮' },
  { label: 'Travel', icon: '✈️' },
  { label: 'Fitness', icon: '💪' },
  { label: 'Nature', icon: '🌿' },
];

const GENDERS = ['Man', 'Woman', 'Non-binary', 'Prefer not to say'];

export const AuthModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const toast = useToast();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [wantsEmail, setWantsEmail] = useState(true);
  const [confirmLater, setConfirmLater] = useState(true); // true = continue without confirming
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  const switchMode = (newMode) => {
    Animated.timing(slideAnim, {
      toValue: newMode === 'signin' ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setMode(newMode));
    setError('');
    setSuccess('');
  };

  const toggleInterest = (label) => {
    setSelectedInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(error.message);
      SecurityService.logSecurityEvent(null, 'AUTH_SIGNIN_FAILED', { email: email.trim(), error: error.message });
    } else {
      SecurityService.logSecurityEvent(data.user.id, 'AUTH_SIGNIN_SUCCESS');
      onClose();
      setTimeout(() => toast?.show('Welcome back! 👑', 'success'), 300);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !username.trim()) {
      setError('Username, email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const year = parseInt(birthYear, 10);
    if (birthYear && (isNaN(year) || year < 1920 || year > new Date().getFullYear() - 13)) {
      setError('Please enter a valid birth year (you must be 13+).');
      return;
    }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      SecurityService.logSecurityEvent(null, 'AUTH_SIGNUP_FAILED', { email: email.trim(), username: username.trim(), error: error.message });
      return;
    }
    if (data.user) {
      SecurityService.logSecurityEvent(data.user.id, 'AUTH_SIGNUP_SUCCESS');
      supabase.from('profiles').upsert({
        id: data.user.id,
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        city: city.trim() || null,
        gender: gender || null,
        birth_year: year || null,
        interests: selectedInterests,
        vibe_score: 0,
        is_discoverable: true,
        wants_email: wantsEmail,
        email_confirmed: false,
        confirm_later: confirmLater,
      }).then(() => {});
    }

    const hasSession = !!data.session;
    handleClose();

    setTimeout(() => {
      if (hasSession) {
        // Supabase doesn't require confirmation — user is in immediately
        toast?.show(
          confirmLater
            ? 'Welcome to The Gruvs! 🎉 Confirmation email sent — confirm whenever you\'re ready.'
            : 'Welcome to The Gruvs! 🎉 Check your inbox to confirm your email.',
          'success'
        );
      } else {
        // Supabase requires email confirmation before session is granted
        toast?.show(
          'Account created! 📧 Check your inbox and confirm your email to sign in.',
          'info'
        );
      }
    }, 300);
  };

  const reset = () => {
    setEmail(''); setPassword(''); setUsername(''); setDisplayName('');
    setCity(''); setGender(''); setBirthYear(''); setSelectedInterests([]);
    setError(''); setSuccess(''); setMode('signin'); setShowPassword(false);
    setConfirmLater(true);
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: bg, borderColor: `${primary}33` }]}>

            <View style={[styles.glowBar, { backgroundColor: primary }]} />

            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: primary }]}>
                {mode === 'signin' ? '👑 ROYAL ACCESS' : '⚡ JOIN THE ROYALTY'}
              </Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={[styles.tabRow, { borderColor: `${primary}40` }]}>
              {['signin', 'signup'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => switchMode(m)}
                  style={[styles.tabBtn, mode === m && { backgroundColor: primary }]}
                >
                  <Text style={[styles.tabText, { color: mode === m ? '#000' : textColor }]}>
                    {m === 'signin' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── SIGN-UP EXTRA FIELDS ── */}
            {mode === 'signup' && (
              <>
                <Text style={[styles.label, { color: textColor }]}>Royal Name *</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="Your @username..."
                  placeholderTextColor={muted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: textColor }]}>Display Name</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="How you appear to others..."
                  placeholderTextColor={muted}
                  value={displayName}
                  onChangeText={setDisplayName}
                />

                <Text style={[styles.label, { color: textColor }]}>City</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="e.g. Johannesburg, Cape Town..."
                  placeholderTextColor={muted}
                  value={city}
                  onChangeText={setCity}
                />

                <Text style={[styles.label, { color: textColor }]}>Birth Year</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="e.g. 1998"
                  placeholderTextColor={muted}
                  value={birthYear}
                  onChangeText={setBirthYear}
                  keyboardType="numeric"
                  maxLength={4}
                />

                <Text style={[styles.label, { color: textColor }]}>Gender</Text>
                <View style={styles.genderRow}>
                  {GENDERS.map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGender(gender === g ? '' : g)}
                      style={[styles.genderBtn, { borderColor: gender === g ? primary : `${primary}30`, backgroundColor: gender === g ? `${primary}20` : 'transparent' }]}
                    >
                      <Text style={[styles.genderText, { color: gender === g ? primary : muted }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: textColor }]}>Quick Interests</Text>
                <Text style={[styles.sublabel, { color: muted }]}>Pick what excites you — we'll tailor your feed</Text>
                <View style={styles.interestGrid}>
                  {QUICK_INTERESTS.map(({ label, icon }) => {
                    const sel = selectedInterests.includes(label);
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => toggleInterest(label)}
                        style={[styles.interestPill, { borderColor: sel ? primary : `${primary}25`, backgroundColor: sel ? `${primary}20` : `${primary}06` }]}
                      >
                        <Text style={{ fontSize: 14 }}>{icon}</Text>
                        <Text style={[styles.interestText, { color: sel ? primary : muted }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── COMMON FIELDS ── */}
            <Text style={[styles.label, { color: textColor }]}>Email</Text>
            <TextInput
              style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
              placeholder="your@email.com"
              placeholderTextColor={muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />

            <Text style={[styles.label, { color: textColor }]}>Password</Text>
            <View style={[styles.passwordWrap, { borderColor: `${primary}40` }]}>
              <TextInput
                style={[styles.passwordInput, { color: textColor }]}
                placeholder="••••••••"
                placeholderTextColor={muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={muted} />
              </TouchableOpacity>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}
            {!!success && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ {success}</Text>
              </View>
            )}

            {/* Email confirmation preference — signup only */}
            {mode === 'signup' && (
              <>
                <View style={[styles.confirmBox, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]}>
                  <Feather name="mail" size={14} color={primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, gap: 10 }}>
                    <Text style={[styles.confirmTitle, { color: textColor }]}>Email Confirmation</Text>
                    <Text style={[styles.confirmSub, { color: muted }]}>
                      We'll always send a confirmation email. Choose when to confirm:
                    </Text>
                    <View style={styles.confirmOptions}>
                      <TouchableOpacity
                        style={[styles.confirmOpt, { borderColor: confirmLater ? `${primary}30` : primary, backgroundColor: confirmLater ? 'transparent' : `${primary}18` }]}
                        onPress={() => setConfirmLater(false)}
                      >
                        <View style={[styles.radio, { borderColor: confirmLater ? `${primary}40` : primary }]}>
                          {!confirmLater && <View style={[styles.radioDot, { backgroundColor: primary }]} />}
                        </View>
                        <Text style={[styles.confirmOptText, { color: confirmLater ? muted : primary }]}>Confirm first</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmOpt, { borderColor: confirmLater ? primary : `${primary}30`, backgroundColor: confirmLater ? `${primary}18` : 'transparent' }]}
                        onPress={() => setConfirmLater(true)}
                      >
                        <View style={[styles.radio, { borderColor: confirmLater ? primary : `${primary}40` }]}>
                          {confirmLater && <View style={[styles.radioDot, { backgroundColor: primary }]} />}
                        </View>
                        <Text style={[styles.confirmOptText, { color: confirmLater ? primary : muted }]}>Use app now, confirm later</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Email Opt-in */}
                <TouchableOpacity
                  style={styles.optInRow}
                  onPress={() => setWantsEmail(!wantsEmail)}
                >
                  <View style={[styles.checkbox, wantsEmail ? { backgroundColor: primary, borderColor: primary } : { borderColor: `${primary}50` }]}>
                    {wantsEmail && <Feather name="check" size={14} color="#000" />}
                  </View>
                  <Text style={[styles.optInText, { color: muted }]}>
                    Send me emails about new events, updates, and Royal invites.
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Email Opt-in — signin only (already shown inside signup block above) */}
            {mode === 'signin' && null}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: primary }, loading && styles.disabled]}
              onPress={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.actionText}>
                    {mode === 'signin' ? 'ENTER THE KINGDOM' : 'CLAIM YOUR THRONE'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
              <Text style={[styles.footerLink, { color: primary }]}>
                {mode === 'signin'
                  ? "No account? Join the royalty →"
                  : "Already a royal? Sign in →"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, borderRadius: 24, borderWidth: 1, overflow: 'hidden', paddingBottom: 30 },
  glowBar: { height: 4, width: '100%', opacity: 0.9 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: HM, paddingTop: 25, paddingBottom: 20 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  tabRow: { flexDirection: 'row', marginHorizontal: HM, borderWidth: 1, borderRadius: 30, overflow: 'hidden', marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginHorizontal: HM, opacity: 0.75 },
  sublabel: { fontSize: 11, marginHorizontal: HM, marginTop: -6, marginBottom: 10 },
  input: { marginHorizontal: HM, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14 },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: HM, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  passwordInput: { flex: 1, fontSize: 14 },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: HM, marginBottom: 16 },
  genderBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  genderText: { fontSize: 12, fontWeight: '700' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: HM, marginBottom: 18 },
  interestPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  interestText: { fontSize: 12, fontWeight: '700' },
  errorBox: { marginHorizontal: HM, marginBottom: 15, backgroundColor: 'rgba(255,60,60,0.12)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,60,60,0.3)' },
  errorText: { color: '#ff6b6b', fontSize: 12, fontWeight: '600' },
  successBox: { marginHorizontal: HM, marginBottom: 15, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  successText: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  actionBtn: { marginHorizontal: HM, paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginBottom: 18, marginTop: 5 },
  actionText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
  disabled: { opacity: 0.7 },
  footerLink: { textAlign: 'center', fontSize: 13, fontWeight: '600', paddingHorizontal: HM },
  optInRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: HM, marginBottom: 15, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  optInText: { fontSize: 12, flex: 1, lineHeight: 16 },
  confirmBox: { flexDirection: 'row', gap: 10, marginHorizontal: HM, marginBottom: 16, borderWidth: 1, borderRadius: 14, padding: 14 },
  confirmTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  confirmSub: { fontSize: 11, lineHeight: 15 },
  confirmOptions: { flexDirection: 'row', gap: 8 },
  confirmOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  confirmOptText: { fontSize: 11, fontWeight: '700', flex: 1 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
});
