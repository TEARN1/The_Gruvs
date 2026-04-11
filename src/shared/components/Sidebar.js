import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Platform, Animated } from 'react-native';
import { ACCENT, THEME, GOLD } from '../../core/theme';

const NAV_ITEMS = [
    { id: 'feed', label: 'Pulse', icon: '🏠' },
    { id: 'explore', label: 'Explore', icon: '🔍' },
    { id: 'messages', label: 'Waves', icon: '💬' },
    { id: 'happenings', label: 'Happenings', icon: '⚡' },
    { id: 'drops', label: 'Drops', icon: '🎁' },
    { id: 'community', label: 'Community', icon: '👥' },
    { id: 'wallet', label: 'Vault', icon: '👛' },
    { id: 'add_event', label: 'Host Event', icon: '➕', special: true },
];

export function Sidebar({ activeScreen, onNavigate, onLogout, theme, isCollapsed }) {
    const [hoveredItem, setHoveredItem] = React.useState(null);
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const handleMouseEnter = (id) => {
        if (Platform.OS === 'web') {
            setHoveredItem(id);
            Animated.spring(scaleAnim, {
                toValue: 1.05,
                useNativeDriver: true,
                friction: 4,
                tension: 40
            }).start();
        }
    };

    const handleMouseLeave = () => {
        if (Platform.OS === 'web') {
            setHoveredItem(null);
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                friction: 4,
                tension: 40
            }).start();
        }
    };

    return (
        <View style={[
            styles.container,
            { backgroundColor: theme.bg || '#050510', borderRightColor: theme.cardBorder },
            isCollapsed && styles.collapsedContainer
        ]}>
            <View style={styles.logoRow}>
                <View style={[styles.logoIconContainer, { borderColor: ACCENT, backgroundColor: theme.glass(0.05) }]}>
                    <Text style={[styles.logoIcon, { color: ACCENT }]}>G</Text>
                </View>
                {!isCollapsed && (
                    <View>
                        <Text style={[styles.logoText, { color: theme.text }]}>THE GRUVS</Text>
                        <Text style={[styles.logoSubtext, { color: theme.textDim }]}>PREMIUM NETWORK</Text>
                    </View>
                )}
            </View>

            <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
                {NAV_ITEMS.map((item) => {
                    const isActive = activeScreen === item.id;
                    const isHovered = hoveredItem === item.id;

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.navItem,
                                isActive && [styles.activeNavItem, { backgroundColor: theme.accent + '22' }],
                                item.special && { backgroundColor: theme.accent + '11', borderColor: theme.accent + '33', borderWidth: 1, marginTop: 16 },
                                isHovered && { backgroundColor: theme.glass(0.1), transform: [{ translateX: 4 }] }
                            ]}
                            onPress={() => onNavigate(item.id)}
                            onMouseEnter={() => handleMouseEnter(item.id)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <Animated.View style={[
                                styles.iconWrapper,
                                isHovered && { transform: [{ scale: 1.2 }] }
                            ]}>
                                <Text style={[
                                    styles.navIcon,
                                    item.special && styles.specialNavIcon,
                                    isActive && { color: ACCENT },
                                    !isActive && { color: theme.textDim }
                                ]}>{item.icon}</Text>
                            </Animated.View>
                            {!isCollapsed && (
                                <Text style={[
                                    styles.navLabel,
                                    isActive && styles.activeNavLabel,
                                    isActive && { color: ACCENT },
                                    !isActive && { color: theme.textDim }
                                ]}>
                                    {item.label}
                                </Text>
                            )}
                            {isActive && !isCollapsed && <View style={[styles.activeIndicator, { backgroundColor: ACCENT }]} />}
                        </TouchableOpacity>
                    );
                })}

                {!isCollapsed && (
                    <View style={[styles.sponsoredCard, { borderColor: GOLD + '33' }]}>
                        <View style={[styles.glassOverlay, { backgroundColor: GOLD + '11' }]} />
                        <Text style={styles.sponsoredLabel}>FEATURED PARTNER</Text>
                        <View style={styles.brandRow}>
                            <View style={[styles.brandAvatar, { borderColor: GOLD }]} />
                            <Text style={[styles.brandName, { color: GOLD }]}>Gold Member</Text>
                        </View>
                        <Text style={[styles.sponsoredDesc, { color: theme.textDim }]}>Exclusive access to VIP happenings and drops.</Text>
                        <TouchableOpacity style={[styles.viewBtn, { backgroundColor: GOLD }]}>
                            <Text style={[styles.viewBtnText, { color: '#000' }]}>UPGRADE</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.profileIndicator}
                    onPress={() => onNavigate('profile')}
                    onMouseEnter={() => handleMouseEnter('profile')}
                    onMouseLeave={handleMouseLeave}
                >
                    <View style={[styles.avatarFrame, { borderColor: hoveredItem === 'profile' ? ACCENT : theme.cardBorder, backgroundColor: theme.subtle }]}>
                        <View style={[styles.dot, { backgroundColor: ACCENT, borderColor: theme.bg }]} />
                    </View>
                    {!isCollapsed && (
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: theme.text }]}>Purple Haze</Text>
                            <Text style={[styles.profileLevel, { color: theme.textDim }]}>Elite Explorer</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
                style={[
                    styles.logoutBtn,
                    { backgroundColor: theme.subtle, borderColor: theme.cardBorder },
                    isCollapsed && styles.collapsedLogoutBtn,
                    hoveredItem === 'logout' && { backgroundColor: theme.error + '11', borderColor: theme.error + '33' }
                ]}
                onPress={onLogout}
                onMouseEnter={() => handleMouseEnter('logout')}
                onMouseLeave={handleMouseLeave}
            >
                <Text style={[styles.logoutIcon, { color: theme.textDim }]}>←</Text>
                {!isCollapsed && <Text style={[styles.logoutText, { color: theme.textDim }]}>EXIT</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 260,
        height: '100%',
        paddingVertical: 30,
        paddingHorizontal: 16,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.05)',
    },
    collapsedContainer: {
        width: 88,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
        marginLeft: 8,
        gap: 14,
    },
    logoIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 77, 166, 0.05)',
        ...Platform.select({
            web: {
                transition: 'transform 0.3s ease',
                ':hover': { transform: 'rotate(5deg) scale(1.05)' }
            }
        })
    },
    logoIcon: {
        fontSize: 24,
        fontWeight: '900',
    },
    logoText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
    },
    logoSubtext: {
        fontSize: 8,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '800',
        letterSpacing: 1,
    },
    navContainer: {
        flex: 1,
        width: '100%',
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        marginBottom: 4,
        position: 'relative',
        ...Platform.select({
            web: {
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                userSelect: 'none'
            }
        })
    },
    navItemHover: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        transform: [{ translateX: 4 }],
        ...Platform.select({
            web: {
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }
        })
    },
    iconWrapper: {
        marginRight: 16,
    },
    activeIndicator: {
        position: 'absolute',
        right: 8,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    specialNavItem: {
        backgroundColor: 'rgba(255, 77, 166, 0.08)',
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 77, 166, 0.2)',
    },
    specialNavIcon: {
        color: ACCENT,
    },
    navIcon: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.6)',
    },
    navLabel: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    activeNavLabel: {
        opacity: 1,
        fontWeight: '700',
    },
    sponsoredCard: {
        borderRadius: 16,
        padding: 16,
        marginTop: 24,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,215,0,0.05)',
    },
    sponsoredLabel: {
        fontSize: 9,
        color: GOLD,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 12,
        opacity: 0.8,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    brandAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,215,0,0.1)',
        marginRight: 10,
        borderWidth: 1,
    },
    brandName: {
        fontWeight: '800',
        fontSize: 13,
    },
    sponsoredDesc: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        marginBottom: 14,
        lineHeight: 16,
    },
    viewBtn: {
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    viewBtnText: {
        fontWeight: '900',
        fontSize: 11,
        letterSpacing: 1,
    },
    profileIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginTop: 8,
        gap: 12,
    },
    avatarFrame: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderWidth: 1.5,
        borderColor: '#050510',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    profileLevel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '600',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginTop: 20,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    logoutBtnHover: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    collapsedLogoutBtn: {
        paddingHorizontal: 0,
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 12,
    },
    logoutIcon: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 12,
    },
    logoutText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 1,
    }
});
