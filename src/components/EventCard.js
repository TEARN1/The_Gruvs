import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, TextInput } from 'react-native';

export function EventCard({ post, theme }) {
    const { content, engagement_metrics } = post;

    return (
        <View style={styles.card}>
            {/* Header: User Info & Location */}
            <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                    <View style={styles.locationContainer}>
                        <Text style={styles.locationLabel}>Location</Text>
                        <Text style={styles.locationText}>{content.location}</Text>
                    </View>
                    <View style={styles.distanceContainer}>
                        <Text style={styles.distanceLabel}>Distance</Text>
                        <Text style={styles.distanceText}>{content.distance}</Text>
                    </View>
                </View>

                <View style={styles.lineupContainer}>
                    <Text style={styles.lineupLabel}>Line-up</Text>
                    <Text style={styles.lineupText}>{content.lineup}</Text>
                </View>

                <View style={styles.tagRow}>
                    <Text style={styles.tagIcon}>🏷️</Text>
                    {content.tags?.map((tag, idx) => (
                        <View key={idx} style={[styles.tag, idx < 2 ? styles.activeTag : styles.plainTag]}>
                            <Text style={[styles.tagText, idx < 2 ? styles.activeTagText : styles.plainTagText]}>
                                {tag}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Interaction Bar */}
            <View style={styles.interactionBar}>
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
                        <Text style={[styles.metricText, { color: '#4ade80' }]}>Reposted</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.actionButtons}>
                    <TouchableOpacity style={[styles.rsvpBtn, { backgroundColor: theme.sidebarBg }]}>
                        <Text style={styles.rsvpBtnText}>RSVP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.buyBtn, { backgroundColor: theme.yellow }]}>
                        <Text style={styles.buyBtnText}>💳 Buy ({content.price})</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Comments Section */}
            <View style={styles.commentsSection}>
                <Text style={styles.commentsTitle}>Top Comments</Text>
                <View style={styles.comment}>
                    <Text style={styles.commentAuthor}>Alex: <Text style={styles.commentText}>Hello, Can i come ?</Text></Text>
                    <View style={styles.commentActions}>
                        <TouchableOpacity><Text style={styles.commentActionText}>👍 1</Text></TouchableOpacity>
                        <TouchableOpacity><Text style={styles.commentActionText}>Reply</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Comment Input */}
                <View style={styles.commentInputContainer}>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="Add a comment..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                    <View style={styles.commentInputActions}>
                        <TouchableOpacity style={styles.micBtn}><Text>🎤</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.sidebarBg }]}><Text>✈️</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(75, 22, 140, 0.4)',
        borderRadius: 30,
        marginHorizontal: 20,
        marginBottom: 30,
        borderWidth: 2,
        borderColor: '#fe4d01', // Red/Orange border from screenshot
        overflow: 'hidden',
    },
    cardHeader: {
        padding: 25,
    },
    userInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    locationLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 },
    locationText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    distanceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4, textAlign: 'right' },
    distanceText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'right' },
    lineupLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 },
    lineupText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
    },
    tagIcon: { fontSize: 18, color: '#fff', marginRight: 5 },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        borderWidth: 1,
    },
    activeTag: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    activeTagText: { color: '#ff4da6', fontWeight: 'bold', fontSize: 12 },
    plainTag: {
        borderColor: 'transparent',
    },
    plainTagText: { color: '#fff', fontSize: 12, opacity: 0.8 },
    interactionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    metrics: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    metricIcon: { fontSize: 18, color: '#fff' },
    metricText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    rsvpBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
    },
    rsvpBtnText: { color: '#fff', fontWeight: 'bold' },
    buyBtn: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 12,
    },
    buyBtnText: { color: '#000', fontWeight: 'bold' },
    commentsSection: {
        padding: 20,
    },
    commentsTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    comment: {
        marginBottom: 20,
    },
    commentAuthor: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    commentText: { fontWeight: 'normal', opacity: 0.9 },
    commentActions: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 8,
    },
    commentActionText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        paddingHorizontal: 15,
        height: 50,
        marginTop: 10,
    },
    commentInput: { flex: 1, color: '#fff' },
    commentInputActions: { flexDirection: 'row', gap: 10 },
    micBtn: { width: 35, height: 35, justifyContent: 'center', alignItems: 'center', opacity: 0.6 },
    sendBtn: { width: 35, height: 35, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
