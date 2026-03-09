import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Modal, RefreshControl, Alert, ScrollView, Image, useWindowDimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Sidebar } from './src/components/Sidebar';
import {
  ProfileScreen, ExploreScreen, EventDetailScreen,
  LeaderboardScreen, MessagesScreen, DropsScreen, HappeningsScreen,
  WalletScreen, CommunityScreen
} from './src/screens';
import { EVENT_CATEGORIES } from './src/data/eventTaxonomy';
import { EventCard } from './src/components/EventCard';
import { SocialPost } from './src/components/SocialPost';
import { StoriesUI } from './src/components/StoriesUI';
import { DailyVibeCheck } from './src/components/DailyVibeCheck';
import { BottomNav } from './src/components/BottomNav';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeScreen, setActiveScreen] = useState('feed');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [vibeProgress, setVibeProgress] = useState({ likes: 0, shares: 0, rsvps: 0 });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showVibeAssistant, setShowVibeAssistant] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({ sort: 'newest', type: 'all', surname: '' });
  const [discoveryEvent, setDiscoveryEvent] = useState(null);
  const [vibeSearchTerm, setVibeSearchTerm] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', location: '', vibe: '', text: 'No description provided.' });
  const [justPosted, setJustPosted] = useState(false);

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  const handleNavigate = (id) => {
    if (id === 'add_event') {
      setShowAddEventModal(true);
    } else {
      setActiveScreen(id);
    }
  };

  // New Deep Purple Premium Theme
  const theme = {
    background: '#310a5d', // Deepest purple
    sidebarBg: '#4b168c', // Lighter purple sidebar
    card: 'rgba(75, 22, 140, 0.4)', // Glassy purple
    text: '#ffffff',
    subText: 'rgba(255, 255, 255, 0.7)',
    accent: '#ff4da6', // Pink
    yellow: '#ffcc00',
    red: '#ef4444',
    border: 'rgba(255, 255, 255, 0.1)',
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    }
  };

  const filteredVibeCategories = EVENT_CATEGORIES.filter(category =>
    category.toLowerCase().includes(vibeSearchTerm.toLowerCase())
  );

  useEffect(() => {
    if (user && screen === 'feed') fetchPosts();
  }, [user, screen]);

  useEffect(() => {
    if (justPosted) {
      const timer = setTimeout(() => setJustPosted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [justPosted]);

  const handlePostEvent = () => {
    if (!newEvent.title || !newEvent.location) {
      Alert.alert('Missing Info', 'Please provide a title and location for your vibe.');
      return;
    }

    const postToAdd = {
      id: Date.now().toString(),
      type: 'event',
      content: {
        title: newEvent.title,
        author_name: user?.name || 'You',
        text: newEvent.text,
        location: newEvent.location,
        distance: '0 km away',
        lineup: 'Open Mic / Community Host',
        tags: [newEvent.vibe, 'new', 'community'],
        price: 'Free'
      },
      engagement_metrics: { likes: 0, comments: 0, reposts: 0 }
    };

    setPosts([postToAdd, ...posts]);
    setNewEvent({ title: '', location: '', vibe: '', text: 'No description provided.' });
    setShowAddEventModal(false);
    setJustPosted(true);
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      // Mock data for UI development
      setPosts([
        {
          id: '1',
          type: 'event',
          content: {
            title: 'Joburg Rooftop Jazz',
            author_name: 'Vibe Central',
            text: 'Smooth jazz with a view of the skyline. 🎷',
            location: 'The Leonardo, Sandton',
            distance: '10.8 km away',
            lineup: 'Jazz Trio, Saxophone Solo',
            tags: ['Chill', 'Sophisticated', 'jazz', 'rooftop', 'nightlife'],
            price: 'R50'
          },
          engagement_metrics: { likes: 75, comments: 1, reposts: 1 }
        },
        {
          id: '2',
          type: 'event',
          content: {
            title: 'Cape Town Gaming Expo',
            author_name: 'Gamer Hub Global',
            text: 'The ultimate fighting game showdown. 🎮',
            location: 'CTICC, Cape Town',
            distance: '1253.3 km away',
            lineup: 'Pro Players, Guest Streamers',
            tags: ['Competitive', 'High Energy', 'gaming', 'esports', 'anime'],
            price: 'R150'
          },
          engagement_metrics: { likes: 110, comments: 5, reposts: 2 }
        }
      ]);
    } finally { setLoading(false); }
  };

  const handleRSVP = (eventId) => {
    Alert.alert('RSVP Confirmed!', 'Check your Wallet for the ticket.');
  };

  const handleLogout = () => {
    setActiveScreen('auth');
    setUser(null);
  };

  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.content.title.toLowerCase().includes(filters.surname.toLowerCase()) ||
      p.content.author_name.toLowerCase().includes(filters.surname.toLowerCase()) ||
      (p.content.tags && p.content.tags.some(t => t.toLowerCase().includes(filters.surname.toLowerCase())));
    const matchesType = filters.type === 'all' ||
      (p.content.tags && p.content.tags.some(t => t.toLowerCase() === filters.type.toLowerCase())) ||
      (p.content.title.toLowerCase().includes(filters.type.toLowerCase()));
    return matchesSearch && matchesType;
  })
    .sort((a, b) => {
      if (filters.sort === 'popular') return b.engagement_metrics.likes - a.engagement_metrics.likes;
      return 0; // Default newest (original order)
    });

  const hasActiveFilters = filters.type !== 'all' || filters.surname !== '' || filters.sort !== 'newest';

  const handleLike = () => {
    setVibeProgress(prev => ({ ...prev, likes: Math.min(prev.likes + 1, 3) }));
  };

  if (screen === 'auth') {
    return (
      <View style={[styles.authPage, { backgroundColor: theme.sidebarBg }]}>
        <StatusBar style="light" />
        <View style={styles.authGlassCard}>
          <View style={styles.boltCircle}><Text style={styles.boltIcon}>⚡</Text></View>
          <Text style={styles.mainTitle}>The Gruv</Text>
          <Text style={styles.subTitle}>Find Your Frequency.</Text>
          <TouchableOpacity style={[styles.joinBtn, { backgroundColor: theme.accent }]} onPress={() => { setUser({ id: 'u1', name: 'User', gender: 'male' }); setScreen('app'); }}>
            <Text style={styles.joinBtnText}>Join the Gruv</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={[styles.mainLayout, isMobile && { flexDirection: 'column' }]}>
        {!isMobile && (
          <Sidebar
            activeScreen={activeScreen}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            theme={theme}
            isCollapsed={isSidebarCollapsed || isTablet}
          />
        )}

        <View style={styles.contentArea}>
          {activeScreen === 'feed' && (
            <View style={styles.screenWrapper}>
              <View style={styles.searchHeader}>
                <TouchableOpacity style={styles.menuBtn} onPress={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                  <Text style={styles.menuIconText}>≡</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileIndicatorHeader} onPress={() => setActiveScreen('profile')}>
                  <View style={styles.avatarMini}>
                    <View style={styles.vipBadgeSidebar}><Text style={styles.vipTextSidebar}>VIP</Text></View>
                  </View>
                </TouchableOpacity>
                <View style={styles.searchContainer}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search characters or hosts..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={filters.surname}
                    onChangeText={(t) => setFilters({ ...filters, surname: t })}
                  />
                </View>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterModal(true)}>
                  <Text style={styles.filterIcon}>▽</Text>
                  {hasActiveFilters && <View style={styles.filterBadge} />}
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <StoriesUI theme={theme} />
                <DailyVibeCheck
                  progress={vibeProgress}
                  theme={theme}
                  onViewLeaderboard={() => setActiveScreen('leaderboard')}
                  onQuestClick={(questId) => {
                    // Logic to show a discovery event based on quest
                    const match = posts.find(p => p.type === 'event' && !p.isLiked);
                    setDiscoveryEvent(match || posts[0]);
                  }}
                />

                {discoveryEvent && (
                  <View style={styles.discoveryOverlay}>
                    <Text style={styles.discoveryTitle}>Matched for your Quest:</Text>
                    <EventCard
                      post={discoveryEvent}
                      theme={theme}
                      compact={true}
                      onPress={() => {
                        setSelectedEvent(discoveryEvent.content);
                        setActiveScreen('event_detail');
                        setDiscoveryEvent(null);
                      }}
                    />
                    <TouchableOpacity onPress={() => setDiscoveryEvent(null)} style={styles.closeDiscovery}>
                      <Text style={styles.closeDiscoveryText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.feedHeaderRow}>
                  <Text style={styles.feedSectionTitle}>
                    {hasActiveFilters ? 'FILTERED RESULTS' : 'LIVE EVENTS'}
                  </Text>
                  {hasActiveFilters && (
                    <TouchableOpacity onPress={() => setFilters({ sort: 'newest', type: 'all', surname: '' })}>
                      <Text style={styles.clearFiltersText}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {filteredPosts.map(post => {
                  const isTrending = post.engagement_metrics && post.engagement_metrics.likes > 50;
                  return post.type === 'event' ? (
                    <View key={post.id}>
                      {isTrending && (
                        <View style={styles.trendingRibbon}>
                          <Text style={styles.trendingRibbonText}>🔥 TRENDING</Text>
                        </View>
                      )}
                      <EventCard
                        post={post}
                        theme={theme}
                        onPress={() => {
                          setSelectedEvent({ id: post.id, title: post.content.title, ...post.content });
                          setActiveScreen('event_detail');
                        }}
                        onLike={handleLike}
                        onRSVP={handleRSVP}
                      />
                    </View>
                  ) : (
                    <SocialPost key={post.id} post={post} theme={theme} />
                  );
                })}
              </ScrollView>

              {/* Floating Action Buttons */}
              <View style={styles.fabContainer}>
                <TouchableOpacity style={styles.fabBot} onPress={() => setShowVibeAssistant(true)}>
                  <Text style={styles.fabIcon}>🤖</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fabChat}>
                  <Text style={styles.fabIcon}>💬</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeScreen === 'profile' && (
            <ProfileScreen
              user={user}
              theme={{ bg: theme.background, acc: theme.accent, card: theme.card, text: theme.text, sub: theme.subText, inp: 'rgba(255,255,255,0.1)', it: theme.text }}
              onLogout={handleLogout}
              onBack={() => setActiveScreen('feed')}
            />
          )}

          {activeScreen === 'explore' && (
            <ExploreScreen
              theme={{ bg: theme.background, acc: theme.accent, card: theme.card, text: theme.text, sub: theme.subText }}
              onNavigate={(screen, data) => {
                if (data) setSelectedEvent(data);
                setActiveScreen(screen);
              }}
            />
          )}

          {activeScreen === 'event_detail' && (
            <EventDetailScreen
              event={selectedEvent}
              theme={{ bg: theme.background, acc: theme.accent, card: theme.card, text: theme.text, sub: theme.subText }}
              onBack={() => setActiveScreen('explore')}
            />
          )}

          {activeScreen === 'leaderboard' && (
            <LeaderboardScreen
              theme={theme}
              onNavigate={setActiveScreen}
            />
          )}

          {activeScreen === 'messages' && (
            <MessagesScreen
              theme={theme}
              onNavigate={setActiveScreen}
            />
          )}

          {activeScreen === 'drops' && (
            <DropsScreen
              theme={theme}
              onNavigate={setActiveScreen}
            />
          )}

          {activeScreen === 'happenings' && (
            <HappeningsScreen
              theme={theme}
              onNavigate={setActiveScreen}
            />
          )}

          {activeScreen === 'wallet' && (
            <WalletScreen
              theme={theme}
              onNavigate={setActiveScreen}
            />
          )}

          {activeScreen === 'community' && (
            <CommunityScreen
              theme={theme}
              onNavigate={setActiveScreen}
            />
          )}

          {activeScreen === 'security' && (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.sidebarBg, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>SECURITY</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Your account is protected.</Text>
              <TouchableOpacity
                style={{ marginTop: 30, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.accent, borderRadius: 15 }}
                onPress={() => setActiveScreen('feed')}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Back to Feed</Text>
              </TouchableOpacity>
            </SafeAreaView>
          )}
        </View>
        {isMobile && (
          <BottomNav
            activeScreen={activeScreen}
            onNavigate={handleNavigate}
            theme={theme}
          />
        )}
      </View>

      {/* Add Event Modal */}
      <Modal
        visible={showAddEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>POST A VIBE</Text>
              <TouchableOpacity onPress={() => setShowAddEventModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={styles.modalForm}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Event Title"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={newEvent.title}
                  onChangeText={(val) => setNewEvent({ ...newEvent, title: val })}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Location"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={newEvent.location}
                  onChangeText={(val) => setNewEvent({ ...newEvent, location: val })}
                />
                <TextInput
                  style={[styles.modalInput, { height: 80, paddingTop: 12 }]}
                  placeholder="What's the vibe? (Description)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  value={newEvent.text}
                  onChangeText={(val) => setNewEvent({ ...newEvent, text: val })}
                />

                <View style={styles.mediaUploadSection}>
                  <Text style={styles.vibeSelectorLabel}>Upload Media (Images/Video):</Text>
                  <View style={styles.mediaUploadGrid}>
                    <TouchableOpacity style={styles.uploadPlaceholder}>
                      <Text style={styles.uploadIcon}>📸</Text>
                      <Text style={styles.uploadSubText}>Add Image</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.uploadPlaceholder}>
                      <Text style={styles.uploadIcon}>🎥</Text>
                      <Text style={styles.uploadSubText}>Add Video</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalVibeSelector}>
                  <Text style={styles.vibeSelectorLabel}>Select Tribe/Vibe:</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Search categories..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={vibeSearchTerm}
                    onChangeText={setVibeSearchTerm}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vibeScroll}>
                    {filteredVibeCategories.map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.vibeChip, newEvent.vibe === v && { backgroundColor: theme.accent }]}
                        onPress={() => setNewEvent({ ...newEvent, vibe: v })}
                      >
                        <Text style={styles.vibeChipText}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <TouchableOpacity
                  style={[styles.postEventBtn, { backgroundColor: theme.accent }]}
                  onPress={handlePostEvent}
                >
                  <Text style={styles.postEventBtnText}>Post to The Gruvs</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Vibe Assistant Modal */}
      <Modal
        visible={showVibeAssistant}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowVibeAssistant(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderRadius: 40, padding: 0, overflow: 'hidden' }]}>
            <View style={styles.chatArea}>
              <ScrollView style={{ padding: 20 }}>
                <View style={styles.aiBubble}>
                  <Text style={styles.chatText}>Yo! I'm your Vibe Assistant. Looking for something specific or just want me to suggest a vibe?</Text>
                </View>
                <View style={styles.userBubble}>
                  <Text style={styles.chatText}>Suggest a chill event for tonight.</Text>
                </View>
                <View style={styles.aiBubble}>
                  <Text style={styles.chatText}>I'd check out "Joburg Rooftop Jazz". It's trending with 75+ likes and perfect for a relaxed evening! 🎷</Text>
                </View>
              </ScrollView>
              <View style={styles.assistantQuickActions}>
                {['Suggest Jazz', 'Claim Drops', 'My Tickets', 'Who is Sarah?'].map(action => (
                  <TouchableOpacity key={action} style={styles.assistantChip}>
                    <Text style={styles.assistantChipText}>{action}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.chatInputRow}>
                <TextInput
                  placeholder="Ask me anything..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.chatInput}
                />
                <TouchableOpacity style={styles.sendBtn}>
                  <Text style={{ fontSize: 20 }}>⚡</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Advanced Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ADVANCED FILTERS</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm}>
              <Text style={styles.filterLabel}>Sort By</Text>
              <View style={styles.filterRow}>
                {['newest', 'popular'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.filterChip, filters.sort === s && styles.activeFilterChip]}
                    onPress={() => setFilters({ ...filters, sort: s })}
                  >
                    <Text style={styles.filterChipText}>{s.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Event Type / Tribe</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Search tribes (e.g. Jazz, Amapiano)..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={vibeSearchTerm}
                onChangeText={setVibeSearchTerm}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, filters.type === 'all' && styles.activeFilterChip]}
                  onPress={() => setFilters({ ...filters, type: 'all' })}
                >
                  <Text style={styles.filterChipText}>ALL</Text>
                </TouchableOpacity>
                {filteredVibeCategories.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterChip, filters.type === t && styles.activeFilterChip]}
                    onPress={() => setFilters({ ...filters, type: t })}
                  >
                    <Text style={styles.filterChipText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.filterLabel}>Search by Host Surname</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter surname..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={filters.surname}
                onChangeText={(t) => setFilters({ ...filters, surname: t })}
              />

              <TouchableOpacity
                style={[styles.postEventBtn, { backgroundColor: theme.accent, marginTop: 30 }]}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.postEventBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainLayout: { flex: 1, flexDirection: 'row' },
  contentArea: { flex: 1, height: '100%' },
  screenWrapper: { flex: 1, padding: 25 },
  authPage: { flex: 1, justifyContent: 'center', padding: 25 },
  authGlassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 40,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  boltCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  boltIcon: { fontSize: 40, color: '#fff' },
  mainTitle: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  subTitle: { fontSize: 18, color: '#fff', opacity: 0.8, marginBottom: 30 },
  joinBtn: { width: '100%', padding: 18, borderRadius: 20, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    gap: 15
  },
  menuBtn: {
    padding: 10,
    marginLeft: -10,
  },
  menuIconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  profileIndicatorHeader: {
    marginLeft: 10,
    marginRight: 15,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 55,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: { fontSize: 18, marginRight: 15, opacity: 0.5 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  filterBtn: {
    width: 55,
    height: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterIcon: { color: '#fff', fontSize: 24 },
  filterBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4da6',
    borderWidth: 1,
    borderColor: '#310a5d',
  },
  scrollContent: { paddingBottom: 50 },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 25,
    padding: 0,
    marginBottom: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  clearFiltersText: { color: '#a855f7', fontSize: 12, fontWeight: 'bold' },
  feedSectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  trendingRibbon: {
    backgroundColor: 'rgba(255, 77, 166, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: -15,
    marginLeft: 20,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#ff4da6',
  },
  trendingRibbonText: { color: '#ff4da6', fontSize: 9, fontWeight: '900' },

  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    gap: 15,
    alignItems: 'center',
  },
  fabBot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(168, 85, 247, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fabChat: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff4da6',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 10px 25px rgba(255, 77, 166, 0.3)',
  },
  fabIcon: { fontSize: 24 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#310a5d',
    borderRadius: 30,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  closeModalText: { color: '#fff', fontSize: 20 },
  modalForm: { gap: 20 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalVibeSelector: { gap: 10 },
  vibeSelectorLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  vibeScroll: { flexDirection: 'row' },
  vibeChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
  },
  vibeChipText: { color: '#fff', fontSize: 12 },
  postEventBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  postEventBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  mediaUploadSection: { marginTop: 20, marginBottom: 20 },
  mediaUploadGrid: { flexDirection: 'row', gap: 15, marginTop: 10 },
  uploadPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadIcon: { fontSize: 24, marginBottom: 4 },
  uploadSubText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' },
  // Vibe Assistant Styles
  assistantHeader: {
    padding: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assistantTitle: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  chatArea: { height: 400, backgroundColor: '#310a5d' },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 20,
    borderBottomLeftRadius: 5,
    marginBottom: 15,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#ff4da6',
    padding: 15,
    borderRadius: 20,
    borderBottomRightRadius: 5,
    marginBottom: 15,
    maxWidth: '80%',
  },
  chatText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  chatInputRow: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 10,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 25,
    paddingHorizontal: 20,
    color: '#fff',
  },
  sendBtn: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assistantQuickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  assistantChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  assistantChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 'bold' },
  avatarMini: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#555', marginRight: 10, position: 'relative' },
  vipBadgeSidebar: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#ffcc00', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#4b168c' },
  vipTextSidebar: { color: '#000', fontSize: 6, fontWeight: '900' },
  discoveryOverlay: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 25,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  discoveryTitle: { color: '#a855f7', fontWeight: 'bold', fontSize: 12, marginBottom: 15, textTransform: 'uppercase' },
  closeDiscovery: { marginTop: 10, alignSelf: 'center' },
  closeDiscoveryText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  filterLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginTop: 15 },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  activeFilterChip: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  filterChipText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  filterScroll: { flexDirection: 'row' },
});
