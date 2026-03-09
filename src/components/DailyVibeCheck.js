import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export function DailyVibeCheck({ progress, theme, onViewLeaderboard }) {
    const quests = [
        { id: 'likes', label: 'Like 3 Events', current: progress.likes, total: 3 },
        { id: 'share', label: 'Share a Vibe', current: progress.shares, total: 1 },
        { id: 'rsvp', label: 'RSVP to an Event', current: progress.rsvps, total: 1 },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={styles.icon}>⚡</Text>
                    <Text style={styles.title}>Daily Vibe Check</Text>
                </View>
                <View style={styles.timerBadge}>
                    <Text style={styles.timerText}>Resets in 12h</Text>
                </View>
            </View>

            <View style={styles.questList}>
                {quests.map(quest => (
                    <TouchableOpacity key={quest.id} style={styles.questItem} onPress={() => onQuestClick(quest.id)}>
                        <View style={styles.questInfo}>
                            <Text style={styles.questLabel}>{quest.label}</Text>
                            <Text style={styles.questProgress}>{quest.current}/{quest.total}</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${Math.min((quest.current / quest.total) * 100, 100)}%` }
                                ]}
                            />
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.leaderboardBtn} onPress={onViewLeaderboard}>
                <Text style={styles.leaderboardText}>📊 View Leaderboard</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(75, 22, 140, 0.3)',
        borderRadius: 25,
        padding: 20,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    icon: { fontSize: 20 },
    title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    timerBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    timerText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold' },
    questList: { gap: 15, marginBottom: 20 },
    questItem: { gap: 8 },
    questInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    questLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
    questProgress: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    progressBar: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#a855f7',
        borderRadius: 3,
    },
    leaderboardBtn: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 12,
        borderRadius: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    leaderboardText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
