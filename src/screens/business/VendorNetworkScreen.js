import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, THEME, GOLD } from '../../theme';
import { StatusBar } from 'expo-status-bar';

const CATEGORIES = ['All', 'DJs', 'Photographers', 'Security', 'Sound Engineers', 'Caterers', 'Promoters'];

const MOCK_VENDORS = [
  { id: 'v1', name: 'DJ Maphorisa', category: 'DJs', rating: 4.9, reviews: 342, rate: 'R15,000/hr', img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&h=200&fit=crop' },
  { id: 'v2', name: 'Lens Queen Studio', category: 'Photographers', rating: 4.8, reviews: 120, rate: 'R2,500/event', img: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&h=200&fit=crop' },
  { id: 'v3', name: 'Elite Guard Auth', category: 'Security', rating: 4.9, reviews: 89, rate: 'R500/guard/hr', img: 'https://images.unsplash.com/photo-1506869640319-fea1a2ab8e40?w=200&h=200&fit=crop' },
  { id: 'v4', name: 'Sonic Boom Tech', category: 'Sound Engineers', rating: 4.7, reviews: 56, rate: 'R4,000/rig', img: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=200&h=200&fit=crop' }
];

export default function VendorNetworkScreen() {
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = MOCK_VENDORS.filter(v => {
    return (activeCat === 'All' || v.category === activeCat) &&
           (v.name.toLowerCase().includes(search.toLowerCase()) || v.category.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vendor Network</Text>
        <Text style={styles.headerSub}>Hire the best talent for your next event.</Text>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={THEME.sub} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search DJs, Photographers..."
          placeholderTextColor={THEME.sub}
          value={search}
          onChangeText={setSearch}
        />
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
              onPress={() => setActiveCat(item)}
            >
              <Text style={[styles.catText, activeCat === item && styles.catTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.vendorCard}>
            <Image source={{ uri: item.img }} style={styles.vendorImg} />
            <View style={styles.vendorInfo}>
              <View style={styles.vHeader}>
                <Text style={styles.vendorName}>{item.name}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#000" />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              </View>
              <Text style={styles.vendorCat}>{item.category} · {item.reviews} verified reviews</Text>
              
              <View style={styles.bottomRow}>
                <Text style={styles.vendorRate}>{item.rate}</Text>
                <TouchableOpacity style={styles.hireBtn}>
                  <Text style={styles.hireText}>Request Quote</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  headerSub: { color: THEME.sub, fontSize: 14, marginTop: 4 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d25', marginHorizontal: 20, borderRadius: 16, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#1e1e3f', marginBottom: 15 },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 15 },
  
  catScrollWrap: { height: 40, marginBottom: 15 },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#1e1e3f', justifyContent: 'center' },
  catChipActive: { backgroundColor: 'rgba(255,77,166,0.1)', borderColor: ACCENT },
  catText: { color: THEME.sub, fontSize: 13, fontWeight: '600' },
  catTextActive: { color: ACCENT, fontWeight: '800' },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },
  vendorCard: { flexDirection: 'row', backgroundColor: THEME.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: THEME.cardBorder },
  vendorImg: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#1e1e3f' },
  vendorInfo: { flex: 1, marginLeft: 14, justifyContent: 'space-between' },
  vHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vendorName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: GOLD, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 3 },
  ratingText: { color: '#000', fontSize: 11, fontWeight: '900' },
  vendorCat: { color: THEME.sub, fontSize: 12, marginTop: 2 },
  
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  vendorRate: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hireBtn: { backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  hireText: { color: '#fff', fontSize: 12, fontWeight: '800' }
});
