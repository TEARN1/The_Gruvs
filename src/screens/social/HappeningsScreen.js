import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, useWindowDimensions, RefreshControl, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, ACCENT } from '../../theme';
import { useStore } from '../../state/useStore';
import CreateEventModal from '../../components/CreateEventModal';

const { width: screenWidth } = Dimensions.get('window');

export default function HappeningsScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const [refreshing, setRefreshing] = useState(false);
    const { pulseEvents, addEventModalVisible, setAddEventModalVisible } = useStore();

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1500);
    };
    
    const defaultPulseEvents = [
        { id: '0', time: 'LIVE', title: 'Main Stage: Black Coffee', status: 'DJ set started 10m ago', color: '#ff4da6', media: [] },
        { id: '2', time: '20:00', title: 'VIP Lounge: Mixology Workshop', status: 'Starts in 25m', color: ACCENT, media: [] },
        { id: '3', time: '21:30', title: 'Rooftop: Fireworks Display', status: 'Scheduled', color: '#ffcc00', media: [] },
        { id: '4', time: '22:00', title: 'Afterparty: Deep House Sessions', status: 'Tickets selling fast', color: '#00f2ff', media: [] },
    ];
    
    // Combine user-created events with defaults
    const allEvents = [...pulseEvents, ...defaultPulseEvents].sort((a, b) => {
        if (a.time === 'LIVE') return -1;
        if (b.time === 'LIVE') return 1;
        return 0;
    });

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={[styles.header, { paddingHorizontal: width < 600 ? 12 : 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={width < 600 ? 20 : 24} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: width < 600 ? 14 : 16 }]}>PULSE TIMELINE</Text>
                <TouchableOpacity onPress={() => setAddEventModalVisible(true)} style={styles.headerBtn}>
                    <Ionicons name="add-circle" size={width < 600 ? 20 : 24} color={ACCENT} />
                </TouchableOpacity>
            </View>
            
            <ScrollView 
                style={styles.scrollContent} 
                contentContainerStyle={[styles.scrollPadding, { paddingHorizontal: width < 600 ? 12 : 25 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />}
            >
                <Text style={styles.sectionTitle}>Tonight's Flow</Text>
                {allEvents.map((item, idx) => (
                    <View key={item.id} style={styles.pulseItem}>
                        <View style={styles.pulseTimeCol}>
                            <Text style={[styles.pulseTime, item.time === 'LIVE' && { color: '#ef4444', fontWeight: '900' }]}>{item.time}</Text>
                            {idx !== allEvents.length - 1 && <View style={styles.pulseLinkLine} />}
                        </View>
                        <TouchableOpacity style={[styles.pulseCard, { borderLeftColor: item.color }]}>
                            {/* Media Preview */}
                            {item.media && item.media.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                                    {item.media.map((media) => (
                                        <View key={media.id} style={styles.mediaThumb}>
                                            {media.type === 'photo' && (
                                                <Image source={{ uri: media.uri }} style={styles.mediaImage} />
                                            )}
                                            {media.type === 'video' && (
                                                <View style={[styles.mediaImage, { backgroundColor: '#1a1d2e', justifyContent: 'center', alignItems: 'center' }]}>
                                                    <Ionicons name="play-circle" size={24} color={ACCENT} />
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                            
                            {/* Event Info */}
                            <Text style={styles.pulseTitle}>{item.title}</Text>
                            {item.description && <Text style={styles.pulseDesc}>{item.description}</Text>}
                            {item.location && (
                                <View style={styles.locationRow}>
                                    <Ionicons name="location" size={12} color={ACCENT} />
                                    <Text style={styles.locationText}>{item.location}</Text>
                                </View>
                            )}
                            <Text style={styles.pulseStatus}>{item.status}</Text>
                            {item.time === 'LIVE' && <View style={styles.liveIndicator} />}
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
            
            {/* Create Event Modal */}
            <CreateEventModal 
                visible={addEventModalVisible} 
                onClose={() => setAddEventModalVisible(false)} 
            />
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: screenWidth < 600 ? 60 : 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerBtn: { width: screenWidth < 600 ? 36 : 40, height: screenWidth < 600 ? 36 : 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontWeight: '900', letterSpacing: 2, flex: 1, textAlign: 'center' },
    scrollContent: { flex: 1 },
    scrollPadding: { paddingVertical: screenWidth < 600 ? 12 : 25 },
    sectionTitle: { color: '#fff', fontSize: screenWidth < 600 ? 18 : 22, fontWeight: '800', marginBottom: screenWidth < 600 ? 15 : 25 },
    pulseItem: { flexDirection: 'row', marginBottom: screenWidth < 600 ? 15 : 25, minHeight: screenWidth < 600 ? 60 : 80 },
    pulseTimeCol: { width: screenWidth < 600 ? 45 : 60, alignItems: 'center', paddingTop: 8 },
    pulseTime: { color: 'rgba(255,255,255,0.4)', fontSize: screenWidth < 600 ? 10 : 12, fontWeight: 'bold' },
    pulseLinkLine: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 8, borderRadius: 1 },
    pulseCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: screenWidth < 600 ? 12 : 20, borderLeftWidth: 3, marginLeft: screenWidth < 600 ? 8 : 15, position: 'relative' },
    pulseTitle: { color: '#fff', fontSize: screenWidth < 600 ? 14 : 16, fontWeight: 'bold', marginBottom: 4 },
    pulseDesc: { color: 'rgba(255,255,255,0.7)', fontSize: screenWidth < 600 ? 11 : 13, marginBottom: 8 },
    pulseStatus: { color: 'rgba(255,255,255,0.5)', fontSize: screenWidth < 600 ? 11 : 13 },
    liveIndicator: { position: 'absolute', top: 18, right: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
    mediaScroll: { marginBottom: 12, height: 80 },
    mediaThumb: { marginRight: 8, borderRadius: 10, overflow: 'hidden' },
    mediaImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#1a1d2e' },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 },
    locationText: { color: '#ff4da6', fontSize: screenWidth < 600 ? 10 : 12, fontWeight: '600' },
});

