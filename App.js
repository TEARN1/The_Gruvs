import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [authForm, setAuthForm] = useState({ username: '', password: '', gender: 'male' });

  const theme = user?.gender === 'female' ? femaleTheme : (user?.gender === 'male' ? maleTheme : dayTheme);

  useEffect(() => { if(screen === 'feed') fetchPosts(); }, [screen]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleAuth = () => {
    setUser({ id: 'user_01', name: authForm.username || 'Alex', gender: authForm.gender });
    setScreen('feed');
  };

  if (screen === 'auth') {
    const isSignup = authMode === 'signup';
    return (
      <SafeAreaView style={styles.authWrapper}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView behavior="padding" style={styles.authCenter}>
          <View style={styles.glassCard}>
            <Text style={styles.authLogo}>THE GRUV</Text>
            <Text style={styles.authTagline}>{isSignup ? 'CREATE YOUR IDENTITY' : 'CONNECT TO THE ENGINE'}</Text>

            <TextInput
              style={styles.glassInput}
              placeholder="Username"
              placeholderTextColor="#888"
              onChangeText={t => setAuthForm({...authForm, username: t})}
            />
            <TextInput
              style={styles.glassInput}
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              onChangeText={t => setAuthForm({...authForm, password: t})}
            />

            {isSignup && (
              <View style={styles.genderRow}>
                <TouchableOpacity onPress={() => setAuthForm({...authForm, gender: 'male'})} style={[styles.genderBtn, authForm.gender === 'male' && styles.maleActive]}><Text style={styles.genderText}>MALE</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setAuthForm({...authForm, gender: 'female'})} style={[styles.genderBtn, authForm.gender === 'female' && styles.femaleActive]}><Text style={styles.genderText}>FEMALE</Text></TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.glowBtn} onPress={handleAuth}>
              <Text style={styles.glowBtnText}>{isSignup ? 'SIGN UP' : 'SIGN IN'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchBtn} onPress={() => setAuthMode(isSignup ? 'signin' : 'signup')}>
              <Text style={styles.switchText}>{isSignup ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : 'NEW TO THE ENGINE? SIGN UP'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.header}><Text style={[styles.logo, { color: '#ff4da6' }]}>THE GRUVS</Text></View>
      <FlatList
        data={posts}
        keyExtractor={item => item.id.toString()}
        renderItem={({item}) => (
          <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.eventTitle, {color: theme.text}]}>{item.content?.title}</Text>
            <Text style={styles.eventAuthor}>By {item.content?.author_name}</Text>
            <Text style={[styles.eventDescription, {color: theme.text}]}>{item.content?.text}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}><Text style={styles.fabIcon}>+</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const dayTheme = { background: '#f9fafb', card: '#fff', text: '#111', cardBorder: '#ddd' };
const maleTheme = { background: '#000', card: 'rgba(20,20,20,0.8)', text: '#fff', cardBorder: '#ff4da6' };
const femaleTheme = { background: '#1a000d', card: 'rgba(50,0,25,0.7)', text: '#fff', cardBorder: '#000' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  authWrapper: { flex: 1, backgroundColor: '#f0f2f5' },
  authCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
  glassCard: {
    width: '100%',
    padding: 35,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10
  },
  authLogo: { fontSize: 32, fontWeight: '900', color: '#ff4da6', textAlign: 'center', letterSpacing: 10 },
  authTagline: { fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 30, letterSpacing: 2 },
  glassInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  genderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  genderBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', marginHorizontal: 5 },
  maleActive: { backgroundColor: '#3b82f6' },
  femaleActive: { backgroundColor: '#ff4da6' },
  genderText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  glowBtn: {
    backgroundColor: '#ff4da6',
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#ff4da6',
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8
  },
  glowBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 2 },
  switchBtn: { marginTop: 25, alignItems: 'center' },
  switchText: { fontSize: 10, color: '#888', fontWeight: 'bold' },
  header: { height: 60, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 26, fontWeight: '900', letterSpacing: 8 },
  postCard: { margin: 15, padding: 20, borderRadius: 25, borderWidth: 1.5 },
  eventTitle: { fontSize: 22, fontWeight: 'bold' },
  eventAuthor: { color: '#ff4da6', fontSize: 12, marginBottom: 10 },
  eventDescription: { fontSize: 15 },
  fab: { position: 'absolute', bottom: 40, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff4da6', justifyContent: 'center', alignItems: 'center' },
  fabIcon: { color: '#fff', fontSize: 30 }
});
