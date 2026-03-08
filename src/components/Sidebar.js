import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';

const NAV_ITEMS = [
    { id: 'feed', label: 'Feed', icon: '🏠' },
    { id: 'explore', label: 'Explore', icon: '🔍' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'happenings', label: 'Happenings', icon: '⚡' },
    { id: 'drops', label: 'Drops', icon: '🎁' },
    { id: 'community', label: 'Community', icon: '👥' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'wallet', label: 'Wallet', icon: '👛' },
    { id: 'add_event', label: 'Add Event', icon: '➕', special: true },
];

export function Sidebar({ activeScreen, onNavigate, onLogout, theme, isCollapsed }) {
    return (
        <View style={[
            styles.container,
            { backgroundColor: theme.sidebarBg || '#4b168c' },
            isCollapsed && styles.collapsedContainer
        ]}>
            <View style={styles.logoRow}>
                <Text style={styles.logoIcon}>G</Text>
                {!isCollapsed && <Text style={styles.logoText}>The Gruv</Text>}
            </View>

            <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
                {NAV_ITEMS.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[
                            styles.navItem,
                            activeScreen === item.id && [styles.activeNavItem, { backgroundColor: '#a855f7' }],
                            item.special && styles.specialNavItem
                        ]}
                        onPress={() => onNavigate(item.id)}
                    >
                        <Text style={[styles.navIcon, item.special && styles.specialNavIcon]}>{item.icon}</Text>
                        {!isCollapsed && (
                            <Text style={[styles.navLabel, activeScreen === item.id && styles.activeNavLabel]}>
                                {item.label}
                            </Text>
                        )}
                    </TouchableOpacity>
                ))}

                {!isCollapsed && (
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
                )}

                <TouchableOpacity style={styles.profileIndicator} onPress={() => onNavigate('profile')}>
                    <View style={[styles.dot, { backgroundColor: '#a855f7' }]} />
                    {!isCollapsed && <Text style={styles.profileIndicatorText}>Purple Haze</Text>}
                </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={[styles.logoutBtn, isCollapsed && styles.collapsedLogoutBtn]} onPress={onLogout}>
                <Text style={styles.logoutIcon}>←</Text>
                {!isCollapsed && <Text style={styles.logoutText}>Logout</Text>}
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
        transition: 'width 0.3s ease',
    },
    collapsedContainer: {
        width: 100,
        paddingHorizontal: 15,
        alignItems: 'center',
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
        marginLeft: 10,
        gap: 12,
    },
    logoIcon: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        backgroundColor: 'rgba(255,255,255,0.1)',
        width: 50,
        height: 50,
        borderRadius: 15,
        textAlign: 'center',
        lineHeight: 50,
    },
    logoText: {
        fontSize: 22,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1,
    },
    navContainer: {
        flex: 1,
        width: '100%',
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderRadius: 18,
        marginBottom: 8,
    },
    specialNavItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginTop: 20,
    },
    specialNavIcon: {
        color: '#a855f7',
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
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
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
        fontWeight: '700',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff4d4d',
        borderRadius: 18,
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginTop: 20,
        width: '100%',
    },
    collapsedLogoutBtn: {
        paddingHorizontal: 0,
        justifyContent: 'center',
        width: 50,
        height: 50,
        borderRadius: 15,
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
