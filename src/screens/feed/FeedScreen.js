import React, { useEffect, useState } from 'react';
import {
  View, FlatList, RefreshControl, StyleSheet, TextInput, Text, TouchableOpacity,
  ScrollView, Modal, Platform, useWindowDimensions, KeyboardAvoidingView, ActivityIndicator, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { useStore } from '../../state/useStore';
import { ACCENT, THEME, GOLD } from '../../theme';
import { CATEGORY_GROUPS } from '../../data';
import PostCard from '../../components/PostCard';
import TheHappenings from '../../components/TheHappenings';
import GruvsLogo from '../../components/GruvsLogo';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function FeedScreen({ navigation }) {
  const {
    posts, loading, error, fetchPosts, searchQuery, setSearchQuery,
    activeCategory, setActiveCategory, user, notifVisible, setNotifVisible,
    notifications, markNotifsRead, setPosts, addEventModalVisible, setAddEventModalVisible
  } = useStore();

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [nearbyModalVisible, setNearbyModalVisible] = useState(false);
  const [nearbyPeople, setNearbyPeople] = useState([]);
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [happeningDetailVisible, setHappeningDetailVisible] = useState(false);
  const [selectedHappening, setSelectedHappening] = useState(null);

  // Add Event Form State
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventImage, setNewEventImage] = useState(null);
  const [newEventVideo, setNewEventVideo] = useState(null);
  const [newEventCategory, setNewEventCategory] = useState('All');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventGuests, setNewEventGuests] = useState('');

  const { width } = useWindowDimensions();
  const isPC = Platform.OS === 'web' && width > 768;

  const unreadNotifs = (notifications || []).filter(n => !n.read).length;

  useEffect(() => {
    fetchPosts();
  }, [searchQuery, activeCategory]);

  const getGPSLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      fetchPosts(loc.coords);
      setNearbyPeople([
        { id: 'n1', name: 'Zolani', distance: '300m', interests: ['Amapiano', 'Tech'], avatar: 'Z', ring: '#10b981' },
        { id: 'n2', name: 'Sarah', distance: '850m', interests: ['Yoga', 'Faith'], avatar: 'S', ring: ACCENT },
        { id: 'n3', name: 'Kgomotso', distance: '1.2km', interests: ['Soccer'], avatar: 'K', ring: GOLD },
        { id: 'n4', name: 'Mpho', distance: '450m', interests: ['Music', 'Arts'], avatar: 'M', ring: '#8b5cf6' },
      ]);
      setNearbyEvents([
        { id: 'e1', title: 'Shisanyama Sunday', location: 'Zone 4', distance: '600m', daysLeft: 2 },
        { id: 'e2', title: 'Amapiano Vibes', location: 'Ivory Park', distance: '900m', daysLeft: 5 },
      ]);
      setNearbyModalVisible(true);
    } catch (e) {
      setNearbyPeople([
        { id: 'n1', name: 'Zolani', distance: '300m', avatar: 'Z', ring: '#10b981' },
        { id: 'n2', name: 'Sarah', distance: '850m', avatar: 'S', ring: ACCENT },
      ]);
      setNearbyEvents([
        { id: 'e1', title: 'Shisanyama Sunday', location: 'Zone 4', distance: '600m', daysLeft: 2 },
      ]);
      setNearbyModalVisible(true);
    }
  };

  const pickMedia = async (type) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled) {
        if (type === 'video') setNewEventVideo(result.assets[0]);
        else setNewEventImage(result.assets[0]);
      }
    } catch {}
  };

  const handleCreateEvent = () => {
    if (!newEventTitle.trim()) return;
    const newPost = {
      id: Date.now().toString(),
      is_paid: false,
      content: {
        title: newEventTitle,
        author_name: user?.name || 'Anonymous',
        text: newEventDescription,
        category: newEventCategory,
        location: newEventLocation,
        dateTime: newEventStart || 'Just now',
        guestLimit: newEventGuests || 'Unlimited',
        slides: newEventImage ? [{ type: 'image', url: newEventImage.uri }]
                  : newEventVideo ? [{ type: 'video', url: newEventVideo.uri }] : [],
      },
      engagement_metrics: { liked_by: [], comments: [], rsvps: {} }
    };
    setPosts(prev => [newPost, ...(prev || [])]);
    setAddEventModalVisible(false);
    setNewEventTitle(''); setNewEventDescription(''); setNewEventLocation('');
    setNewEventStart(''); setNewEventGuests('');
    setNewEventImage(null); setNewEventVideo(null);
    try { fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newEventTitle }) }); } catch {}
  };

  const openHappeningDetail = (item) => {
    setSelectedHappening(item);
    setHappeningDetailVisible(true);
  };

  // ─── Shared Modals ────────────────────────────────────────────────────────────
  function renderModals() {
    return (
      <>
        {/* Categories Modal */}
        <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Browse Categories</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <TouchableOpacity
                style={[styles.allEventsRow, activeCategory === 'All' && styles.allEventsRowActive]}
                onPress={() => { setActiveCategory('All'); setFilterModalVisible(false); }}>
                <MaterialCommunityIcons name="apps" size={20} color={activeCategory === 'All' ? '#fff' : '#94a3b8'} />
                <Text style={[styles.allEventsLabel, activeCategory === 'All' && { color: '#fff' }]}>All Events</Text>
              </TouchableOpacity>
              {Object.entries(CATEGORY_GROUPS).map(([group, cats]) => (
                <View key={group} style={styles.catGroup}>
                  <Text style={styles.catGroupHeader}>{group}</Text>
                  <View style={styles.catChipRow}>
                    {cats.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
                        onPress={() => { setActiveCategory(cat); setFilterModalVisible(false); }}>
                        <Text style={[styles.catChipText, activeCategory === cat && { color: '#fff' }]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Notifications Modal */}
        <Modal visible={notifVisible} transparent animationType="slide" onRequestClose={() => setNotifVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNotifVisible(false)} />
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setNotifVisible(false)}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <View style={styles.sheetHandle} />
            <View style={styles.notifHeader}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              {unreadNotifs > 0 && (
                <TouchableOpacity onPress={markNotifsRead}>
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {(notifications || []).map(n => (
                <TouchableOpacity key={n.id} style={[styles.notifItem, !n.read && styles.notifItemUnread]}>
                  <View style={[styles.notifIconBox, { backgroundColor: n.type === 'like' ? '#ff4da622' : n.type === 'follow' ? '#10b98122' : '#3b82f622' }]}>
                    <Ionicons name={n.icon || 'notifications'} size={16} color={n.type === 'like' ? ACCENT : n.type === 'follow' ? '#10b981' : '#3b82f6'} />
                  </View>
                  <View style={styles.notifBody}>
                    <Text style={styles.notifText}><Text style={{ color: '#fff', fontWeight: '700' }}>{n.actor}</Text> {n.text}</Text>
                    <Text style={styles.notifTime}>{n.time} ago</Text>
                  </View>
                  {!n.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Add Event Modal */}
        <Modal visible={addEventModalVisible} transparent animationType="slide" onRequestClose={() => setAddEventModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayFull}>
            <View style={[styles.sheet, { maxHeight: '95%', padding: 24 }]}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setAddEventModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Create Event</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.formLabel}>Event Name</Text>
                <TextInput style={styles.input} placeholder="e.g. Sunday Shisanyama" placeholderTextColor="#55608a" value={newEventTitle} onChangeText={setNewEventTitle} />
                <Text style={styles.formLabel}>Description</Text>
                <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="What's the vibe?" placeholderTextColor="#55608a" value={newEventDescription} onChangeText={setNewEventDescription} multiline />
                <Text style={styles.formLabel}>Location</Text>
                <TextInput style={styles.input} placeholder="Address or venue" placeholderTextColor="#55608a" value={newEventLocation} onChangeText={setNewEventLocation} />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Starting</Text>
                    <TextInput style={styles.input} placeholder="Date & Time" placeholderTextColor="#55608a" value={newEventStart} onChangeText={setNewEventStart} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Guest Limit</Text>
                    <TextInput style={styles.input} placeholder="e.g. 50" keyboardType="numeric" placeholderTextColor="#55608a" value={newEventGuests} onChangeText={setNewEventGuests} />
                  </View>
                </View>
                <Text style={styles.formLabel}>Media</Text>
                <View style={styles.mediaRow}>
                  <TouchableOpacity style={styles.mediaPicker} onPress={() => pickMedia('image')}>
                    <Ionicons name="image-outline" size={24} color="#55608a" />
                    <Text style={styles.mediaPickerText}>{newEventImage ? '✓ Photo' : 'Add Photo'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mediaPicker} onPress={() => pickMedia('video')}>
                    <Ionicons name="videocam-outline" size={24} color="#55608a" />
                    <Text style={styles.mediaPickerText}>{newEventVideo ? '✓ Video' : 'Add Video'}</Text>
                  </TouchableOpacity>
                </View>
                {newEventImage && <Image source={{ uri: newEventImage.uri }} style={styles.mediaPreview} />}
                <TouchableOpacity
                  style={[styles.publishBtn, !newEventTitle.trim() && { opacity: 0.5 }]}
                  onPress={handleCreateEvent}
                  disabled={!newEventTitle.trim()}>
                  <Text style={styles.publishBtnText}>🚀 Publish Event</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Near Me Modal */}
        <Modal visible={nearbyModalVisible} transparent animationType="slide" onRequestClose={() => setNearbyModalVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNearbyModalVisible(false)} />
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setNearbyModalVisible(false)}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Find Me · 1km Radius</Text>
            <Text style={styles.sheetSubtitle}>People who share your vibe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 16 }}>
              {nearbyPeople.map(p => (
                <TouchableOpacity
                  key={p.id} style={styles.nearbyCard}
                  onPress={() => { setNearbyModalVisible(false); navigation.navigate('OtherProfile', { userId: p.id }); }}>
                  <View style={[styles.nearbyAvatar, { borderColor: p.ring }]}>
                    <Text style={styles.nearbyAvatarText}>{p.avatar}</Text>
                    <View style={styles.onlineDot} />
                  </View>
                  <Text style={styles.nearbyName}>{p.name}</Text>
                  <Text style={styles.nearbyDist}>{p.distance}</Text>
                  <TouchableOpacity style={styles.waveBtn}><Text style={styles.waveBtnText}>👋 Wave</Text></TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.sheetSubtitle, { marginTop: 0 }]}>Events Nearby</Text>
            {nearbyEvents.map(e => (
              <View key={e.id} style={styles.nearbyEventRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{e.title}</Text>
                  <Text style={{ color: '#55608a', fontSize: 12, marginTop: 2 }}>{e.location} · {e.distance}</Text>
                </View>
                <View style={styles.countdownBadge}>
                  <Text style={[styles.countdownNum, { color: e.daysLeft <= 2 ? '#ef4444' : ACCENT }]}>{e.daysLeft}d</Text>
                  <Text style={styles.countdownLabel}>left</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.inviteBtn}>
              <Ionicons name="share-social-outline" size={18} color="#3b82f6" />
              <Text style={styles.inviteBtnText}>Invite someone to join</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Happening Detail Pop-up */}
        <Modal visible={happeningDetailVisible} transparent animationType="fade" onRequestClose={() => setHappeningDetailVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setHappeningDetailVisible(false)} />
          {selectedHappening && (
            <View style={[styles.sheet, { paddingBottom: 30 }]}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setHappeningDetailVisible(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{selectedHappening.content?.title || 'Event'}</Text>
              <Text style={styles.sheetSubtitle}>{selectedHappening.content?.location || ''}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                {[
                  { label: 'Going', icon: 'checkmark-circle-outline', color: '#10b981' },
                  { label: 'Interested', icon: 'star-outline', color: ACCENT },
                  { label: 'Skip', icon: 'close-circle-outline', color: '#55608a' },
                ].map(a => (
                  <TouchableOpacity key={a.label} style={[styles.actionBtn, { backgroundColor: a.color }]}>
                    <Ionicons name={a.icon} size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Modal>
      </>
    );
  }

  // ─── Header (shared between mobile + PC center) ────────────────────────────
  const FeedHeader = () => (
    <View style={styles.topHeader}>
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput} placeholder="Search events, vibes, people..."
          placeholderTextColor="#55608a" value={searchQuery} onChangeText={setSearchQuery}
          onSubmitEditing={() => fetchPosts()} returnKeyType="search"
        />
        <TouchableOpacity onPress={() => setNotifVisible(true)} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={20} color={unreadNotifs > 0 ? ACCENT : '#94a3b8'} />
          {unreadNotifs > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifs}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.iconBtn}>
          <MaterialCommunityIcons name="tune-variant" size={20} color={ACCENT} />
        </TouchableOpacity>
      </View>
      {/* <TheHappenings onCardPress={openHappeningDetail} /> */}
      <View style={styles.quickBar}>
        <TouchableOpacity style={styles.nearMeBtn} onPress={getGPSLocation}>
          <Ionicons name="location" size={14} color={ACCENT} />
          <Text style={styles.nearMeText}>Near Me</Text>
        </TouchableOpacity>
        {activeCategory !== 'All' && (
          <View style={styles.activeCatPill}>
            <Text style={styles.activeCatPillText}>{activeCategory}</Text>
            <TouchableOpacity onPress={() => setActiveCategory('All')}>
              <Feather name="x" size={12} color={ACCENT} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  // ─── PC 3-Column Layout ────────────────────────────────────────────────────
  if (isPC) {
    return (
      <View style={[styles.pcLayout, { backgroundColor: THEME.bg }]}>
        <StatusBar style="light" />

        {/* LEFT NAV */}
        <View style={styles.leftNav}>
          <GruvsLogo size={48} style={{ marginBottom: 8 }} />
          {[
            { label: 'Pulse', icon: 'pulse', screen: 'Pulse', active: true },
            { label: 'Network', icon: 'briefcase-outline', screen: 'Network' },
            { label: 'Profile', icon: 'account-outline', screen: 'Profile' },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.navItem} onPress={() => navigation.navigate(item.screen)}>
              <MaterialCommunityIcons name={item.icon} size={26} color={item.active ? ACCENT : '#94a3b8'} />
              <Text style={[styles.navLabel, item.active && { color: ACCENT }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          {/* Big + button between Network and Profile */}
          <TouchableOpacity style={styles.navAdd} onPress={() => setAddEventModalVisible(true)}>
            <Feather name="plus" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* CENTER FEED */}
        <View style={{ flex: 1 }}>
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <PostCard item={item} navigation={navigation} />}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPosts} tintColor={ACCENT} />}
            contentContainerStyle={{ paddingBottom: 60 }}
            ListHeaderComponent={<FeedHeader />}
            ListEmptyComponent={() => {
              if (loading) {
                return (
                  <View style={styles.emptyBox}>
                    <ActivityIndicator size="large" color={ACCENT} style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyText}>Syncing with the gruvs...</Text>
                  </View>
                );
              }
              if (error) {
                return (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
                    <Text style={[styles.emptyText, { color: '#ef4444' }]}>{error}</Text>
                  </View>
                );
              }
              return (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="calendar-search" size={48} color="#2a2a4a" />
                  <Text style={styles.emptyText}>Nothing found for "{searchQuery || activeCategory}"</Text>
                </View>
              );
            }}
          />
        </View>

        {/* RIGHT SIDEBAR */}
        <View style={styles.rightPanel}>
          <TouchableOpacity style={styles.findMeBtn} onPress={getGPSLocation}>
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.findMeBtnText}>Find Me · 1km</Text>
          </TouchableOpacity>
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{user?.name?.[0] || 'U'}</Text>
              <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
            </View>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.settingRow}>
            <View><Text style={styles.settingTitle}>Ghost Mode</Text><Text style={styles.settingDesc}>Hide on the global map</Text></View>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => useStore.getState()?.setUser?.(null)}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {renderModals()}
      </View>
    );
  }

  // ─── Mobile Layout ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style="light" />
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PostCard item={item} navigation={navigation} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPosts} tintColor={ACCENT} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={<FeedHeader />}
        ListEmptyComponent={() => {
          if (loading) {
            return (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="large" color={ACCENT} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>Syncing with the gruvs...</Text>
              </View>
            );
          }
          if (error) {
            return (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
                <Text style={[styles.emptyText, { color: '#ef4444' }]}>{error}</Text>
              </View>
            );
          }
          return (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="calendar-search" size={48} color="#2a2a4a" />
              <Text style={styles.emptyText}>Nothing found for "{searchQuery || activeCategory}"</Text>
            </View>
          );
        }}
      />
      {renderModals()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pcLayout: { flex: 1, flexDirection: 'row' },

  // ─── Header ───
  topHeader: { paddingTop: Platform.OS === 'web' ? 20 : 52, paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d25', borderRadius: 20, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#1e1e3f', marginBottom: 14 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, height: '100%' },
  iconBtn: { padding: 8, position: 'relative' },
  badge: { position: 'absolute', top: 2, right: 2, width: 15, height: 15, borderRadius: 8, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  quickBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  nearMeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,77,166,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, gap: 5 },
  nearMeText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  activeCatPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  activeCatPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#55608a', fontSize: 14 },

  // ─── FAB ───
  fab: { position: 'absolute', bottom: 88, right: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.7, shadowRadius: 14, elevation: 14 },

  // ─── PC Left Nav ───
  leftNav: { width: 90, backgroundColor: '#050514', borderRightWidth: 1, borderRightColor: '#1a1a3e', paddingTop: 40, paddingBottom: 26, alignItems: 'center', gap: 24 },
  logo: { color: ACCENT, fontSize: 34, fontWeight: '900', marginBottom: 10 },
  navItem: { alignItems: 'center', gap: 5 },
  navLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  navAdd: { width: 52, height: 52, borderRadius: 16, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10, marginVertical: 4 },

  // ─── PC Right Panel ───
  rightPanel: { width: 300, backgroundColor: '#050514', borderLeftWidth: 1, borderLeftColor: '#1a1a3e', padding: 24, gap: 18 },
  findMeBtn: { backgroundColor: ACCENT, padding: 18, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 12 },
  findMeBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  userCard: { alignItems: 'center', paddingVertical: 20 },
  userAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2a2a4a', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  userAvatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  proBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: GOLD, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  proBadgeText: { color: '#000', fontSize: 9, fontWeight: '900' },
  userName: { color: '#fff', fontSize: 17, fontWeight: '800' },
  settingRow: { backgroundColor: '#0a0a1e', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1a1a3e' },
  settingTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  settingDesc: { color: '#55608a', fontSize: 12 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.06)', marginTop: 10 },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },

  // ─── Shared Modal Styles ───
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalOverlayFull: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { backgroundColor: '#0a0a1e', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '88%', borderWidth: 1, borderColor: '#1a1a3e' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#2a2a4a', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 4 },
  sheetSubtitle: { color: '#55608a', fontSize: 13, marginBottom: 14 },
  closeBtn: { position: 'absolute', top: 18, right: 18, zIndex: 10, padding: 8 },

  // Categories
  allEventsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, marginBottom: 8 },
  allEventsRowActive: { backgroundColor: ACCENT },
  allEventsLabel: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  catGroup: { marginBottom: 16 },
  catGroupHeader: { color: '#55608a', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  catChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: '#1e1e3f' },
  catChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  catChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

  // Notifications
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  markReadText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  notifItemUnread: { backgroundColor: 'rgba(255,77,166,0.05)', paddingHorizontal: 8, borderRadius: 14 },
  notifIconBox: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  notifBody: { flex: 1 },
  notifText: { color: '#94a3b8', fontSize: 14, lineHeight: 20 },
  notifTime: { color: '#2a2a4a', fontSize: 11, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },

  // Add Event
  formLabel: { color: '#55608a', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: '#0d0d25', color: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 15, borderWidth: 1, borderColor: '#1e1e3f' },
  mediaRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  mediaPicker: { flex: 1, height: 80, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#2a2a4a', gap: 6 },
  mediaPickerText: { color: '#55608a', fontSize: 12 },
  mediaPreview: { width: '100%', height: 160, borderRadius: 14, marginBottom: 16 },
  publishBtn: { backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 8 },
  publishBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Near Me
  nearbyCard: { backgroundColor: '#0d0d25', padding: 16, borderRadius: 20, alignItems: 'center', marginRight: 14, width: 130, borderWidth: 1, borderColor: '#1e1e3f' },
  nearbyAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2a4a', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, position: 'relative' },
  nearbyAvatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  onlineDot: { position: 'absolute', top: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#0d0d25' },
  nearbyName: { color: '#fff', fontWeight: '700', fontSize: 13 },
  nearbyDist: { color: ACCENT, fontSize: 11, fontWeight: '700', marginVertical: 3 },
  waveBtn: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  waveBtnText: { color: '#fff', fontSize: 11 },
  nearbyEventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d0d25', borderRadius: 14, padding: 14, marginBottom: 10 },
  countdownBadge: { alignItems: 'center', marginLeft: 12 },
  countdownNum: { fontSize: 20, fontWeight: '900' },
  countdownLabel: { color: '#55608a', fontSize: 10 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16, backgroundColor: 'rgba(59,130,246,0.07)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginTop: 8 },
  inviteBtnText: { color: '#3b82f6', fontWeight: '700' },

  // Happening Detail Actions
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
