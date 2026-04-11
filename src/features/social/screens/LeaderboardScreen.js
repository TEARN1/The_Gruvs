import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, useWindowDimensions, RefreshControl, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, ACCENT, GOLD } from '../../../core/theme';

const { width: screenWidth } = Dimensions.get('window');

export default function LeaderboardScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1500);
    };
    const top3 = [
        { id: '1', name: 'Sarah', points: '3,120', rank: 1, avatar: '👑' },
        { id: '2', name: 'Alex', points: '2,450', rank: 2, avatar: '🥈' },
        { id: '3', name: 'Mike', points: '1,890', rank: 3, avatar: '🥉' },
    ];

    const users = [
        { id: '4', name: 'Jordan', points: '1,200', rank: 4 },
        { id: '5', name: 'Casey', points: '1,150', rank: 5 },
        { id: '6', name: 'Taylor', points: '980', rank: 6 },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={styles.contentWrapper}>
                <View style={[styles.header, { paddingHorizontal: width < 600 ? 12 : 20 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Ionicons name="arrow-back" size={width < 600 ? 20 : 24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { fontSize: width < 600 ? 14 : 16 }]}>LEADERBOARD</Text>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Ionicons name="close" size={width < 600 ? 20 : 24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />}
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                <View style={[styles.podiumContainer, { marginVertical: width < 600 ? 15 : 30 }]}>
                    {/* Reordered for visual podium (2, 1, 3) */}
                    {[top3[1], top3[0], top3[2]].map(user => (
                        <View key={user.id} style={[styles.podiumItem, user.rank === 1 && styles.firstPlace]}>
                            <Text style={styles.rankAvatar}>{user.avatar}</Text>
                            <Text style={styles.podiumName}>{user.name}</Text>
                            <Text style={styles.podiumPoints}>{user.points} pts</Text>
                        </View>
                    ))}
                </View>

                <View style={[styles.listContainer, { paddingHorizontal: width < 600 ? 12 : 20 }]}>
                    {users.map(user => (
                        <View key={user.id} style={styles.boardItem}>
                            <Text style={styles.itemRank}>{user.rank}</Text>
                            <View style={styles.itemAvatarSmall} />
                            <Text style={styles.itemName}>{user.name}</Text>
                            <Text style={styles.itemPoints}>{user.points}</Text>
                        </View>
                    ))}
                </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    contentWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: 700,
        alignSelf: 'center',
        borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
        borderRightWidth: Platform.OS === 'web' ? 1 : 0,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerBtn: { width: screenWidth < 600 ? 36 : 40, height: screenWidth < 600 ? 36 : 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontWeight: '900', letterSpacing: 2, flex: 1, textAlign: 'center' },
    podiumContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: screenWidth < 600 ? 8 : 15, paddingHorizontal: screenWidth < 600 ? 12 : 20 },
    podiumItem: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: screenWidth < 600 ? 10 : 15, borderRadius: 20, width: screenWidth < 600 ? 70 : 100 },
    firstPlace: { height: screenWidth < 600 ? 120 : 160, backgroundColor: 'rgba(255,77,166,0.1)', borderColor: ACCENT, borderWidth: 1, justifyContent: 'center' },
    rankAvatar: { fontSize: screenWidth < 600 ? 28 : 40, marginBottom: 8 },
    podiumName: { color: '#fff', fontWeight: 'bold', fontSize: screenWidth < 600 ? 12 : 14 },
    podiumPoints: { color: 'rgba(255,255,255,0.4)', fontSize: screenWidth < 600 ? 10 : 12, marginTop: 4 },
    listContainer: { flex: 1, gap: screenWidth < 600 ? 8 : 10, paddingVertical: 15 },
    boardItem: { flexDirection: 'row', alignItems: 'center', padding: screenWidth < 600 ? 10 : 15, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 15, marginBottom: screenWidth < 600 ? 0 : 0 },
    itemRank: { color: 'rgba(255,255,255,0.3)', width: 30, fontWeight: 'bold', fontSize: screenWidth < 600 ? 12 : 14 },
    itemAvatarSmall: { width: screenWidth < 600 ? 32 : 40, height: screenWidth < 600 ? 32 : 40, borderRadius: 12, backgroundColor: '#1e1e3f', marginRight: screenWidth < 600 ? 10 : 15 },
    itemName: { flex: 1, color: '#fff', fontWeight: '600', fontSize: screenWidth < 600 ? 13 : 15 },
    itemPoints: { color: ACCENT, fontWeight: 'bold', fontSize: screenWidth < 600 ? 12 : 14 },
});

