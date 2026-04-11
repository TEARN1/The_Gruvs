import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, useWindowDimensions, RefreshControl, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, ACCENT } from '../../../core/theme';

const { width: screenWidth } = Dimensions.get('window');

export default function DropsScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1500);
    };

    const [drops, setDrops] = useState([
        { id: '1', title: 'Jazz VIP Pass', cost: '500 VP', claimed: false },
        { id: '2', title: 'Tech Hub Sticker', cost: '100 VP', claimed: true },
        { id: '3', title: 'Rooftop NFT', cost: '2500 VP', claimed: false },
        { id: '4', title: 'Coffee Voucher', cost: '300 VP', claimed: false },
    ]);

    const handleClaim = (id) => {
        setDrops(prev => prev.map(d => d.id === id ? { ...d, claimed: true } : d));
        Alert.alert('Success', 'Drop claimed! Check your Vault.');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={[styles.header, { paddingHorizontal: width < 600 ? 12 : 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={width < 600 ? 20 : 24} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: width < 600 ? 14 : 16, flex: 1, textAlign: 'center' }]}>EXCLUSIVE DROPS</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="close" size={width < 600 ? 20 : 24} color="#fff" />
                </TouchableOpacity>
            </View>
            <ScrollView 
                contentContainerStyle={[styles.scrollArea, { paddingHorizontal: width < 600 ? 12 : 20 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.dropsGrid}>
                    {drops.map(drop => (
                        <View key={drop.id} style={[styles.dropCard, { width: width > 768 ? '46%' : '100%' }]}>
                            <View style={styles.dropImage} />
                            <Text style={styles.dropTitle}>{drop.title}</Text>
                            <Text style={styles.dropCost}>{drop.cost}</Text>
                            <TouchableOpacity
                                style={[styles.claimBtn, drop.claimed ? styles.claimedBtn : { backgroundColor: ACCENT }]}
                                onPress={() => !drop.claimed && handleClaim(drop.id)}
                            >
                                <Text style={styles.claimText}>{drop.claimed ? 'Claimed' : 'Claim now'}</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: screenWidth < 600 ? 60 : 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerBtn: { width: screenWidth < 600 ? 36 : 40, height: screenWidth < 600 ? 36 : 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontWeight: '900', letterSpacing: 2 },
    scrollArea: { paddingVertical: screenWidth < 600 ? 12 : 20, gap: screenWidth < 600 ? 12 : 20 },
    dropsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: screenWidth < 600 ? 10 : 15, justifyContent: 'center' },
    dropCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: screenWidth < 600 ? 12 : 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    dropImage: { height: screenWidth < 600 ? 100 : 140, borderRadius: 15, backgroundColor: '#1e1e3f', marginBottom: screenWidth < 600 ? 10 : 15 },
    dropTitle: { color: '#fff', fontSize: screenWidth < 600 ? 14 : 16, fontWeight: 'bold' },
    dropCost: { color: ACCENT, fontSize: screenWidth < 600 ? 12 : 14, fontWeight: '800', marginTop: 4, marginBottom: screenWidth < 600 ? 10 : 16 },
    claimBtn: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
    claimedBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    claimText: { color: '#fff', fontWeight: 'bold' },
});

