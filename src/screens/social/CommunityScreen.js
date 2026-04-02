import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, useWindowDimensions, RefreshControl, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, ACCENT } from '../../theme';

const { width: screenWidth } = Dimensions.get('window');

export default function CommunityScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1500);
    };

    const [tribesList, setTribesList] = useState([
        { id: '1', name: 'Jazz Lovers', members: '1.2k', desc: 'Chill vibes & saxophones.', joined: true },
        { id: '2', name: 'Techies JHB', members: '3.5k', desc: 'Building the future of Mzansi.', joined: false },
        { id: '3', name: 'Desert Nomads', members: '800', desc: 'Burning Man afrika style.', joined: false },
    ]);

    const toggleJoinTribe = (id) => {
        setTribesList(prev => prev.map(t => t.id === id ? { ...t, joined: !t.joined } : t));
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={[styles.header, { paddingHorizontal: width < 600 ? 12 : 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={width < 600 ? 20 : 24} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: width < 600 ? 14 : 16 }]}>COMMUNITY TRIBES</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="close" size={width < 600 ? 20 : 24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                contentContainerStyle={[styles.scrollArea, { paddingHorizontal: width < 600 ? 12 : 20 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.tribeGrid}>
                    {tribesList.map(tribe => (
                        <View key={tribe.id} style={[styles.tribeCard, { width: width > 1024 ? '31%' : (width > 768 ? '48%' : '100%') }]}>
                            <View style={styles.tribeHeader}>
                                <View style={styles.tribeAvatar} />
                                <View>
                                    <Text style={styles.tribeName}>{tribe.name}</Text>
                                    <Text style={styles.tribeMembers}>{tribe.members} members</Text>
                                </View>
                            </View>
                            <Text style={styles.tribeDesc}>{tribe.desc}</Text>
                            <TouchableOpacity
                                style={[styles.tribeActionBtn, tribe.joined ? { backgroundColor: 'rgba(255,255,255,0.05)' } : { backgroundColor: ACCENT }]}
                                onPress={() => toggleJoinTribe(tribe.id)}
                            >
                                <Text style={[styles.tribeActionText, tribe.joined && { opacity: 0.5 }]}>
                                    {tribe.joined ? 'Joined' : 'Join Tribe'}
                                </Text>
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
    headerTitle: { color: '#fff', fontWeight: '900', letterSpacing: 2, flex: 1, textAlign: 'center' },
    scrollArea: { paddingVertical: screenWidth < 600 ? 12 : 20, gap: screenWidth < 600 ? 12 : 20 },
    tribeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' },
    tribeCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    tribeHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
    tribeAvatar: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#1e1e3f' },
    tribeName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    tribeMembers: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    tribeDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 22, height: 60, marginBottom: 20 },
    tribeActionBtn: { paddingVertical: 14, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    tribeActionText: { color: '#fff', fontWeight: 'bold' },
});

