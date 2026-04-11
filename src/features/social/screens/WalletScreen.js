import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, useWindowDimensions, RefreshControl, Dimensions, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME, ACCENT, GOLD, SHADOWS, SPACING } from '../../../core/theme';

const { width: screenWidth } = Dimensions.get('window');

export default function VaultScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const isPC = Platform.OS === 'web' && width > 768;
    const [mode, setMode] = useState('tickets'); // 'tickets' or 'scan'
    const [refreshing, setRefreshing] = useState(false);

    const triggerHaptic = (type = 'light') => {
        if (Platform.OS !== 'web') {
            if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1500);
    };
    const tickets = [
        { id: '1', event: 'Joburg Rooftop Jazz', date: 'March 15, 2026', time: '19:00', code: 'GRV-JAZZ-X9' },
        { id: '2', event: 'Cape Town Gaming Expo', date: 'April 02, 2026', time: '10:00', code: 'GRV-GAME-L2' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={[styles.contentWrapper, isPC && styles.pcWrapper]}>
                <View style={[styles.header, { paddingHorizontal: width < 600 ? 12 : 20 }]}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.headerBtn}
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                    >
                        <Ionicons name="arrow-back" size={width < 600 ? 20 : 24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { fontSize: width < 600 ? 14 : 16 }]} accessibilityRole="header">THE VAULT</Text>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.headerBtn}
                        accessibilityLabel="Close vault"
                        accessibilityRole="button"
                    >
                        <Ionicons name="close" size={width < 600 ? 20 : 24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.walletTabs} accessibilityRole="tablist">
                    <TouchableOpacity
                        style={[styles.vaultTab, mode === 'tickets' && styles.activeVaultTab]}
                        onPress={() => { triggerHaptic('light'); setMode('tickets'); }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === 'tickets' }}
                        accessibilityLabel="My Tickets"
                    >
                        <Text style={[styles.vaultTabText, mode === 'tickets' && { color: ACCENT }]}>TICKETS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.vaultTab, mode === 'scan' && styles.activeVaultTab]}
                        onPress={() => { triggerHaptic('light'); setMode('scan'); }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === 'scan' }}
                        accessibilityLabel="QR Scanner"
                    >
                        <Text style={[styles.vaultTabText, mode === 'scan' && { color: ACCENT }]}>SCANNER</Text>
                    </TouchableOpacity>
                </View>

                {mode === 'tickets' ? (
                    <ScrollView
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.ticketContent}
                    >
                        <View
                            style={[styles.balanceCard, { marginHorizontal: width < 600 ? 12 : 25, padding: width < 600 ? 20 : 35 }]}
                            accessibilityLabel={`Your total balance is 12,450 Vibe Points, approximately 0.45 Ethereum`}
                        >
                            <View style={styles.glassBackground} />
                            <Text style={[styles.balanceLabel, { fontSize: width < 600 ? 12 : 14 }]}>Total Vibe Points</Text>
                            <Text style={[styles.balanceValue, { fontSize: width < 600 ? 36 : 48 }]}>12,450</Text>
                            <View style={styles.ethRow} aria-hidden="true">
                                <MaterialCommunityIcons name="ethereum" size={16} color={GOLD} />
                                <Text style={[styles.balanceEth, { fontSize: width < 600 ? 14 : 16 }]}>≈ 0.45 ETH</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.topUpBtn}
                                onPress={() => triggerHaptic('medium')}
                                accessibilityLabel="Top up vault balance"
                                accessibilityRole="button"
                            >
                                <Text style={styles.topUpBtnText}>TOP UP VAULT</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.ticketSectionTitle, { marginLeft: width < 600 ? 12 : 25, fontSize: width < 600 ? 16 : 18 }]}>My Tickets</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={[styles.ticketScroll, { paddingHorizontal: width < 600 ? 12 : 25 }]}
                            accessibilityLabel="Horizontal list of your tickets"
                        >
                            {tickets.map(ticket => (
                                <View
                                    key={ticket.id}
                                    style={styles.ticketCard}
                                    accessibilityLabel={`Ticket for ${ticket.event} on ${ticket.date} at ${ticket.time}. Ticket code is ${ticket.code}`}
                                    accessibilityRole="none"
                                >
                                    <View style={styles.ticketMain}>
                                        <Text style={styles.ticketEvent}>{ticket.event}</Text>
                                        <Text style={styles.ticketDate}>{ticket.date} • {ticket.time}</Text>
                                        <View style={styles.ticketTypeTag}>
                                            <Text style={styles.ticketTypeText}>GENERAL ACCESS</Text>
                                        </View>
                                    </View>
                                    <View style={styles.qrPlaceholder} aria-hidden="true">
                                        <MaterialCommunityIcons name="qrcode-scan" size={30} color="rgba(0,0,0,0.6)" />
                                        <Text style={styles.qrCodeText}>{ticket.code}</Text>
                                    </View>
                                    <View style={styles.ticketStubHoles} aria-hidden="true">
                                        <View style={styles.stubHoleTop} />
                                        <View style={styles.stubHoleBottom} />
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.transactionSection}>
                            <Text style={[styles.ticketSectionTitle, { marginLeft: width < 600 ? 0 : 0, fontSize: width < 600 ? 16 : 18 }]}>Recent Activity</Text>
                            {[1, 2, 3].map(i => (
                                <View key={i} style={styles.transactionItem}>
                                    <View style={styles.txIcon}>
                                        <Ionicons name={i % 2 === 0 ? "arrow-down" : "arrow-up"} size={16} color={i % 2 === 0 ? "#10b981" : ACCENT} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.txTitle}>{i % 2 === 0 ? 'Received' : 'Ticket Purchase'}</Text>
                                        <Text style={styles.txDate}>March {10 + i}, 2026</Text>
                                    </View>
                                    <Text style={[styles.txAmount, { color: i % 2 === 0 ? "#10b981" : "#fff" }]}>
                                        {i % 2 === 0 ? '+' : '-'}{400 * i} VP
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.scannerContainer}>
                        <View style={styles.scannerWindow}>
                            <View style={styles.scannerCornerTL} />
                            <View style={styles.scannerCornerTR} />
                            <View style={styles.scannerCornerBL} />
                            <View style={styles.scannerCornerBR} />
                            <View style={[styles.scannerLine, { backgroundColor: ACCENT }]} />
                            <Text style={styles.scannerInstructions}>Align QR code within the frame</Text>
                        </View>
                        <TouchableOpacity style={styles.bigBtn} onPress={() => { triggerHaptic('success'); Alert.alert('Simulated', 'Scanning ticket... VIP access granted!'); }}>
                            <Text style={styles.bigBtnText}>SIMULATE SCAN</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    contentWrapper: { flex: 1 },
    pcWrapper: { maxWidth: 800, alignSelf: 'center', width: '100%', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: screenWidth < 600 ? 60 : 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerBtn: { width: screenWidth < 600 ? 36 : 40, height: screenWidth < 600 ? 36 : 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontWeight: '900', letterSpacing: 4, flex: 1, textAlign: 'center' },
    walletTabs: { flexDirection: 'row', paddingHorizontal: screenWidth < 600 ? 12 : 25, marginTop: screenWidth < 600 ? 12 : 20, marginBottom: 10 },
    vaultTab: { paddingBottom: 15, marginRight: screenWidth < 600 ? 12 : 25, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeVaultTab: { borderBottomColor: ACCENT },
    vaultTabText: { color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: screenWidth < 600 ? 11 : 13, letterSpacing: 1 },
    ticketContent: { flexGrow: 1, paddingBottom: 30 },
    balanceCard: { backgroundColor: 'rgba(20, 20, 40, 0.95)', borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden', position: 'relative' },
    glassBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 77, 166, 0.03)' },
    balanceLabel: { color: 'rgba(255,255,255,0.4)', marginBottom: 10, fontWeight: '700', fontSize: screenWidth < 600 ? 12 : 14, letterSpacing: 1 },
    balanceValue: { color: '#fff', fontWeight: '900', fontSize: screenWidth < 600 ? 36 : 48, textShadowColor: 'rgba(255, 77, 166, 0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
    ethRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    balanceEth: { color: GOLD, fontWeight: '800', fontSize: screenWidth < 600 ? 14 : 16 },
    topUpBtn: { marginTop: 25, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    topUpBtnText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    ticketSectionTitle: { color: '#fff', fontWeight: '900', marginBottom: 15, marginTop: 30, fontSize: screenWidth < 600 ? 16 : 18, letterSpacing: 1 },
    ticketScroll: { gap: 15, paddingBottom: 10 },
    ticketCard: { width: screenWidth < 600 ? 300 : 340, height: screenWidth < 600 ? 170 : 190, backgroundColor: '#fff', borderRadius: 25, flexDirection: 'row', overflow: 'hidden', ...SHADOWS.soft },
    ticketMain: { flex: 1, padding: screenWidth < 600 ? 18 : 25, justifyContent: 'center' },
    ticketEvent: { color: '#000', fontSize: screenWidth < 600 ? 18 : 20, fontWeight: '900', marginBottom: 6 },
    ticketDate: { color: 'rgba(0,0,0,0.5)', fontSize: screenWidth < 600 ? 12 : 14, fontWeight: '600' },
    ticketTypeTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 12 },
    ticketTypeText: { color: '#000', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    qrPlaceholder: { width: screenWidth < 600 ? 90 : 110, backgroundColor: '#fdfdfd', justifyContent: 'center', alignItems: 'center', borderLeftWidth: 2, borderLeftColor: '#f0f0f0', borderStyle: 'dashed' },
    qrCodeText: { color: '#000', fontSize: 9, fontWeight: 'bold', marginTop: 12, opacity: 0.4 },
    ticketStubHoles: { position: 'absolute', left: screenWidth < 600 ? 200 : 220, top: 0, bottom: 0, justifyContent: 'space-between', alignItems: 'center' },
    stubHoleTop: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#050514', marginTop: -10 },
    stubHoleBottom: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#050514', marginBottom: -10 },
    transactionSection: { paddingHorizontal: 25, marginTop: 10 },
    transactionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    txIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    txTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
    txDate: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
    txAmount: { fontWeight: '900', fontSize: 14 },
    scannerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 50 },
    scannerWindow: { width: screenWidth < 600 ? 280 : 320, height: screenWidth < 600 ? 280 : 320, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.7)', position: 'relative', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    scannerCornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: ACCENT, borderTopLeftRadius: 40 },
    scannerCornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: ACCENT, borderTopRightRadius: 40 },
    scannerCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: ACCENT, borderBottomLeftRadius: 40 },
    scannerCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: ACCENT, borderBottomRightRadius: 40 },
    scannerLine: { width: '85%', height: 2, borderRadius: 1, backgroundColor: ACCENT, ...SHADOWS.glow },
    scannerInstructions: { color: 'rgba(255,255,255,0.8)', fontSize: screenWidth < 600 ? 12 : 14, textAlign: 'center', paddingHorizontal: 30, marginTop: 20 },
    bigBtn: { backgroundColor: ACCENT, paddingHorizontal: 40, paddingVertical: screenWidth < 600 ? 15 : 20, borderRadius: 20, marginTop: 60, width: '85%', alignItems: 'center', ...SHADOWS.glow },
    bigBtnText: { color: '#fff', fontWeight: '900', fontSize: screenWidth < 600 ? 14 : 16, letterSpacing: 2 },
});

