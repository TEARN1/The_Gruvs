import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, useWindowDimensions, RefreshControl, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, ACCENT, GOLD } from '../../theme';

const { width: screenWidth } = Dimensions.get('window');

export default function WalletScreen({ navigation }) {
    const { width } = useWindowDimensions();
    const [mode, setMode] = useState('tickets'); // 'tickets' or 'scan'
    const [refreshing, setRefreshing] = useState(false);

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
            <View style={[styles.header, { paddingHorizontal: width < 600 ? 12 : 20 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={width < 600 ? 20 : 24} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: width < 600 ? 14 : 16 }]}>MY WALLET</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="close" size={width < 600 ? 20 : 24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.walletTabs}>
                <TouchableOpacity style={[styles.walletTab, mode === 'tickets' && styles.activeWalletTab]} onPress={() => setMode('tickets')}>
                    <Text style={[styles.walletTabText, mode === 'tickets' && { color: ACCENT }]}>TICKETS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.walletTab, mode === 'scan' && styles.activeWalletTab]} onPress={() => setMode('scan')}>
                    <Text style={[styles.walletTabText, mode === 'scan' && { color: ACCENT }]}>SCANNER</Text>
                </TouchableOpacity>
            </View>

            {mode === 'tickets' ? (
                <ScrollView 
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.ticketContent}
                >
                    <View style={[styles.balanceCard, { marginHorizontal: width < 600 ? 12 : 25, padding: width < 600 ? 20 : 35 }]}>
                        <Text style={[styles.balanceLabel, { fontSize: width < 600 ? 12 : 14 }]}>Total Vibe Points</Text>
                        <Text style={[styles.balanceValue, { fontSize: width < 600 ? 36 : 48 }]}>12,450</Text>
                        <Text style={[styles.balanceEth, { fontSize: width < 600 ? 14 : 16 }]}>≈ 0.45 ETH</Text>
                    </View>

                    <Text style={[styles.ticketSectionTitle, { marginLeft: width < 600 ? 12 : 25, fontSize: width < 600 ? 16 : 18 }]}>My Tickets</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.ticketScroll, { paddingHorizontal: width < 600 ? 12 : 25 }]}>
                        {tickets.map(ticket => (
                            <View key={ticket.id} style={styles.ticketCard}>
                                <View style={styles.ticketMain}>
                                    <Text style={styles.ticketEvent}>{ticket.event}</Text>
                                    <Text style={styles.ticketDate}>{ticket.date} • {ticket.time}</Text>
                                </View>
                                <View style={styles.qrPlaceholder}>
                                    <MaterialCommunityIcons name="qrcode-scan" size={30} color="rgba(0,0,0,0.2)" />
                                    <Text style={styles.qrCodeText}>{ticket.code}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
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
                    <TouchableOpacity style={styles.bigBtn} onPress={() => Alert.alert('Simulated', 'Scanning ticket... VIP access granted!')}>
                        <Text style={styles.bigBtnText}>SIMULATE SCAN</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: screenWidth < 600 ? 60 : 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerBtn: { width: screenWidth < 600 ? 36 : 40, height: screenWidth < 600 ? 36 : 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontWeight: '900', letterSpacing: 2, flex: 1, textAlign: 'center' },
    walletTabs: { flexDirection: 'row', paddingHorizontal: screenWidth < 600 ? 12 : 25, marginTop: screenWidth < 600 ? 12 : 20 },
    walletTab: { paddingBottom: 15, marginRight: screenWidth < 600 ? 12 : 25, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeWalletTab: { borderBottomColor: ACCENT },
    walletTabText: { color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: screenWidth < 600 ? 11 : 13 },
    ticketContent: { flexGrow: 1, paddingBottom: 30 },
    balanceCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    balanceLabel: { color: 'rgba(255,255,255,0.4)', marginBottom: 10, fontWeight: '600', fontSize: screenWidth < 600 ? 12 : 14 },
    balanceValue: { color: '#fff', fontWeight: '900', fontSize: screenWidth < 600 ? 36 : 48 },
    balanceEth: { color: GOLD, marginTop: 8, fontWeight: 'bold', fontSize: screenWidth < 600 ? 14 : 16 },
    ticketSectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 15, fontSize: screenWidth < 600 ? 16 : 18 },
    ticketScroll: { gap: 15 },
    ticketCard: { width: screenWidth < 600 ? 280 : 320, height: screenWidth < 600 ? 160 : 180, backgroundColor: '#fff', borderRadius: 25, flexDirection: 'row', overflow: 'hidden' },
    ticketMain: { flex: 1, padding: screenWidth < 600 ? 15 : 25, justifyContent: 'center' },
    ticketEvent: { color: '#000', fontSize: screenWidth < 600 ? 16 : 18, fontWeight: 'bold', marginBottom: 8 },
    ticketDate: { color: 'rgba(0,0,0,0.5)', fontSize: screenWidth < 600 ? 11 : 13 },
    qrPlaceholder: { width: screenWidth < 600 ? 90 : 110, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#e2e8f0', borderStyle: 'dashed' },
    qrCodeText: { color: '#000', fontSize: 8, fontWeight: 'bold', marginTop: 10, opacity: 0.3 },
    scannerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 50 },
    scannerWindow: { width: screenWidth < 600 ? 250 : 300, height: screenWidth < 600 ? 250 : 300, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.7)', position: 'relative', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    scannerCornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#fff', borderTopLeftRadius: 40 },
    scannerCornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#fff', borderTopRightRadius: 40 },
    scannerCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#fff', borderBottomLeftRadius: 40 },
    scannerCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#fff', borderBottomRightRadius: 40 },
    scannerLine: { width: '80%', height: 2, borderRadius: 1, backgroundColor: ACCENT },
    scannerInstructions: { color: 'rgba(255,255,255,0.8)', fontSize: screenWidth < 600 ? 12 : 14, textAlign: 'center', paddingHorizontal: 20 },
    bigBtn: { backgroundColor: ACCENT, paddingHorizontal: 40, paddingVertical: screenWidth < 600 ? 12 : 18, borderRadius: 20, marginTop: 60, width: '80%', alignItems: 'center' },
    bigBtnText: { color: '#fff', fontWeight: '900', fontSize: screenWidth < 600 ? 14 : 16 },
});

