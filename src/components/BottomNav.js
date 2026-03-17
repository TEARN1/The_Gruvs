import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

const NAV_ITEMS = [
    { id: 'feed', icon: '🏠' },
    { id: 'explore', icon: '🔍' },
    { id: 'add_event', icon: '➕', special: true },
    { id: 'messages', icon: '💬' },
    { id: 'profile', icon: '👤' },
];

export function BottomNav({ activeScreen, onNavigate, theme }) {
    return (
        <View style={[styles.container, { backgroundColor: 'rgba(75, 22, 140, 0.8)' }]}>
            {NAV_ITEMS.map((item) => (
                <TouchableOpacity
                    key={item.id}
                    style={[
                        styles.navItem,
                        item.special && styles.specialItem,
                        activeScreen === item.id && styles.activeItem
                    ]}
                    onPress={() => onNavigate(item.id)}
                >
                    <Text style={[
                        styles.navIcon,
                        item.special && styles.specialIcon,
                        activeScreen === item.id && { color: '#fff' }
                    ]}>
                        {item.icon}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        height: Platform.OS === 'ios' ? 85 : 70,
        width: '100%',
        position: 'absolute',
        bottom: 0,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
        zIndex: 1000,
        // Glassy effect
        backgroundColor: 'rgba(30, 10, 93, 0.7)',
        backdropFilter: 'blur(15px)',
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    navIcon: {
        fontSize: 24,
        color: 'rgba(255, 255, 255, 0.4)',
    },
    activeItem: {
        // Optional active indicator
    },
    specialItem: {
        backgroundColor: '#ff4da6',
        width: 50,
        height: 50,
        borderRadius: 25,
        flex: 0,
        marginHorizontal: 10,
        marginTop: -30,
        shadowColor: '#ff4da6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    specialIcon: {
        color: '#fff',
        fontSize: 26,
    }
});
