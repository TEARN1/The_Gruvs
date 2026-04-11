import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Platform, useWindowDimensions } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../../core/state/useStore';
import { ACCENT, THEME, GOLD } from '../../../core/theme';
import { StatusBar } from 'expo-status-bar';

const CATEGORIES = [
  'All', 'DJs', 'Photographers', 'Security', 'Sound Engineers', 
  'Caterers', 'Promoters', 'Decorators', 'Florists', 'Venues',
  'Bartenders', 'Makeup Artists', 'Videographers', 'Event Planners'
];

const MOCK_VENDORS = [
  { id: 'v1', name: 'DJ Maphorisa', category: 'DJs', rating: 4.9, reviews: 342, rate: 'R15,000/hr', img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop', imageCount: 5, bio: 'Amapiano pioneer and world-class producer.' },
  { id: 'v2', name: 'Lens Queen Studio', category: 'Photographers', rating: 4.8, reviews: 120, rate: 'R2,500/event', img: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&fit=crop', imageCount: 12, bio: 'Capturing your most precious moments with grace.' },
  { id: 'v3', name: 'Elite Guard Auth', category: 'Security', rating: 4.9, reviews: 89, rate: 'R500/guard/hr', img: 'https://images.unsplash.com/photo-1506869640319-fea1a2ab8e40?w=400&h=400&fit=crop', imageCount: 3, bio: 'Professional event security for high-profile gatherings.' },
  { id: 'v4', name: 'Sonic Boom Tech', category: 'Sound Engineers', rating: 4.7, reviews: 56, rate: 'R4,000/rig', img: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&h=400&fit=crop', imageCount: 8, bio: 'High-fidelity sound systems and expert engineering.' },
  { id: 'v5', name: 'Vibe Master DJ', category: 'DJs', rating: 4.6, reviews: 45, rate: 'R5,000/hr', img: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=400&h=400&fit=crop', imageCount: 4, bio: 'Specializing in Deep House and Techno.' },
  { id: 'v6', name: 'Glow Decor', category: 'Decorators', rating: 4.9, reviews: 210, rate: 'Custom Quote', img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=400&fit=crop', imageCount: 15, bio: 'Transforming spaces into magical experiences.' }
];

export default function VendorNetworkScreen({ navigation }) {
  const { user } = useStore();
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');
  const { width } = useWindowDimensions();
  const isPC = Platform.OS === 'web' && width > 768;
  const contentWidth = isPC ? Math.min(width, 800) : width;

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const filtered = MOCK_VENDORS.filter(v => {
    return (activeCat === 'All' || v.category === activeCat) &&
           (v.name.toLowerCase().includes(search.toLowerCase()) || v.category.toLowerCase().includes(search.toLowerCase()));
  });

  const handleVendorAction = (vendorId) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (!user || user.isVisitor) {
      navigation.navigate('Auth');
      return;
    }
    // Proceed with navigation to vendor profile or interaction
    console.log('Viewing vendor:', vendorId);
  };

  const renderVendor = ({ item }) => (
    <TouchableOpacity
      style={[styles.vendorCard, isPC && styles.vendorCardPC]}
      onPress={() => handleVendorAction(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`View profile for ${item.name}, ${item.category}. Rated ${item.rating} stars.`}
    >
      <View style={styles.vendorImgContainer}>
        <Image source={{ uri: item.img }} style={[styles.vendorImg, isPC && styles.vendorImgPC]} />
        {item.imageCount && item.imageCount > 1 && (
          <View style={styles.imageCounter}>
            <Ionicons name="images" size={10} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.imageCounterText}>{item.imageCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.vendorInfo}>
        <View style={styles.vHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vendorName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.vendorCat}>{item.category}</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#000" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>

        {isPC && <Text style={styles.vendorBio} numberOfLines={2}>{item.bio}</Text>}

        <View style={styles.verifiedRow}>
          <MaterialCommunityIcons name="check-decagram" size={14} color={ACCENT} />
          <Text style={styles.verifiedText}>{item.reviews} Verified Reviews</Text>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.vendorRate}>{item.rate}</Text>
          <View style={styles.hireBtn}>
            <Text style={styles.hireText}>View Profile</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.contentWrapper, { maxWidth: 800, width: '100%', alignSelf: 'center' }]}>
        <View style={[styles.header, isPC && styles.headerPC]}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} accessibilityRole="header">Network</Text>
              <Text style={styles.headerSub}>Connect with industry-leading event professionals.</Text>
            </View>
            {navigation?.canGoBack() && !isPC && (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { triggerHaptic(); navigation.goBack(); }}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.controlsRow, isPC && styles.controlsRowPC]}>
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search DJs, Photographers..."
              placeholderTextColor="#55608a"
              value={search}
              onChangeText={setSearch}
              accessibilityLabel="Search vendors"
            />
          </View>
        </View>

        <View style={styles.catScrollWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORIES}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.catChip, activeCat === item && styles.catChipActive]}
                onPress={() => { triggerHaptic(); setActiveCat(item); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeCat === item }}
                accessibilityLabel={`Filter by ${item}`}
              >
                <Text style={[styles.catText, activeCat === item && styles.catTextActive]}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={[styles.catListContent, isPC && { paddingHorizontal: 40 }]}
          />
        </View>

        <FlatList
          key={isPC ? 'pc' : 'mobile'}
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={isPC ? 2 : 1}
          contentContainerStyle={[styles.listContent, isPC && styles.listContentPC]}
          renderItem={renderVendor}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Feather name="users" size={48} color="#1e1e3f" />
              <Text style={styles.emptyText}>No vendors found in this category.</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  contentWrapper: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 15 },
  headerPC: { paddingHorizontal: 40, paddingTop: 40 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerTitle: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#94a3b8', fontSize: 14, marginTop: 4, fontWeight: '500' },
  closeBtn: { padding: 8, justifyContent: 'flex-start' },

  controlsRow: { paddingHorizontal: 20, marginBottom: 15 },
  controlsRowPC: { paddingHorizontal: 40 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d25', borderRadius: 16, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: '#1e1e3f' },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 15 },

  catScrollWrap: { height: 40, marginBottom: 20 },
  catListContent: { paddingHorizontal: 20, gap: 10 },
  catChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#1e1e3f', justifyContent: 'center' },
  catChipActive: { backgroundColor: 'rgba(255,77,166,0.1)', borderColor: ACCENT },
  catText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  catTextActive: { color: ACCENT, fontWeight: '800' },

  listContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },
  listContentPC: { paddingHorizontal: 40, gap: 20 },

  vendorCard: { flexDirection: 'row', backgroundColor: '#0d0d25', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e1e3f' },
  vendorCardPC: { flex: 1, margin: 8 },

  vendorImgContainer: { position: 'relative' },
  vendorImg: { width: 90, height: 90, borderRadius: 16, backgroundColor: '#1e1e3f' },
  vendorImgPC: { width: 110, height: 110 },

  imageCounter: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  imageCounterText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  vendorInfo: { flex: 1, marginLeft: 16, justifyContent: 'space-between' },
  vHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  vendorName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  vendorCat: { color: ACCENT, fontSize: 12, fontWeight: '700', marginTop: 2 },

  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  ratingText: { color: '#000', fontSize: 12, fontWeight: '900' },

  vendorBio: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginVertical: 8 },

  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  verifiedText: { color: '#55608a', fontSize: 11, fontWeight: '600' },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  vendorRate: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hireBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  hireText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { color: '#55608a', fontSize: 15, marginTop: 16, fontWeight: '600' }
});


