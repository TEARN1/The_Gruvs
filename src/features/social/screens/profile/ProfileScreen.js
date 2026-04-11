import React, { useState, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView,
  Modal, TextInput, Platform, Alert, useWindowDimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useStore } from '../../../../core/state/useStore';
import { supabase } from '../../../../services/supabase';
import { THEME, DARK_THEME, ACCENT, GOLD, LIGHT_THEME } from '../../../../core/theme';
import VoiceRecorder from '../../../../shared/components/VoiceRecorder';

const MOCK_EVENTS = {
  Saved:      [{ id: 's1', title: 'Cape Town Gaming Expo', location: 'Century City', daysLeft: 3, category: 'Tech' }],
  Liked:      [{ id: 'l1', title: 'Joburg Jazz Night',    location: 'Braamfontein', daysLeft: 8, category: 'Arts' }],
  Going:      [{ id: 'g1', title: 'Top Shisanyama Sunday',location: 'Zone 4',        daysLeft: 2, category: 'Food' }],
  Interested: [{ id: 'i1', title: 'Amapiano Rooftop',    location: 'Cubana',        daysLeft: 5, category: 'Music' }],
  Commented:  [{ id: 'c1', title: 'Street Bash 011',     location: 'Ivory Park',    daysLeft: 1, category: 'Social' }],
};

const PROFILE_TYPES = [
  { id: 'normal',   label: 'Normal',        icon: 'person-circle-outline', free: true, desc: 'Standard public profile.' },
  { id: 'private',  label: 'Private',       icon: 'lock-closed-outline',   free: false, price: 'R300/mo', desc: 'Hidden from the public. Anonymous comments.' },
  { id: 'business', label: 'Business',      icon: 'briefcase-outline',     free: false, price: 'Custom',  desc: 'Website-style profile: services, offers, and ads.' },
];

export default function ProfileScreen({ navigation }) {
  const {
    user, setUser, savedPosts, likedPosts, rsvpState, followedUsers, posts,
    themeMode, setThemeMode
  } = useStore();

  const isDark = themeMode === 'dark';
  const currentTheme = isDark ? DARK_THEME : LIGHT_THEME;

  const { width } = useWindowDimensions();
  const isPC = Platform.OS === 'web' && width > 768;

  const [activeTab, setActiveTab] = useState('Saved');
  const [editMode, setEditMode] = useState(false);
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [ghostMode, setGhostMode] = useState(false);
  const [profileType, setProfileType] = useState(user?.profileType || 'normal');
  const [showVoice, setShowVoice] = useState(false);
  const [showProximityAlert, setShowProximityAlert] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editName, setEditName] = useState(user?.name || '');
  const [editBio, setEditBio] = useState(user?.bio || '');

  const [isPlayingBio, setIsPlayingBio] = useState(false);
  const waveAnim = useRef(new Animated.Value(0)).current;

  const TABS = ['Saved', 'Liked', 'Going', 'Interested', 'Commented'];

  const toggleBioPlayback = () => {
    if (isPlayingBio) {
      setIsPlayingBio(false);
      waveAnim.setValue(0);
    } else {
      setIsPlayingBio(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
        ])
      ).start();
      setTimeout(() => {
        setIsPlayingBio(false);
        waveAnim.setValue(0);
      }, 5000);
    }
  };

  const mappedEvents = {
    Saved: posts.filter(p => savedPosts.includes(p.id)),
    Liked: posts.filter(p => p.engagement_metrics?.liked_by?.includes(user?.id || 'anon')),
    Going: posts.filter(p => rsvpState[p.id] === 'going'),
    Interested: posts.filter(p => rsvpState[p.id] === 'interested'),
    Commented: posts.filter(p => p.engagement_metrics?.comments?.some(c => c.author === (user?.name || 'anon'))),
  };

  const checkProximity = () => {
    const goingEvents = mappedEvents['Going'];
    if (goingEvents.length > 0) {
      setSelectedEvent(goingEvents[0]);
      setShowProximityAlert(true);
    } else if (MOCK_EVENTS['Going'].length > 0) {
      setSelectedEvent(MOCK_EVENTS['Going'][0]);
      setShowProximityAlert(true);
    }
  };

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: currentTheme.bg }]}>
        <Text style={[styles.title, { color: currentTheme.text }]}>You are not logged in.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Landing')}>
          <Text style={styles.primaryBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.bg }]} contentContainerStyle={[{ paddingBottom: 80 }, isPC && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
      {/* Header */}
      <View style={[styles.profileHeader, { borderBottomColor: currentTheme.cardBorder }]}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarCircle, { backgroundColor: currentTheme.subtle, borderColor: ACCENT }]}>
            <Text style={[styles.avatarInitial, { color: currentTheme.text }]}>{user.name[0]}</Text>
          </View>
          {profileType !== 'normal' && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{profileType.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {editMode ? (
          <View style={styles.editForm}>
            <TextInput style={[styles.editInput, { backgroundColor: currentTheme.inputBg, color: currentTheme.text, borderColor: currentTheme.cardBorder }]} value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={currentTheme.textDim} />
            <TextInput style={[styles.editInput, { backgroundColor: currentTheme.inputBg, color: currentTheme.text, borderColor: currentTheme.cardBorder, height: 80 }]} value={editBio} onChangeText={setEditBio} placeholder="Your bio" placeholderTextColor={currentTheme.textDim} multiline />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { setUser({ ...user, name: editName, bio: editBio }); setEditMode(false); }}>
              <Text style={styles.primaryBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.profileName, { color: currentTheme.text }]}>{user.name}</Text>
            {user.bio ? <Text style={[styles.profileBio, { color: currentTheme.textDim }]}>{user.bio}</Text> : null}
          </>
        )}

        <TouchableOpacity style={[styles.editBtn, { backgroundColor: isDark ? 'rgba(255,77,166,0.1)' : 'rgba(255,77,166,0.05)' }]} onPress={() => setEditMode(!editMode)}>
          <Feather name={editMode ? 'check' : 'edit-2'} size={14} color={ACCENT} />
          <Text style={styles.editBtnText}>{editMode ? 'Cancel' : 'Edit Profile'}</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={[styles.statVal, { color: currentTheme.text }]}>{followedUsers.length}</Text><Text style={styles.statLabel}>Following</Text></View>
          <View style={[styles.statDivider, { backgroundColor: currentTheme.cardBorder }]} />
          <View style={styles.statItem}><Text style={[styles.statVal, { color: currentTheme.text }]}>128</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={[styles.statDivider, { backgroundColor: currentTheme.cardBorder }]} />
          <View style={styles.statItem}><Text style={[styles.statVal, { color: currentTheme.text }]}>42</Text><Text style={styles.statLabel}>Events</Text></View>
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={checkProximity}>
            <Ionicons name="map" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Near Me Alert</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: isDark ? 'rgba(255,77,166,0.1)' : 'rgba(255,77,166,0.05)' }]}>
            <Ionicons name="share-social-outline" size={16} color={ACCENT} />
            <Text style={styles.secondaryBtnText}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Voice Bio */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>My Voice Bio</Text>
        <View style={[styles.voiceBioCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.cardBorder }]}>
          <TouchableOpacity style={[styles.playBtn, isPlayingBio && { backgroundColor: ACCENT }]} onPress={toggleBioPlayback}>
            <Ionicons name={isPlayingBio ? "pause" : "play"} size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.waveWrap}>
            {[14, 28, 18, 32, 22, 38, 20, 26, 12, 30].map((h, i) => (
              <Animated.View 
                key={i} 
                style={[
                  styles.waveBar, 
                  { 
                    height: isPlayingBio ? waveAnim.interpolate({ inputRange: [0, 1], outputRange: [h * 0.4, h] }) : h * 0.4,
                    backgroundColor: isPlayingBio ? ACCENT : currentTheme.subtle
                  }
                ]} 
              />
            ))}
          </View>
          <TouchableOpacity style={styles.micCircle} onPress={() => setShowVoice(!showVoice)}>
            <Ionicons name="mic" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Settings</Text>

        <View style={[styles.settingRow, { backgroundColor: currentTheme.card, borderColor: currentTheme.cardBorder }]}>
          <View>
            <Text style={[styles.settingLabel, { color: currentTheme.text }]}>Dark Mode</Text>
            <Text style={[styles.settingDesc, { color: currentTheme.textDim }]}>Switch to the Midnight theme</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
            trackColor={{ false: '#cbd5e1', true: ACCENT }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.settingRow, { backgroundColor: currentTheme.card, borderColor: currentTheme.cardBorder }]}>
          <View>
            <Text style={[styles.settingLabel, { color: currentTheme.text }]}>Private Account</Text>
            <Text style={[styles.settingDesc, { color: currentTheme.textDim }]}>Only approved users see you</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: '#cbd5e1', true: ACCENT }} thumbColor="#fff" />
        </View>

        <View style={[styles.settingRow, { backgroundColor: currentTheme.card, borderColor: currentTheme.cardBorder }]}>
          <View>
            <Text style={[styles.settingLabel, { color: currentTheme.text }]}>Ghost Mode</Text>
            <Text style={[styles.settingDesc, { color: currentTheme.textDim }]}>Hide from the global map</Text>
          </View>
          <Switch value={ghostMode} onValueChange={setGhostMode} trackColor={{ false: '#cbd5e1', true: ACCENT }} thumbColor="#fff" />
        </View>
      </View>

      <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: 'rgba(239,68,68,0.07)' }]} onPress={() => { setUser(null); }}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 18, marginBottom: 20, textAlign: 'center' },

  profileHeader: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 50 : 70, paddingBottom: 24, paddingHorizontal: 24, borderBottomWidth: 1 },
  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  avatarInitial: { fontSize: 32, fontWeight: '800' },
  typeBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { color: '#000', fontSize: 9, fontWeight: '900' },
  profileName: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  profileBio: { fontSize: 14, textAlign: 'center', marginBottom: 8, paddingHorizontal: 20 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 14, marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,77,166,0.3)' },
  editBtnText: { color: ACCENT, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginVertical: 20 },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#64748B', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 24 },
  profileActions: { flexDirection: 'row', gap: 12, marginTop: 6, width: '100%' },
  editForm: { width: '100%', gap: 8, marginTop: 8 },
  editInput: { borderRadius: 14, padding: 14, fontSize: 15, borderWidth: 1 },

  primaryBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    backgroundColor: ACCENT, 
    paddingVertical: 14, 
    borderRadius: 16,
    ...Platform.select({
      web: { boxShadow: `0 8px 10px ${ACCENT}66` },
      default: { shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 }
    })
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,77,166,0.3)' },
  secondaryBtnText: { color: ACCENT, fontWeight: '800', fontSize: 14 },

  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14 },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 18, marginBottom: 12, borderWidth: 1 },
  settingLabel: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  settingDesc: { fontSize: 12 },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 16, padding: 18, borderRadius: 18 },
  signOutText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },

  voiceBioCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, padding: 16, gap: 16, borderWidth: 1 },
  playBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  waveWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, justifyContent: 'center' },
  waveBar: { width: 4, borderRadius: 2 },
  micCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
});
