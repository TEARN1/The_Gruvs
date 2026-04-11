import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

export function LevelUpOverlay({ visible, onDismiss, theme }) {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.accent }]}>
                    <Text style={styles.emoji}>🆙</Text>
                    <Text style={[styles.title, { color: theme.accent }]}>LEVEL UP!</Text>
                    <Text style={styles.sub}>You've mastered the Daily Vibe Check.</Text>

                    <View style={styles.rewardRow}>
                        <Text style={styles.rewardText}>+500 VP</Text>
                        <Text style={styles.rewardText}>🔓 VIP Badge</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.accent }]}
                        onPress={onDismiss}
                    >
                        <Text style={styles.buttonText}>LFG! 🚀</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    card: { width: '85%', maxWidth: 400, borderRadius: 30, padding: 40, alignItems: 'center', borderWidth: 2 },
    emoji: { fontSize: 50, marginBottom: 20 },
    title: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
    sub: { color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 10, opacity: 0.8 },
    rewardRow: { flexDirection: 'row', gap: 20, marginTop: 30 },
    rewardText: { color: '#fff', fontWeight: 'bold', fontSize: 18, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
    button: { marginTop: 40, paddingHorizontal: 40, paddingVertical: 15, borderRadius: 20 },
    buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
