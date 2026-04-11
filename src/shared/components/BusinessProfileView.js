import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, GOLD, THEME } from '../../core/theme';

export default function BusinessProfileView({ business }) {
  const MOCK_PRODUCTS = [
    { id: 'p1', name: 'Premium Bottle Service', price: 'R2500', img: 'https://images.unsplash.com/photo-1592701010211-c3951a3615f1' },
    { id: 'p2', name: 'VIP Area Access', price: 'R500', img: 'https://images.unsplash.com/photo-1566737236500-c8ac40014582' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: business.cover || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30' }} style={styles.cover} />
      
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: business.avatar }} style={styles.avatar} />
          <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={16} color={ACCENT} /></View>
        </View>
        <Text style={styles.name}>{business.name || 'Premium Club'}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}><Text style={styles.tagText}>Lifestyle</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>Events</Text></View>
          <View style={[styles.tag, { backgroundColor: GOLD + '22' }]}><Text style={[styles.tagText, { color: GOLD }]}>Business</Text></View>
        </View>
        <Text style={styles.bio}>The ultimate destination for premium nightlife and curated frequency experiences. Join the vibe.</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Book Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn}>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Offers</Text>
        <FlatList
          data={MOCK_PRODUCTS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <Image source={{ uri: item.img }} style={styles.productImg} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>{item.price}</Text>
                <TouchableOpacity style={styles.addBtn}><Ionicons name="add" size={16} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Advertising</Text>
        <View style={styles.adBanner}>
          <Ionicons name="megaphone" size={24} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <Text style={styles.adTitle}>Summer Kickoff Special</Text>
            <Text style={styles.adDesc}>Get 20% off all tickets this weekend!</Text>
          </View>
          <TouchableOpacity style={styles.adAction}><Text style={styles.adActionText}>Claim</Text></TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050514' },
  cover: { width: '100%', height: 200 },
  header: { padding: 20, alignItems: 'center', marginTop: -40 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#050514' },
  verifiedBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#050514', borderRadius: 10, padding: 2 },
  name: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 15 },
  tagRow: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  tag: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  tagText: { color: THEME.sub, fontSize: 12, fontWeight: '700' },
  bio: { color: '#94a3b8', textAlign: 'center', lineHeight: 22, fontSize: 14, paddingHorizontal: 10 },
  
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 15, marginBottom: 30 },
  primaryBtn: { flex: 1, backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 18, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: { width: 56, height: 56, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1e1e3f' },

  section: { paddingHorizontal: 20, marginBottom: 30 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 15 },
  productCard: { width: 220, backgroundColor: '#0a0a1e', borderRadius: 20, marginRight: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#1e1e3f' },
  productImg: { width: '100%', height: 120 },
  productInfo: { padding: 15, position: 'relative' },
  productName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 5 },
  productPrice: { color: ACCENT, fontWeight: '800', fontSize: 14 },
  addBtn: { position: 'absolute', bottom: 15, right: 15, backgroundColor: '#3b82f6', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  adBanner: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: 'rgba(255,77,166,0.08)', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,77,166,0.2)' },
  adTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  adDesc: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  adAction: { backgroundColor: ACCENT, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  adActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
