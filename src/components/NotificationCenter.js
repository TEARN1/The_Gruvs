import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';

const MOCK_NOTIFICATIONS = [
    { id: '1', type: 'like', user: 'Sarah', target: 'Jazz Rooftop', time: '2m' },
    { id: '2', type: 'follow', user: 'Alex', time: '15m' },
    { id: '3', type: 'mention', user: 'Tribe Bot', text: 'New Tribe alert: "Amapiano Kings"', time: '1h' },
    { id: '4', type: 'rsvp', user: 'Jessica', target: 'Gaming Expo', time: '3h' },
];

export function NotificationCenter({ visible, onClose, theme }) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={[styles.content, { backgroundColor: 'rgba(30, 10, 93, 0.95)' }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>ACTIVITY</Text>
                        <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.list}>
                        {MOCK_NOTIFICATIONS.map(n => (
                            <View key={n.id} style={styles.notiItem}>
                                <View style={styles.dot} />
                                <View style={styles.textRow}>
                                    <Text style={styles.notiText}>
                                        <Text style={{ fontWeight: 'bold', color: theme.accent }}>{n.user}</Text>
                                        {n.type === 'like' && ` liked your vibe "${n.target}"`}
                                        {n.type === 'follow' && ` started following you`}
                                        {n.type === 'mention' && ` mentioned you: ${n.text}`}
                                        {n.type === 'rsvp' && ` RSVP'd to "${n.target}"`}
                                    </Text>
                                    <Text style={styles.time}>{n.time}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 80, paddingRight: 20 },
    content: { width: 320, maxHeight: 500, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    title: { color: '#fff', fontWeight: 'bold', letterSpacing: 2 },
    close: { color: 'rgba(255,255,255,0.5)', fontSize: 18 },
    list: { padding: 15 },
    notiItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4da6' },
    textRow: { flex: 1 },
    notiText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20 },
    time: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }
});
