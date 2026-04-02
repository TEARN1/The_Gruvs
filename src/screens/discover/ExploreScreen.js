import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { THEME, ACCENT } from '../../theme';

export default function ExploreScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [activeTab, setActiveTab] = useState('Top');

    const trendingTags = ['#techno', '#rave', '#underground', '#berlin', '#housemusic'];
    const people = [
        { id: '1', name: 'Sarah Jones', handle: '@sarahj', bio: 'Music lover 🎵' },
        { id: '2', name: 'Mike Smith', handle: '@mikes', bio: 'Tech enthusiast 💻' },
        { id: '3', name: 'Jessica Brown', handle: '@jessb', bio: 'Art & Design 🎨' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="rgba(255,255,255,0.4)" />
                    <TextInput placeholder="Search the frequency..." placeholderTextColor="rgba(255,255,255,0.4)" style={styles.searchInput} />
                </View>
            </View>

            <View style={styles.tabsContainer}>
                {['Top', 'People', 'Events', 'Tags'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.scrollArea}>
                {activeTab === 'Top' && (
                    <>
                        <Text style={styles.sectionTitle}>Trending Now</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 30 }}>
                            {trendingTags.map(tag => (
                                <View key={tag} style={styles.trendingTag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </ScrollView>

                        <Text style={styles.sectionTitle}>People to Follow</Text>
                        {people.map(person => (
                            <View key={person.id} style={styles.personRow}>
                                <View style={styles.personAvatar} />
                                <View style={styles.personInfo}>
                                    <Text style={styles.personName}>{person.name}</Text>
                                    <Text style={styles.personHandle}>{person.handle}</Text>
                                </View>
                                <TouchableOpacity style={styles.followBtn}>
                                    <Text style={styles.followBtnText}>Follow</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </>
                )}
                {/* Other tabs follow similar mock patterns */}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', height: 54, borderRadius: 16, paddingHorizontal: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, color: '#fff', fontSize: 15 },
    tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    tab: { paddingVertical: 15, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: ACCENT },
    tabText: { color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' },
    activeTabText: { color: '#fff' },
    scrollArea: { padding: 20 },
    sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 20 },
    trendingTag: { backgroundColor: 'rgba(255,77,166,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,77,166,0.2)' },
    tagText: { color: ACCENT, fontWeight: 'bold' },
    personRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.03)', padding: 15, borderRadius: 20 },
    personAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1e1e3f', marginRight: 15 },
    personInfo: { flex: 1 },
    personName: { color: '#fff', fontWeight: 'bold' },
    personHandle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
    followBtn: { backgroundColor: ACCENT, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 15 },
    followBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});

