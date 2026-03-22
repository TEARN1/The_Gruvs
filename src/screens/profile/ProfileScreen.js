import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView,
  Modal, TextInput, Platform, Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useStore } from '../../state/useStore';
import { ACCENT, THEME, GOLD } from '../../theme';
import VoiceRecorder from '../../components/VoiceRecorder';

// ─── Mock event lists ─────────────────────────────────────────────────────────
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
    user, setUser, savedPosts, likedPosts, rsvpState, handleFollow, followedUsers, posts
  } = useStore();

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

  const TABS = ['Saved', 'Liked', 'Going', 'Interested', 'Commented'];

  const mappedEvents = {
    Saved: posts.filter(p => savedPosts.includes(p.id)),
    Liked: posts.filter(p => p.engagement_metrics?.liked_by?.includes(user?.id || 'anon')),
    Going: posts.filter(p => rsvpState[p.id] === 'going'),
    Interested: posts.filter(p => rsvpState[p.id] === 'interested'),
    Commented: posts.filter(p => p.engagement_metrics?.comments?.some(c => c.author === (user?.name || 'anon'))),
  };

  // Simulate a proximity alert for any "going" or "interested" events within 1km
  const checkProximity = () => {
    const goingEvents = mappedEvents['Going'];
    if (goingEvents.length > 0) {
      setSelectedEvent(goingEvents[0]);
      setShowProximityAlert(true);
    } else if (MOCK_EVENTS['Going'].length > 0) {
      // Fallback to mock for demonstration
      setSelectedEvent(MOCK_EVENTS['Going'][0]);
      setShowProximityAlert(true);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>You are not logged in.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Landing')}>
          <Text style={styles.primaryBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Private Profile View ──────────────────────────────────────────────────
  if (isPrivate && profileType === 'private') {
    return (
      <View style={styles.container}>
        <View style={styles.privateCard}>
          <Ionicons name="lock-closed" size={40} color={ACCENT} />
          <Text style={styles.privateTitle}>Private Profile</Text>
          <Text style={styles.privateSubtitle}>This member moves unseen.</Text>
          <TouchableOpacity style={styles.smallBtn} onPress={() => setIsPrivate(false)}>
            <Text style={styles.smallBtnText}>Go Public</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Business Profile View ─────────────────────────────────────────────────
  if (profileType === 'business') {
    return (
      <ScrollView style={[styles.container, { backgroundColor: THEME.bg }]}>
        <View style={styles.bizBanner}>
          <View style={styles.bizLogoArea}>
            <Text style={styles.bizInitial}>{user.name[0]}</Text>
            <View style={styles.bizBadge}><Text style={styles.bizBadgeText}>BUSINESS</Text></View>
          </View>
          <Text style={styles.bizName}>{user.name}</Text>
          <Text style={styles.biz_tagline}>{user.bio || 'Your tagline goes here'}</Text>
          <View style={styles.biz_statsRow}>
            {[{ n: '4.9', l: 'Rating' }, { n: '342', l: 'Reviews' }, { n: '12', l: 'Services' }].map(s => (
              <View key={s.l} style={styles.biz_stat}>
                <Text style={styles.biz_statVal}>{s.n}</Text>
                <Text style={styles.biz_statLabel}>{s.l}</Text>
              </View>
            ))}
          </View>
        </View>
        {['Services', 'Events', 'About'].map(section => (
          <View key={section} style={styles.bizSection}>
            <Text style={styles.bizSectionTitle}>{section}</Text>
            <Text style={styles.bizSectionContent}>{section} details appear here. Add your {section.toLowerCase()} to wow your audience.</Text>
          </View>
        ))}
        <View style={styles.biz_cta}>
          <TouchableOpacity style={styles.primaryBtn}>
            <Feather name="phone-call" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Request Quote</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Ionicons name="share-social-outline" size={16} color={ACCENT} />
            <Text style={styles.secondaryBtnText}>Share Profile</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.switchProfileBtn} onPress={() => setProfileType('normal')}>
          <Text style={styles.switchProfileText}>Switch to Normal Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Normal Profile View ───────────────────────────────────────────────────
  return (
    <ScrollView style={[styles.container, { backgroundColor: THEME.bg }]} contentContainerStyle={{ paddingBottom: 80 }}>

      {/* Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{user.name[0]}</Text>
          </View>
          {profileType !== 'normal' && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{profileType.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {editMode ? (
          <View style={styles.editForm}>
            <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor="#55608a" />
            <TextInput style={[styles.editInput, { height: 80 }]} value={editBio} onChangeText={setEditBio} placeholder="Your bio" placeholderTextColor="#55608a" multiline />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { setUser({ ...user, name: editName, bio: editBio }); setEditMode(false); }}>
              <Text style={styles.primaryBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.profileName}>{user.name}</Text>
            {user.bio ? <Text style={styles.profileBio}>{user.bio}</Text> : null}
          </>
        )}
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(!editMode)}>
          <Feather name={editMode ? 'check' : 'edit-2'} size={14} color={ACCENT} />
          <Text style={styles.editBtnText}>{editMode ? 'Cancel' : 'Edit Profile'}</Text>
        </TouchableOpacity>
        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statVal}>{followedUsers.length}</Text><Text style={styles.statLabel}>Following</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statVal}>128</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statVal}>42</Text><Text style={styles.statLabel}>Events</Text></View>
        </View>
        <View style={styles.profileActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={checkProximity}>
            <Ionicons name="map" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Near Me Alert</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Ionicons name="share-social-outline" size={16} color={ACCENT} />
            <Text style={styles.secondaryBtnText}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Voice Recorder Button */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Voice Bio</Text>
        <TouchableOpacity style={styles.micBtn} onPress={() => setShowVoice(!showVoice)}>
          <Ionicons name="mic" size={20} color="#fff" />
          <Text style={styles.micBtnText}>{showVoice ? 'Close Recorder' : 'Record Voice Bio'}</Text>
        </TouchableOpacity>
        {showVoice && (
          <VoiceRecorder
            onSend={(uri) => { Alert.alert('Voice Bio', 'Voice note saved!'); setShowVoice(false); }}
            onCancel={() => setShowVoice(false)}
          />
        )}
      </View>

      {/* Profile Type Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Type</Text>
        {PROFILE_TYPES.map(pt => (
          <TouchableOpacity
            key={pt.id}
            style={[styles.profileTypeRow, profileType === pt.id && styles.profileTypeRowActive]}
            onPress={() => setProfileType(pt.id)}>
            <View style={styles.profileTypeLeft}>
              <Ionicons name={pt.icon} size={24} color={profileType === pt.id ? ACCENT : '#94a3b8'} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.profileTypeLabel, profileType === pt.id && { color: ACCENT }]}>{pt.label}</Text>
                  {!pt.free && <View style={styles.paidTag}><Text style={styles.paidTagText}>{pt.price}</Text></View>}
                </View>
                <Text style={styles.profileTypeDesc}>{pt.desc}</Text>
              </View>
            </View>
            {profileType === pt.id && <Ionicons name="checkmark-circle" size={20} color={ACCENT} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Event History Tabs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Events</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {TABS.map(t => (
            <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {(mappedEvents[activeTab] || []).length === 0 ? (
          <Text style={styles.emptyMsg}>No {activeTab.toLowerCase()} events yet.</Text>
        ) : (
          mappedEvents[activeTab].map(ev => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={styles.eventRowCategory}><Text style={styles.eventRowCategoryText}>{ev.content?.category || 'General'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventRowTitle}>{ev.content?.title || 'Unknown Event'}</Text>
                <Text style={styles.eventRowLocation}>{ev.content?.location || 'TBA'}</Text>
              </View>
              <View style={styles.eventRowCountdown}>
                <Text style={[styles.eventRowDays, { color: ACCENT }]}>{'>>'}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Private Account</Text>
            <Text style={styles.settingDesc}>Only approved users see you</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: '#1a1a3e', true: ACCENT }} thumbColor="#fff" />
        </View>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Ghost Mode</Text>
            <Text style={styles.settingDesc}>Hide from the global map</Text>
          </View>
          <Switch value={ghostMode} onValueChange={setGhostMode} trackColor={{ false: '#1a1a3e', true: ACCENT }} thumbColor="#fff" />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => { setUser(null); navigation.navigate('Landing'); }}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Proximity Alert Modal */}
      <Modal visible={showProximityAlert} transparent animationType="fade" onRequestClose={() => setShowProximityAlert(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowProximityAlert(false)} />
        <View style={styles.alertCard}>
          <View style={styles.alertIconRow}>
            <View style={styles.alertIconBox}>
              <Ionicons name="map" size={28} color={ACCENT} />
            </View>
          </View>
          <Text style={styles.alertTitle}>Event Near You! 📍</Text>
          {selectedEvent && (
            <>
              <Text style={styles.alertEventName}>{selectedEvent.content?.title || selectedEvent.title}</Text>
              <Text style={styles.alertEventLocation}>{selectedEvent.content?.location || selectedEvent.location}</Text>
              <View style={styles.countdownRow}>
                <MaterialCommunityIcons name="timer-outline" size={16} color={ACCENT} />
                <Text style={[styles.countdownText, { color: (selectedEvent.daysLeft || 0) <= 2 ? '#ef4444' : ACCENT }]}>
                  {selectedEvent.daysLeft || 1} day{(selectedEvent.daysLeft || 1) !== 1 ? 's' : ''} left
                </Text>
              </View>
            </>
          )}
          <Text style={styles.alertQuestion}>You said you're going. Do you want to head there now?</Text>
          <View style={styles.alertActions}>
            <TouchableOpacity style={styles.alertYes} onPress={() => setShowProximityAlert(false)}>
              <Text style={styles.alertYesText}>Yes, Let's Go!</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.alertNo} onPress={() => setShowProximityAlert(false)}>
              <Text style={styles.alertNoText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, backgroundColor: THEME.bg, justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { color: '#fff', fontSize: 18, marginBottom: 20, textAlign: 'center' },

  // Profile Header
  profileHeader: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 50 : 70, paddingBottom: 24, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1e1e3f', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: ACCENT },
  avatarInitial: { color: '#fff', fontSize: 32, fontWeight: '800' },
  typeBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { color: '#000', fontSize: 9, fontWeight: '900' },
  profileName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  profileBio: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 8, paddingHorizontal: 20 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,77,166,0.1)', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 14, marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,77,166,0.3)' },
  editBtnText: { color: ACCENT, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginVertical: 20 },
  statItem: { alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#55608a', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#1a1a3e' },
  profileActions: { flexDirection: 'row', gap: 12, marginTop: 6, width: '100%' },
  editForm: { width: '100%', gap: 8, marginTop: 8 },
  editInput: { backgroundColor: '#0d0d25', color: '#fff', borderRadius: 14, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#1e1e3f' },

  // Buttons
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 16, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,77,166,0.1)', paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,77,166,0.3)' },
  secondaryBtnText: { color: ACCENT, fontWeight: '800', fontSize: 14 },
  smallBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, marginTop: 10 },
  smallBtnText: { color: '#fff', fontWeight: '700' },

  // Private Profile
  privateCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  privateTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  privateSubtitle: { color: '#55608a', fontSize: 14 },

  // Business Profile
  bizBanner: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 50 : 70, paddingBottom: 24, paddingHorizontal: 24, backgroundColor: '#050514', borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  bizLogoArea: { position: 'relative', width: 90, height: 90, borderRadius: 24, backgroundColor: '#1e1e3f', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  bizInitial: { color: '#fff', fontSize: 34, fontWeight: '900' },
  bizBadge: { position: 'absolute', bottom: -6, right: -6, backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  bizBadgeText: { color: '#000', fontSize: 9, fontWeight: '900' },
  bizName: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 4 },
  biz_tagline: { color: '#55608a', fontSize: 14, marginBottom: 16 },
  biz_statsRow: { flexDirection: 'row', gap: 24 },
  biz_stat: { alignItems: 'center' },
  biz_statVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  biz_statLabel: { color: '#55608a', fontSize: 12 },
  bizSection: { backgroundColor: '#0a0a1e', margin: 16, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1a1a3e' },
  bizSectionTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  bizSectionContent: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
  biz_cta: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 12 },
  switchProfileBtn: { alignItems: 'center', padding: 20 },
  switchProfileText: { color: '#55608a', fontWeight: '700' },

  // Sections
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 14 },

  // Voice
  micBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: ACCENT, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 18, justifyContent: 'center', shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 10 },
  micBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Profile Type Selector
  profileTypeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a0a1e', padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: '#1a1a3e' },
  profileTypeRowActive: { borderColor: ACCENT, backgroundColor: 'rgba(255,77,166,0.05)' },
  profileTypeLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  profileTypeLabel: { color: '#94a3b8', fontSize: 15, fontWeight: '700' },
  profileTypeDesc: { color: '#55608a', fontSize: 12, marginTop: 2, flexShrink: 1 },
  paidTag: { backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  paidTagText: { color: '#000', fontSize: 10, fontWeight: '800' },

  // Event History
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#1e1e3f', marginRight: 8 },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  emptyMsg: { color: '#55608a', fontSize: 14, textAlign: 'center', padding: 20 },
  eventRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a1e', borderRadius: 16, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: '#1a1a3e' },
  eventRowCategory: { backgroundColor: 'rgba(255,77,166,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  eventRowCategoryText: { color: ACCENT, fontSize: 10, fontWeight: '700' },
  eventRowTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  eventRowLocation: { color: '#55608a', fontSize: 12, marginTop: 2 },
  eventRowCountdown: { alignItems: 'center', marginLeft: 6 },
  eventRowDays: { fontSize: 18, fontWeight: '900' },
  eventRowDaysLabel: { color: '#55608a', fontSize: 10 },

  // Settings
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a1e', padding: 20, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a3e' },
  settingLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  settingDesc: { color: '#55608a', fontSize: 12 },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 16, padding: 18, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.07)' },
  signOutText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },

  // Proximity Alert
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  alertCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0a0a1e', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, borderWidth: 1, borderColor: '#1a1a3e' },
  alertIconRow: { alignItems: 'center', marginBottom: 16 },
  alertIconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,77,166,0.15)', justifyContent: 'center', alignItems: 'center' },
  alertTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  alertEventName: { color: ACCENT, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  alertEventLocation: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, backgroundColor: 'rgba(255,77,166,0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14, alignSelf: 'center' },
  countdownText: { fontSize: 16, fontWeight: '800' },
  alertQuestion: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 22 },
  alertActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  alertYes: { flex: 1, backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  alertYesText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  alertNo: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  alertNoText: { color: '#94a3b8', fontWeight: '700', fontSize: 15 },
});
