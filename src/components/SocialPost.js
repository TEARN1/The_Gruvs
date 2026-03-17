import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

export function SocialPost({ post, theme }) {
    const { content, engagement_metrics } = post;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <View style={[styles.avatar, { backgroundColor: theme.accent }]} />
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{content.author_name}</Text>
                    <Text style={styles.timeAgo}>10m ago</Text>
                </View>
                <TouchableOpacity style={styles.moreBtn}><Text style={styles.moreText}>•••</Text></TouchableOpacity>
            </View>

            <Text style={styles.postText}>{content.text}</Text>

            <View style={styles.footer}>
                <View style={styles.metrics}>
                    <TouchableOpacity style={styles.metricItem}>
                        <Text style={styles.metricIcon}>🤍</Text>
                        <Text style={styles.metricText}>{engagement_metrics.likes}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.metricItem}>
                        <Text style={styles.metricIcon}>💬</Text>
                        <Text style={styles.metricText}>{engagement_metrics.comments}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.metricItem}>
                        <Text style={styles.metricIcon}>🔄</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 25,
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatar: {
        width: 45,
        height: 45,
        borderRadius: 25,
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    timeAgo: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
    },
    moreBtn: {
        padding: 5,
    },
    moreText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 18,
    },
    postText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metrics: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metricIcon: {
        fontSize: 18,
        color: '#fff',
        opacity: 0.8,
    },
    metricText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        fontWeight: '600',
    },
});
