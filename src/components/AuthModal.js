import React, { useState, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, Animated, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';

export const AuthModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';

  const switchMode = (newMode) => {
    Animated.timing(slideAnim, {
      toValue: newMode === 'signin' ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setMode(newMode));
    setError('');
    setSuccess('');
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      onClose();
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !username.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
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
    } else {
      // Insert profile row
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: username.trim(),
          vibe_score: 0,
        });
      }
      setSuccess('Check your email to confirm your account!');
    }
  };

  const reset = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setError('');
    setSuccess('');
    setMode('signin');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: bg, borderColor: `${primary}33` }]}>

            {/* Glow top accent */}
            <View style={[styles.glowBar, { backgroundColor: primary }]} />

            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: primary }]}>
                {mode === 'signin' ? '👑 ROYAL ACCESS' : '⚡ JOIN THE ROYALTY'}
              </Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Tab switcher */}
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

            {/* Fields */}
            {mode === 'signup' && (
              <View>
                <Text style={[styles.label, { color: textColor }]}>Royal Name</Text>
                <TextInput
                  style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
                  placeholder="Your username..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
            )}

            <Text style={[styles.label, { color: textColor }]}>Email</Text>
            <TextInput
              style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
              placeholder="your@email.com"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.label, { color: textColor }]}>Password</Text>
            <TextInput
              style={[styles.input, { borderColor: `${primary}40`, color: textColor }]}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {/* Error / success */}
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

            {/* Action button */}
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

            {/* Footer link */}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 30,
  },
  glowBar: {
    height: 4,
    width: '100%',
    opacity: 0.9,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    fontSize: 20,
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 25,
    borderWidth: 1,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 25,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginHorizontal: 25,
    opacity: 0.75,
  },
  input: {
    marginHorizontal: 25,
    marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
  },
  errorBox: {
    marginHorizontal: 25,
    marginBottom: 15,
    backgroundColor: 'rgba(255,60,60,0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,60,60,0.3)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '600',
  },
  successBox: {
    marginHorizontal: 25,
    marginBottom: 15,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  successText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    marginHorizontal: 25,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 5,
  },
  actionText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  disabled: {
    opacity: 0.7,
  },
  footerLink: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 25,
  },
});
