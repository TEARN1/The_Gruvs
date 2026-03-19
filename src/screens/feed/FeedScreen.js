import React, { useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, TextInput, Text, TouchableOpacity, ScrollView, Modal, Platform, useWindowDimensions, KeyboardAvoidingView, ActivityIndicator, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { useStore } from '../../state/useStore';
import { ACCENT, THEME } from '../../theme';
import { CATEGORY_GROUPS } from '../../data';
import PostCard from '../../components/PostCard';
import TheHappenings from '../../components/TheHappenings';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function FeedScreen({ navigation }) {
  const { posts, loading, fetchPosts, searchQuery, setSearchQuery, activeCategory, setActiveCategory,
          user, stories, updateStoryViewed, notifVisible, setNotifVisible, notifications, markNotifsRead, setPosts } = useStore();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [addEventModalVisible, setAddEventModalVisible] = useState(false);
  
  // Add Event Form State
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventImage, setNewEventImage] = useState(null);
  const [newEventVideo, setNewEventVideo] = useState(null);
  const [newEventCategory, setNewEventCategory] = useState('All');
  
  const { width } = useWindowDimensions();
  const isPC = Platform.OS === 'web' && width > 768;

  const unreadNotifs = notifications.filter(n => !n.read).length;

  useEffect(() => {
    fetchPosts();
  }, [searchQuery, activeCategory]);

  const getGPSLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      fetchPosts(loc.coords);
    } catch {}
  };

  const pickMedia = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled) {
      if (type === 'video') setNewEventVideo(result.assets[0]);
      else setNewEventImage(result.assets[0]);
    }
  };

  const handleCreateEvent = () => {
    if (!newEventTitle.trim() || (!newEventImage && !newEventVideo)) return;
    const newPost = {
      id: Date.now().toString(),
      is_paid: false,
      content: {
        title: newEventTitle,
        author_name: user?.name || 'Anonymous',
        text: newEventDescription,
        category: newEventCategory,
        location: newEventLocation,
        dateTime: 'Just now',
        slides: newEventImage ? [{ type: 'image', url: newEventImage.uri }] : (newEventVideo ? [{ type: 'video', url: newEventVideo.uri }] : []),
      },
      engagement_metrics: { liked_by: [], comments: [], rsvps: {} }
    };
    
    setPosts(prev => [newPost, ...prev]);
    setAddEventModalVisible(false);
    setNewEventTitle(''); setNewEventDescription(''); setNewEventLocation(''); setNewEventImage(null); setNewEventVideo(null);

    const payload = { title: newEventTitle, text: newEventDescription, location: newEventLocation, category: newEventCategory, author_id: user?.id, slides: newPost.content.slides };
    try { fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch {}
  };

  return (
    <View style={[styles.dashboard, isPC && styles.dashboardPC, { backgroundColor: THEME.bg }]}>
      <StatusBar style="light" />

      {isPC && (
        <View style={styles.sideNav}>
          <Text style={styles.sideNavLogo}>G</Text>
          <TouchableOpacity style={styles.sideNavItem} onPress={() => navigation.navigate('Pulse')}>
            <MaterialCommunityIcons name="pulse" size={26} color={ACCENT} />
            <Text style={[styles.sideNavLabel, { color: ACCENT }]}>Pulse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideNavItem} onPress={() => navigation.navigate('Network')}>
            <MaterialCommunityIcons name="briefcase-outline" size={24} color={THEME.sub} />
            <Text style={styles.sideNavLabel}>Network</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideNavAddBtn} onPress={() => setAddEventModalVisible(true)}>
            <Feather name="plus" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideNavItem} onPress={() => navigation.navigate('Profile')}>
            <Feather name="user" size={24} color={THEME.sub} />
            <Text style={styles.sideNavLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mainArea}>
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <PostCard item={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPosts} tintColor={ACCENT} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <View style={styles.topHeader}>
              {/* Search */}
              <View style={styles.searchBox}>
                <Feather name="search" size={18} color={THEME.sub} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchBar} placeholder="Search events, vibes, people..." placeholderTextColor="#55608a"
                  value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => fetchPosts()} returnKeyType="search"
                />
                <TouchableOpacity onPress={() => setNotifVisible(true)} style={[styles.filterIconBtn, { marginRight: 4 }]}>
                  <Ionicons name="notifications-outline" size={20} color={unreadNotifs > 0 ? ACCENT : THEME.sub} />
                  {unreadNotifs > 0 && <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadNotifs}</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterIconBtn}>
                  <MaterialCommunityIcons name="tune-variant" size={20} color={ACCENT} />
                </TouchableOpacity>
              </View>

              {/* Stories */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesScroll} contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}>
                {stories.map(s => (
                  <TouchableOpacity key={s.id} style={styles.storyItem} onPress={() => { if (!s.isOwn) updateStoryViewed(s.id); }}>
                    <View style={[styles.storyRing, { borderColor: s.viewed ? '#2a2a4a' : (s.ring || ACCENT) }]}>
                      <View style={styles.storyAvatarInner}>
                        {s.isOwn ? <Feather name="plus" size={18} color={ACCENT} /> : <Text style={styles.storyInitial}>{s.name[0]}</Text>}
                      </View>
                    </View>
                    <Text style={[styles.storyName, s.viewed && { opacity: 0.45 }]} numberOfLines={1}>{s.isOwn ? 'Add' : s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* The Happenings Core Engine Visualizer */}
              <TheHappenings />

              {/* Quick Bar */}
              <View style={styles.quickBar}>
                <TouchableOpacity style={styles.nearMeBtn} onPress={getGPSLocation}>
                  <Ionicons name="location" size={14} color={ACCENT} />
                  <Text style={styles.nearMeText}>Near Me</Text>
                </TouchableOpacity>
                {activeCategory !== 'All' && (
                  <View style={styles.activeCatBadge}>
                    <Text style={styles.activeCatText}>{activeCategory}</Text>
                    <TouchableOpacity onPress={() => setActiveCategory('All')}><Feather name="x" size={12} color={ACCENT} style={{ marginLeft: 4 }} /></TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-search" size={48} color={THEME.sub} />
                <Text style={styles.emptyText}>Nothing matching "{searchQuery || activeCategory}"</Text>
              </View>
            )
          }
        />
      </View>

      {/* Filter Modal */}
      <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
        <View style={styles.filterSheet}>
          <View style={styles.filterHandle} />
          <Text style={styles.filterTitle}>Browse Categories</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={[styles.groupRow, activeCategory === 'All' && styles.groupRowActive]} onPress={() => { setActiveCategory('All'); setFilterModalVisible(false); }}>
              <MaterialCommunityIcons name="apps" size={20} color={activeCategory === 'All' ? '#fff' : THEME.sub} />
              <Text style={[styles.groupLabel, activeCategory === 'All' && { color: '#fff' }]}>All Events</Text>
            </TouchableOpacity>
            {Object.entries(CATEGORY_GROUPS).map(([group, cats]) => (
              <View key={group} style={styles.catGroup}>
                <Text style={styles.catGroupHeader}>{group}</Text>
                <View style={styles.catChipRow}>
                  {cats.map(cat => (
                    <TouchableOpacity key={cat} style={[styles.catChip, activeCategory === cat && styles.catChipActive]} onPress={() => { setActiveCategory(cat); setFilterModalVisible(false); }}>
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
        <View style={styles.filterSheet}>
          <View style={styles.filterHandle} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.filterTitle}>Notifications</Text>
            {unreadNotifs > 0 && <TouchableOpacity onPress={markNotifsRead}><Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>Mark all read</Text></TouchableOpacity>}
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.map(n => (
              <TouchableOpacity key={n.id} style={[styles.notifItem, !n.read && styles.notifItemUnread]}
                onPress={() => setPosts(/* ... implement individual notif read handling in store if needed, keeping simple here... */ n ) }>
                <View style={[styles.notifIcon, { backgroundColor: n.type === 'like' ? '#ff4da622' : n.type === 'follow' ? '#10b98122' : '#3b82f622' }]}>
                  <Ionicons name={n.icon} size={16} color={n.type === 'like' ? ACCENT : n.type === 'follow' ? '#10b981' : '#3b82f6'} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifText}><Text style={{ color: '#fff', fontWeight: '700' }}>{n.actor}</Text> {n.text}</Text>
                  <Text style={styles.notifTime}>{n.time} ago</Text>
                </View>
                {!n.read && <View style={styles.notifDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal visible={addEventModalVisible} transparent animationType="slide" onRequestClose={() => setAddEventModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayFull}>
          <View style={styles.addEventSheet}>
            <View style={styles.filterHandle} />
            <Text style={styles.filterTitle}>Create Event</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionLabel}>Basics</Text>
              <TextInput style={styles.modalInput} placeholder="Event Name" placeholderTextColor="#55608a" value={newEventTitle} onChangeText={setNewEventTitle} />
              <TextInput style={[styles.modalInput, { height: 100 }]} placeholder="Description & #vibes" placeholderTextColor="#55608a" value={newEventDescription} onChangeText={setNewEventDescription} multiline textAlignVertical="top" />
              <TextInput style={styles.modalInput} placeholder="Location / Address" placeholderTextColor="#55608a" value={newEventLocation} onChangeText={setNewEventLocation} />
              <Text style={[styles.modalSectionLabel, { marginTop: 10 }]}>Media Highlights</Text>
              <View style={styles.mediaPickerRow}>
                <TouchableOpacity style={styles.mediaPicker} onPress={() => pickMedia('image')}>
                  <Ionicons name="image-outline" size={24} color="#55608a" />
                  <Text style={styles.mediaPickerText}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaPicker} onPress={() => pickMedia('video')}>
                  <Ionicons name="videocam-outline" size={24} color="#55608a" />
                  <Text style={styles.mediaPickerText}>Video</Text>
                </TouchableOpacity>
              </View>
              {newEventImage && <Image source={{ uri: newEventImage.uri }} style={styles.mediaPreview} />}
              {newEventVideo && <Text style={styles.videoLabel}><Ionicons name="checkmark-circle" size={14} color="#10b981" /> {newEventVideo.uri.split('/').pop()}</Text>}
              <TouchableOpacity style={[styles.publishBtn, (loading || (!newEventImage && !newEventVideo)) && { opacity: 0.6 }]} onPress={handleCreateEvent} disabled={loading || (!newEventImage && !newEventVideo)}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>Publish Event</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', padding: 14 }} onPress={() => setAddEventModalVisible(false)}>
                <Text style={{ color: '#55608a', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { flex: 1 },
  dashboardPC: { flexDirection: 'row' },
  mainArea: { flex: 1 },
  topHeader: { paddingTop: Platform.OS === 'web' ? 20 : 55, paddingHorizontal: 16, paddingBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d25', borderRadius: 20, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#1e1e3f' },
  searchBar: { flex: 1, color: '#fff', fontSize: 16, height: '100%' },
  filterIconBtn: { padding: 8 },
  quickBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  nearMeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,77,166,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, gap: 5 },
  nearMeText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  activeCatBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  activeCatText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#55608a', fontSize: 15 },
  storiesScroll: { marginVertical: 10 },
  storyItem: { alignItems: 'center', width: 64 },
  storyRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  storyAvatarInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#141430', justifyContent: 'center', alignItems: 'center' },
  storyInitial: { color: '#fff', fontWeight: '800', fontSize: 18 },
  storyName: { color: THEME.sub, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  
  // Side Nav (PC)
  sideNav: { width: 90, backgroundColor: THEME.navBg, borderRightWidth: 1, borderRightColor: THEME.cardBorder, paddingTop: 40, paddingBottom: 20, alignItems: 'center', gap: 25 },
  sideNavLogo: { color: ACCENT, fontSize: 32, fontWeight: '900', marginBottom: 20 },
  sideNavItem: { alignItems: 'center', gap: 6 },
  sideNavLabel: { color: THEME.sub, fontSize: 12, fontWeight: '600' },
  sideNavAddBtn: { width: 56, height: 56, borderRadius: 18, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10, marginVertical: 10 },
  
  // Modals
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalOverlayFull: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  filterSheet: { backgroundColor: '#0a0a1e', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '85%', borderWidth: 1, borderColor: '#1a1a3e' },
  filterHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2a2a4a', alignSelf: 'center', marginBottom: 18 },
  filterTitle: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 16 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, marginBottom: 6 },
  groupRowActive: { backgroundColor: ACCENT },
  groupLabel: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  catGroup: { marginBottom: 16 },
  catGroupHeader: { color: '#55608a', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  catChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#1e1e3f' },
  catChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  catChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  
  notifBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 14, paddingHorizontal: 4 },
  notifItemUnread: { backgroundColor: 'rgba(255,77,166,0.05)', paddingHorizontal: 8, borderRadius: 14 },
  notifIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  notifContent: { flex: 1 },
  notifText: { color: THEME.sub, fontSize: 14, lineHeight: 20 },
  notifTime: { color: '#2a2a4a', fontSize: 11, marginTop: 2 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  
  addEventSheet: { backgroundColor: '#0a0a1e', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '95%', borderWidth: 1, borderColor: '#1a1a3e' },
  modalInput: { backgroundColor: '#0d0d25', color: '#fff', borderRadius: 14, padding: 15, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#1e1e3f' },
  modalSectionLabel: { color: '#55608a', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  mediaPickerRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  mediaPicker: { flex: 1, height: 80, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#2a2a4a', gap: 5 },
  mediaPickerText: { color: '#55608a', fontSize: 12 },
  mediaPreview: { width: '100%', height: 160, borderRadius: 14, marginBottom: 14 },
  videoLabel: { color: '#10b981', fontSize: 13, marginBottom: 14 },
  publishBtn: { backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginBottom: 10 },
  publishBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
