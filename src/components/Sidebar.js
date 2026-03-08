import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';

const NAV_ITEMS = [
    { id: 'feed', label: 'Feed', icon: '🏠' },
    { id: 'explore', label: 'Explore', icon: '🔍' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'happenings', label: 'Happenings', icon: '⚡' },
    { id: 'drops', label: 'Drops', icon: '🎁' },
];

export function Sidebar({ activeScreen, onNavigate, onLogout, theme }) {
    return (
        <View style={[styles.container, { backgroundColor: theme.sidebarBg || '#4b168c' }]}>
            <Text style={styles.logo}>The Gruv</Text>

            <ScrollView style={styles.navContainer}>
                {NAV_ITEMS.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[
                            styles.navItem,
                            activeScreen === item.id && [styles.activeNavItem, { backgroundColor: 'rgba(255,255,255,0.1)' }]
                        ]}
                        onPress={() => onNavigate(item.id)}
                    >
                        <Text style={styles.navIcon}>{item.icon}</Text>
                        <Text style={[styles.navLabel, activeScreen === item.id && styles.activeNavLabel]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}

                <View style={styles.sponsoredCard}>
                    <Text style={styles.sponsoredLabel}>Sponsored</Text>
                    <View style={styles.brandRow}>
                        <View style={styles.brandAvatar} />
                        <Text style={styles.brandName}>BrandName</Text>
                    </View>
                    <Text style={styles.sponsoredDesc}>Check out our new collection!</Text>
                    <TouchableOpacity style={[styles.viewBtn, { backgroundColor: theme.accent }]}>
                        <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.profileIndicator}>
                    <View style={[styles.dot, { backgroundColor: '#a855f7' }]} />
                    <Text style={styles.profileIndicatorText}>Purple Haze</Text>
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                <Text style={styles.logoutIcon}>←</Text>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 280,
        height: '100%',
        paddingVertical: 30,
        paddingHorizontal: 20,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.1)',
    },
    logo: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 40,
        marginLeft: 10,
    },
    navContainer: {
        flex: 1,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 15,
        marginBottom: 8,
    },
    activeNavItem: {
        // backgroundColor matches parent scrollview or design
    },
    navIcon: {
        fontSize: 20,
        marginRight: 15,
        color: '#fff',
    },
    navLabel: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.7,
        fontWeight: '600',
    },
    activeNavLabel: {
        opacity: 1,
    },
    sponsoredCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 20,
        marginTop: 30,
        marginBottom: 20,
    },
    sponsoredLabel: {
        fontSize: 10,
        color: '#fff',
        opacity: 0.5,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    brandAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#555',
        marginRight: 10,
    },
    brandName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    sponsoredDesc: {
        color: '#fff',
        fontSize: 12,
        opacity: 0.8,
        marginBottom: 15,
    },
    viewBtn: {
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
    },
    viewBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    profileIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginTop: 10,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    profileIndicatorText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef4444',
        borderRadius: 18,
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginTop: 20,
    },
    logoutIcon: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 10,
    },
    logoutText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
