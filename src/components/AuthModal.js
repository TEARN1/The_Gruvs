import React, { useState, useRef } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, Animated, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Dimensions, useWindowDimensions,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { APP_WEB_URL } from '../constants/appUrl';
import { resilient } from '../utils/resilience';
import { logError } from '../utils/logError';
import { SecurityService } from '../services/securityService';
import { track } from '../utils/analytics';
import { useToast } from './ToastNotification';
import { useBackClose } from '../hooks/useBackClose';
import { GlitterBurst } from './GlitterBurst';
import { escapeLike, findImpersonation } from '../utils/handleGuard';
import { isLikelyBot } from '../utils/botCheck';
import { CalendarPicker } from './DateTimePickers';

const SCREEN_W = Dimensions.get('window').width;
const HM = SCREEN_W < 375 ? 12 : 25;

const QUICK_INTERESTS = [
  { label: 'Music', icon: 'music' },
  { label: 'Art', icon: 'palette' },
  { label: 'Sports', icon: 'soccer' },
  { label: 'Tech', icon: 'laptop' },
  { label: 'Food', icon: 'silverware-fork-knife' },
  { label: 'Fashion', icon: 'hanger' },
  { label: 'Dance', icon: 'dance-ballroom' },
  { label: 'Film', icon: 'movie-open' },
  { label: 'Gaming', icon: 'gamepad-variant' },
  { label: 'Travel', icon: 'airplane' },
  { label: 'Fitness', icon: 'arm-flex' },
  { label: 'Nature', icon: 'leaf' },
];

const GENDERS = ['Man', 'Woman', 'Non-binary', 'Prefer not to say'];

export const AuthModal = ({ visible, onClose }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const toast = useToast();
  // Responsive: react to the ACTUAL viewport (resize, rotation, small phones),
  // not a value captured once at module load.
  const { width: winW } = useWindowDimensions();
  const isSmall = winW < 400;
  // Always leave a gutter on tiny screens (a hard-capped 440 could touch both
  // edges on a 360px phone). Vertical overflow is handled by the scroller.
  const cardMaxW = Math.min(440, winW - (isSmall ? 20 : 32));
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [wantsEmail, setWantsEmail] = useState(true);
  const [signupSuccessFx, setSignupSuccessFx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Two-step signup: step 1 = essentials (username/email/password),
  // step 2 = personalisation (all optional, skippable). One long form was the
  // #1 "signing up is difficult" complaint.
  const [signupStep, setSignupStep] = useState(1);
  const [checkingName, setCheckingName] = useState(false);
  // Bot defense (#380): a honeypot a human never sees + a form-open timestamp.
  const [hp, setHp] = useState('');
  const formOpenedAt = useRef(Date.now());
  // Birthday fields auto-advance DD → MM → YYYY.
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
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
    setSignupStep(1);
  };

  // Step 1 → 2 gate: validate the essentials and make sure the @handle is
  // free BEFORE the user invests time in the optional fields.
  const handleContinue = async () => {
    const trimmedEmail = email.trim();
    const handle = username.trim().replace(/^@/, '');
    if (!handle || !trimmedEmail || !password.trim()) {
      setError('Username, email and password are required.');
      return;
    }
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(handle)) {
      setError('Username must be 3–24 characters — letters, numbers, dots or underscores.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setCheckingName(true);
    try {
      // escapeLike: a handle with `_` or `%` must not act as an ilike wildcard,
      // or `a_b` would match `axb` and give false "taken" (and let real conflicts slip).
      const { data } = await supabase.from('profiles')
        .select('id').ilike('username', escapeLike(handle)).limit(1).maybeSingle();
      if (data) { setError(`${handle} is taken — try another username.`); return; }

      // Impersonation: a handle that READS the same as an existing one (k0nka for
      // konka, kon.ka, konkaa) is how someone trades on a real venue's name.
      // Best-effort client check; the scalable enforcement is a unique index on a
      // stored skeleton column (needs the DB migration).
      try {
        const { data: existing } = await supabase.from('profiles').select('username').limit(1000);
        const clash = findImpersonation(handle, (existing || []).map((r) => r.username));
        if (clash) { setError(`${handle} looks too much like ${clash} — pick a more distinct name.`); return; }
      } catch { /* best-effort — never block a real signup on this */ }
    } catch { /* offline / RLS — let signup itself decide */ } finally {
      setCheckingName(false);
    }
    setUsername(handle);
    setSignupStep(2);
  };

  // Forgot password — the missing escape hatch that made sign-in feel broken.
  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Type your email above first, then tap "Forgot password" again.');
      return;
    }
    setError('');
    // Send them back to a place that can complete the reset. On a deployed web
    // origin that's this exact origin (AuthContext picks up the recovery token in
    // the URL). On localhost dev or native, route to the production site so the
    // link never lands on a dead localhost. Configure via EXPO_PUBLIC_SITE_URL.
    const SITE_URL = APP_WEB_URL;
    const onWeb = Platform.OS === 'web' && typeof window !== 'undefined';
    const isLocalhost = onWeb && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(window.location.origin);
    const redirectTo = onWeb && !isLocalhost ? window.location.origin : SITE_URL;
    try {
      await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo });
    } catch { /* always show the same message — no account enumeration */ }
    setSuccess(`If an account exists for ${trimmedEmail}, a reset link is on its way.`);
  };

  const toggleInterest = (label) => {
    setSelectedInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    // Basic email format check before hitting the server
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) {
        // Return a generic message to prevent account enumeration
        setError('Incorrect email or password. Please try again.');
        SecurityService.logSecurityEvent(null, 'AUTH_SIGNIN_FAILED', { error: error.message });
      } else {
        SecurityService.logSecurityEvent(data.user.id, 'AUTH_SIGNIN_SUCCESS');
        onClose();
        setTimeout(() => toast?.show('Welcome back! 👑', 'success'), 300);
      }
    } catch (e) {
      setError(e?.message || 'Sign in failed — check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    // Bot defense before anything else — a filled honeypot or an instant submit
    // is a script, not a person. Generic message so we don't teach the bot why.
    if (isLikelyBot({ honeypot: hp, elapsedMs: Date.now() - formOpenedAt.current }).bot) {
      setError('Something went wrong — please try again.');
      return;
    }
    if (!email.trim() || !password.trim() || !username.trim()) {
      setError('Username, email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    const trimmedEmail2 = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail2)) {
      setError('Please enter a valid email address.');
      return;
    }
    const year = parseInt(birthYear, 10);
    const day = parseInt(birthDay, 10);
    const month = parseInt(birthMonth, 10);
    const currentYear = new Date().getFullYear(); // evaluated at call-time, not parse-time
    // Birthday is REQUIRED with an 18+ floor. The Gruvs hosts age-restricted
    // (alcohol/nightlife) events and, by requiring 18+ at the door of the app,
    // sidesteps POPIA's minors regime entirely. This is the app-level gate; the
    // per-event age_restriction still applies on top for e.g. 21+ events.
    let birthDateStr = null;
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      setError('Please enter your birthday — day, month and year.');
      setSignupStep(2);
      return;
    }
    if (year < 1920 || year > currentYear - 18 || month < 1 || month > 12 || day < 1 || day > 31) {
      setError('You must be 18 or older to use The Gruvs.');
      setSignupStep(2);
      return;
    }
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      setError('That birthday isn’t a real date — please check it.');
      setSignupStep(2);
      return;
    }
    // Exact age check (handles the month/day, not just the year).
    let age = currentYear - year;
    const today = new Date();
    if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
    if (age < 18) {
      setError('You must be 18 or older to use The Gruvs.');
      setSignupStep(2);
      return;
    }
    birthDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setLoading(true);
    setError('');
    let data;
    try {
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username.trim() } },
      });
      if (result.error) {
        setError(result.error.message);
        SecurityService.logSecurityEvent(null, 'AUTH_SIGNUP_FAILED', { email: email.trim(), username: username.trim(), error: result.error.message });
        return;
      }
      data = result.data;
    } catch (e) {
      setError(e?.message || 'Sign up failed — check your connection.');
      return;
    } finally {
      setLoading(false);
    }
    if (!data) return;
    if (data.user) {
      SecurityService.logSecurityEvent(data.user.id, 'AUTH_SIGNUP_SUCCESS');
      track('signup', { hasCity: !!city.trim(), interests: selectedInterests.length });
      const profilePayload = {
        id: data.user.id,
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        city: city.trim() || null,
        gender: gender || null,
        birth_year: (anyBirth && !isNaN(year)) ? year : null,
        birth_date: birthDateStr,
        interests: selectedInterests,
        vibe_score: 0,
        is_discoverable: true,
        wants_email: wantsEmail,
        // NOTE: every key here must exist on `profiles`. PostgREST rejects the
        // WHOLE row if one column is unknown, so a single stale field silently
        // discards the entire signup. `email_confirmed` and `confirm_later` were
        // exactly that — never migrated, read by nothing, and they cost every
        // user their city, gender, interests and date of birth.
      };
      resilient(
        [
          () => supabase.from('profiles').upsert(profilePayload),
          () => supabase.from('profiles').insert(profilePayload),
          () => supabase.rpc('create_user_profile', { p_payload: profilePayload }),
        ],
        { attemptsPerTier: 3, baseMs: 500, label: `AuthModal.createProfile:${data.user.id}`, fallbackValue: null }
      ).then((res) => {
        // A signup that saves nothing must not look like a success. All three
        // tiers returning the fallback means the profile is empty — the age gate
        // has no date of birth to check, so this has to be visible, not swallowed.
        if (res == null) {
          logError('AuthModal.createProfile:allTiersFailed', new Error('profile payload rejected'), {
            userId: data.user.id,
          });
        }
      });
    }

    // Signing up should log you straight in. signUp only returns a session when
    // the project has email confirmation disabled; when it's on, we try the
    // password we just set — that succeeds only if confirmation isn't enforced.
    let hasSession = !!data.session;
    if (!hasSession) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      hasSession = !!signInData?.session;
    }

    setSignupSuccessFx(Date.now());

    // Drop the user STRAIGHT into the app the instant we have a session — no
    // countdown, no waiting, no email round-trip. Closing the modal re-renders
    // App into the main experience immediately.
    //
    // We deliberately do NOT fire our own signInWithOtp here anymore: Supabase
    // rate-limits it (~1/min) and returns "you can only request this after N
    // seconds" — which is exactly the countdown users were seeing. If the project
    // enforces "Confirm email", Supabase already sent its OWN confirmation mail on
    // signUp; we don't double-send.
    if (hasSession) {
      handleClose();
      toast?.show('Welcome to The Gruvs! 🎉', 'success');
    } else {
      // No session = the project enforces email confirmation. The account exists;
      // they just need to confirm via the mail Supabase already sent, then sign in.
      handleClose();
      toast?.show('Account created! Check your email to confirm, then sign in.', 'info');
    }
  };

  const reset = () => {
    setEmail(''); setPassword(''); setUsername(''); setDisplayName('');
    setCity(''); setGender(''); setBirthYear(''); setSelectedInterests([]);
    setError(''); setSuccess(''); setMode('signin'); setShowPassword(false);
    setConfirmLater(true); setSignupStep(1);
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* TouchableWithoutFeedback is skipped on web — it intercepts TextInput focus
          events and prevents the keyboard from appearing. Keyboard.dismiss is a
          no-op on web anyway. */}
      <View style={styles.overlay}>
          {/* On web, KeyboardAvoidingView is native-only and can swallow the tap
              that focuses an input (so the on-screen keyboard never opens on
              mobile browsers). Use a plain View on web; the browser handles
              keyboard avoidance itself. */}
          {(() => {
            const isWeb = Platform.OS === 'web';
            const Wrap = isWeb ? View : KeyboardAvoidingView;
            // On web the Wrap must have a DEFINITE height (fill the overlay) or a
            // `%` height on anything inside it resolves to nothing — which is why
            // the "scroller" used to grow to its content and never scroll.
            // minHeight:0 is ESSENTIAL — a flex item's default min-height is
            // `auto`, i.e. its content size, so `flex:1` alone will NOT shrink it
            // below a tall form. Without this the scroller grows to the content
            // and never scrolls (the exact bug). Verified headless at 390x620.
            const wrapProps = isWeb
              ? { style: { flex: 1, minHeight: 0, width: '100%' } }
              : { behavior: Platform.OS === 'ios' ? 'padding' : 'height', style: { width: '100%', alignItems: 'center' } };
            // On web, RN's ScrollView adds touch/responder handlers that can eat the
            // tap that focuses an input on mobile browsers -> keyboard never opens.
            // Use a plain scrollable View on web; the browser scrolls natively.
            const Scroller = isWeb ? View : ScrollView;
            // Web: a PURE scroll container — bounded height (flex:1 fills the Wrap,
            // which fills the overlay) + overflowY:auto. The centering lives on the
            // inner wrapper below, NOT here, so it can never clip.
            const scrollerProps = isWeb
              ? { style: { flex: 1, minHeight: 0, width: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } }
              : { showsVerticalScrollIndicator: false, contentContainerStyle: styles.scrollContent, keyboardShouldPersistTaps: 'always' };
            // The known-good "center when it fits, scroll-from-top when it doesn't"
            // pattern: an inner box with min-height:100% + justify-center. Short
            // form → fills the viewport and centres. Tall form (Step 2 on a phone)
            // → grows past 100%, centring collapses to zero, the WHOLE form stays
            // reachable from the top. Native keeps using the ScrollView's own
            // contentContainerStyle.
            const InnerWrap = isWeb ? View : React.Fragment;
            const innerProps = isWeb
              ? { style: { minHeight: '100%', width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, boxSizing: 'border-box' } }
              : {};
            return (
          <Wrap {...wrapProps}>
            <Scroller {...scrollerProps}>
              <InnerWrap {...innerProps}>
                <View style={[styles.card, {
                  backgroundColor: bg, borderColor: `${primary}33`,
                  maxWidth: cardMaxW,
                  // Centring is handled by the InnerWrap (min-height:100% + justify
                  // center). The card just sizes to its content and the scroller
                  // owns the overflow.
                }]}>

                  <View style={[styles.glowBar, { backgroundColor: primary }]} />

            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: primary }]}>
                {mode === 'signin' ? '👑 Welcome back' : '⚡ Create your account'}
              </Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={textColor} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sublabel, { color: muted, marginBottom: 10 }]}>
              One account — the same login works on The Resident.
            </Text>

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

            {/* Signup progress dots */}
            {mode === 'signup' && (
              <View style={styles.stepRow}>
                {[1, 2].map(s => (
                  <View key={s} style={[styles.stepDot, { backgroundColor: signupStep >= s ? primary : `${primary}25` }, signupStep === s && styles.stepDotActive]} />
                ))}
                <Text style={[styles.stepText, { color: muted }]}>
                  {signupStep === 1 ? 'Step 1 of 2 — the essentials' : 'Step 2 of 2 — just your birthday, then make it yours'}
                </Text>
              </View>
            )}

            {/* ── SIGN-UP STEP 1: username only (email/password follow below) ── */}
            {mode === 'signup' && signupStep === 1 && (
              <>
                {/* Honeypot — visually hidden, off the a11y tree. A human never
                    sees or fills this; a form-filling bot does (#380). */}
                <TextInput
                  value={hp}
                  onChangeText={setHp}
                  autoComplete="off"
                  autoCorrect={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  tabIndex={-1}
                  placeholder="Leave this empty"
                  style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: HM, marginBottom: 8 }}>
                  <Text style={[styles.label, { color: textColor, marginHorizontal: 0, marginBottom: 0 }]}>Username *</Text>
                  {username.length > 0 && (
                    <Feather
                      name={/^[a-zA-Z0-9_.]{3,24}$/.test(username.trim().replace(/^@/, '')) ? "check-circle" : "alert-triangle"}
                      size={14}
                      color={/^[a-zA-Z0-9_.]{3,24}$/.test(username.trim().replace(/^@/, '')) ? "#10b981" : "#ef4444"}
                    />
                  )}
                </View>
                <Text style={[styles.sublabel, { color: muted }]}>This is your @handle — how friends find and tag you</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="e.g. @thabo"
                  placeholderTextColor={muted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </>
            )}

            {/* ── SIGN-UP STEP 2: personalisation (skippable) ── */}
            {mode === 'signup' && signupStep === 2 && (
              <>
                <TouchableOpacity onPress={() => setSignupStep(1)} style={styles.backRow}>
                  <Feather name="arrow-left" size={14} color={muted} />
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '700' }}>Back to account details</Text>
                </TouchableOpacity>

                <Text style={[styles.label, { color: textColor }]}>Your Name</Text>
                <Text style={[styles.sublabel, { color: muted }]}>The name people see on your profile</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="e.g. Thabo Nkosi"
                  placeholderTextColor={muted}
                  value={displayName}
                  onChangeText={setDisplayName}
                />

                <Text style={[styles.label, { color: textColor }]}>City</Text>
                <Text style={[styles.sublabel, { color: muted }]}>So we can show you events near you</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="e.g. Johannesburg, Cape Town..."
                  placeholderTextColor={muted}
                  value={city}
                  onChangeText={setCity}
                />

                <Text style={[styles.label, { color: textColor }]}>Birthday <Text style={{ color: primary }}>*</Text></Text>
                <Text style={[styles.sublabel, { color: muted }]}>The Gruvs is 18+. We celebrate your day — your year stays private.</Text>
                {/* One tap-to-open calendar instead of three cramped DD/MM/YYYY
                    boxes that overlapped on narrow screens. Defaults the view to
                    18 years ago so an adult isn't paging back decades. */}
                <TouchableOpacity
                  onPress={() => setDobPickerOpen(true)}
                  style={[styles.input, { borderColor: `${primary}40`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                >
                  <Text style={{ color: birthDay && birthMonth && birthYear ? textColor : muted, fontSize: 15 }}>
                    {birthDay && birthMonth && birthYear
                      ? `${birthDay.padStart(2, '0')}/${birthMonth.padStart(2, '0')}/${birthYear}`
                      : 'Pick your birthday'}
                  </Text>
                  <Feather name="calendar" size={17} color={primary} />
                </TouchableOpacity>

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

                <Text style={[styles.label, { color: textColor }]}>What are you into?</Text>
                <Text style={[styles.sublabel, { color: muted }]}>Pick a few — this helps us show you events you'll love</Text>
                <View style={styles.interestGrid}>
                  {QUICK_INTERESTS.map(({ label, icon }) => {
                    const sel = selectedInterests.includes(label);
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => toggleInterest(label)}
                        style={[styles.interestPill, { borderColor: sel ? primary : `${primary}25`, backgroundColor: sel ? `${primary}20` : `${primary}06` }]}
                      >
                        <MaterialCommunityIcons name={icon} size={15} color={sel ? primary : muted} />
                        <Text style={[styles.interestText, { color: sel ? primary : muted }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── EMAIL + PASSWORD (sign-in, and signup step 1) ── */}
            {(mode === 'signin' || signupStep === 1) && (
            <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: HM, marginBottom: 8 }}>
              <Text style={[styles.label, { color: textColor, marginHorizontal: 0, marginBottom: 0 }]}>Email</Text>
              {email.length > 0 && (
                <Feather
                  name={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "check-circle" : "alert-triangle"}
                  size={14}
                  color={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "#10b981" : "#ef4444"}
                />
              )}
            </View>
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

            {/* Quick Email Suggestions */}
            {email.length > 0 && !email.includes('@') && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: HM, marginBottom: 16 }}>
                {['@gmail.com', '@yahoo.com', '@outlook.com', '@icloud.com'].map(domain => (
                  <TouchableOpacity
                    key={domain}
                    onPress={() => setEmail(email.trim() + domain)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: `${primary}15`, borderWidth: 1, borderColor: `${primary}30` }}
                  >
                    <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>{domain}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: HM, marginBottom: 8 }}>
              <Text style={[styles.label, { color: textColor, marginHorizontal: 0, marginBottom: 0 }]}>Password</Text>
              {password.length > 0 && (
                <Feather
                  name={password.length >= 6 ? "check-circle" : "alert-triangle"}
                  size={14}
                  color={password.length >= 6 ? "#10b981" : "#ef4444"}
                />
              )}
            </View>
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

            {mode === 'signin' && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginRight: HM, marginTop: -8, marginBottom: 12 }}>
                <Text style={{ color: primary, fontSize: 12, fontWeight: '700' }}>Forgot password?</Text>
              </TouchableOpacity>
            )}
            </>
            )}

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

            {/* Email confirmation preference — signup step 2 only */}
            {mode === 'signup' && signupStep === 2 && (
              <>
                <View style={[styles.confirmBox, { borderColor: `${primary}25`, backgroundColor: `${primary}08` }]}>
                  <Feather name="mail" size={14} color={primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={[styles.confirmTitle, { color: textColor }]}>You're in straight away</Text>
                    <Text style={[styles.confirmSub, { color: muted }]}>
                      Start using The Gruvs right now — you can verify your email later, no rush.
                    </Text>
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
                    Email me about new events and updates.
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: primary }, (loading || checkingName) && styles.disabled]}
              onPress={mode === 'signin' ? handleSignIn : signupStep === 1 ? handleContinue : handleSignUp}
              disabled={loading || checkingName}
            >
              {(loading || checkingName)
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.actionText}>
                    {mode === 'signin' ? 'SIGN IN' : signupStep === 1 ? 'CONTINUE →' : 'CREATE ACCOUNT'}
                  </Text>
              }
            </TouchableOpacity>

            {/* Step 2 is fully optional — one tap finishes either way */}
            {mode === 'signup' && signupStep === 2 && (
              <Text style={[styles.sublabel, { color: muted, textAlign: 'center', marginBottom: 12 }]}>
                Everything on this step is optional — tap CREATE ACCOUNT whenever you're ready.
              </Text>
            )}

            <TouchableOpacity onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
              <Text style={[styles.footerLink, { color: primary }]}>
                {mode === 'signin'
                  ? "New here? Create an account →"
                  : "Already have an account? Sign in →"}
              </Text>
            </TouchableOpacity>

            {/* Signup Success Confetti Burst */}
            <GlitterBurst trigger={signupSuccessFx} size={220} colors={[primary, '#fde047', '#ffffff', '#10b981', '#fca5a5']} />
          </View>
              </InnerWrap>
      </Scroller>
          </Wrap>
            );
          })()}

  {/* Birthday calendar — 18+ is a legal hard gate, so open the view at the
      most recent date that already qualifies. */}
  <CalendarPicker
    visible={dobPickerOpen}
    onClose={() => setDobPickerOpen(false)}
    value={birthDay && birthMonth && birthYear
      ? new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay))
      : new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())}
    onConfirm={(d) => {
      if (d instanceof Date) {
        setBirthDay(String(d.getDate()));
        setBirthMonth(String(d.getMonth() + 1));
        setBirthYear(String(d.getFullYear()));
      }
      setDobPickerOpen(false);
    }}
    dimPast={false}
    primary={primary}
    bg={bg}
    textColor={textColor}
    muted={muted}
  />
  </View>
</Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' },
  // justifyContent is flex-start (NOT center): the card centres itself with
  // marginVertical:'auto', which — unlike justify-content:center — never clips
  // the top when the form is taller than the screen. padding gives the gutter.
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center', padding: 20 },
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
  // The DD/MM/YYYY row owns the gutter so the fields inside can drop their own
  // horizontal margin — otherwise each field re-adds HM and they overflow narrow screens.
  dobRow: { flexDirection: 'row', gap: 8, marginHorizontal: HM },
  dobField: { marginHorizontal: 0, textAlign: 'center' },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: HM, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  passwordInput: { flex: 1, fontSize: 14 },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: HM, marginBottom: 16 },
  genderBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  genderText: { fontSize: 12, fontWeight: '700' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: HM, marginBottom: 18 },
  interestPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  interestText: { fontSize: 12, fontWeight: '700' },
  errorBox: { marginHorizontal: HM, marginBottom: 15, backgroundColor: 'rgba(255,60,60,0.12)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,60,60,0.3)' },
  errorText: { color: "#ff6b6b", fontSize: 12, fontWeight: '600' },
  successBox: { marginHorizontal: HM, marginBottom: 15, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  successText: { color: "#10b981", fontSize: 12, fontWeight: '600' },
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
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: HM, marginBottom: 16 },
  stepDot: { width: 18, height: 5, borderRadius: 3 },
  stepDotActive: { width: 28 },
  stepText: { fontSize: 11, fontWeight: '700', marginLeft: 6 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: HM, marginBottom: 14 },
});
