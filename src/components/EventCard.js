import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, TextInput } from 'react-native';
import * as Descriptors from '../descriptors';

export function EventCard({ post, theme, onPress, onLike, onRSVP }) {
    const { content, engagement_metrics } = post;
    const [isFollowing, setIsFollowing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordTime, setRecordTime] = useState(0);

    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordTime(t => (t < 30 ? t + 1 : t));
            }, 1000);
        } else {
            setRecordTime(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // Pick some descriptors for the "Vibe"
    const vibes = [
        Descriptors.ROLE_CREATIVE[0],
        Descriptors.STYLE_PATTERN[Descriptors.STYLE_PATTERN.length - 1],
        Descriptors.EMOTIONS_JOY[0]
    ];

    return (
        <View style={styles.card}>
            {/* LIVE Badge */}
            <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>

            {/* Host Info Header */}
            <View style={styles.hostHeader}>
                <View style={styles.hostAvatar} />
                <View style={styles.hostTextInfo}>
                    <Text style={styles.hostName}>{content.author_name || 'Vibe Central'}</Text>
                    <Text style={styles.postTime}>2h</Text>
                </View>
                <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.followingBtn]}
                    onPress={() => setIsFollowing(!isFollowing)}
                >
                    <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.hostMsgBtn}>
                    <Text style={styles.hostMsgIcon}>💬</Text>
                </TouchableOpacity>
            </View>

            {/* Content Body */}
            <TouchableOpacity onPress={onPress} style={styles.contentBody}>
                <Text style={styles.eventTitle}>{content.title}</Text>
                <Text style={styles.eventDesc}>{content.text}</Text>

                {/* Image Placeholder */}
                <View style={styles.mediaPlaceholder}>
                    <Text style={styles.mediaText}>{content.title} media 1</Text>
                    <View style={styles.mediaPagination}>
                        <Text style={styles.paginationText}>1/2</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Location & Distance Grid */}
            <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>📍 Location</Text>
                    <Text style={styles.metaValue}>{content.location}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Distance</Text>
                    <Text style={styles.metaValue}>{content.distance}</Text>
                </View>
            </View>

            {/* Vibe Tags from Descriptors */}
            <View style={styles.vibeRow}>
                <Text style={styles.vibeIcon}>🏷️</Text>
                {vibes.map((vibe, idx) => (
                    <View key={idx} style={[styles.vibeTag, idx === 0 && styles.activeVibeTag]}>
                        <Text style={[styles.vibeTagText, idx === 0 && styles.activeVibeTagText]}>{vibe}</Text>
                    </View>
                ))}
            </View>

            {/* Interaction Bar */}
            <View style={styles.interactionBar}>
                <View style={styles.metrics}>
                    <TouchableOpacity style={styles.metricBtn} onPress={onLike}>
                        <Text style={styles.metricIcon}>🤍</Text>
                        <Text style={styles.metricText}>{engagement_metrics.likes}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.metricBtn}>
                        <Text style={styles.metricIcon}>💬</Text>
                        <Text style={styles.metricText}>{engagement_metrics.comments}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.metricBtn}>
                        <Text style={styles.metricIcon}>🔄</Text>
                        <Text style={[styles.metricText, { color: '#4ade80' }]}>Reposted</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.rsvpBtn} onPress={onRSVP}>
                        <Text style={styles.rsvpBtnText}>RSVP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.buyBtn}>
                        <Text style={styles.buyBtnText}>💳 Buy ({content.price})</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Inline Comments Section */}
            <View style={styles.commentsSection}>
                <Text style={styles.commentsTitle}>Top Comments</Text>
                <View style={styles.comment}>
                    <Text style={styles.commentAuthor}>Alex: <Text style={styles.commentText}>Hello, Can i come ?</Text></Text>
                    <View style={styles.commentActions}>
                        <TouchableOpacity><Text style={styles.commentActionText}>👍 1</Text></TouchableOpacity>
                        <TouchableOpacity><Text style={styles.commentActionText}>Reply</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Inline Input or Recording */}
                {isRecording ? (
                    <View style={styles.recordingContainer}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>Recording... {recordTime}s / 30s</Text>
                        <TouchableOpacity style={styles.stopRecordingBtn} onPress={() => setIsRecording(false)}>
                            <Text style={styles.stopIconText}>⏹</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.inlineInputContainer}>
                        <TextInput
                            style={styles.inlineInput}
                            placeholder="Add a comment..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                        />
                        <View style={styles.inputActions}>
                            <TouchableOpacity style={styles.inputActionBtn} onPress={() => setIsRecording(true)}>
                                <Text style={styles.micIcon}>🎤</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sendBtn}><Text>✈️</Text></TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Absolute Action Buttons (Right side) */}
            <TouchableOpacity style={styles.absBookmark}>
                <Text style={styles.absIcon}>🔖</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.absMenu}>
                <Text style={styles.absIcon}>⋮</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#4b168c',
        borderRadius: 30,
        marginBottom: 30,
        borderWidth: 2,
        borderColor: '#ff4d01', // Vibrant orange/red border
        overflow: 'hidden',
        position: 'relative',
    },
    liveBadge: {
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        zIndex: 20,
    },
    liveBadgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold' },
    hostHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 50,
        gap: 15,
    },
    hostAvatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#333' },
    hostTextInfo: { flex: 1 },
    hostName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    postTime: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    followBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    followingBtn: {
        backgroundColor: '#a855f7',
        borderColor: '#a855f7',
    },
    followBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    hostMsgBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hostMsgIcon: { color: '#fff', fontSize: 18 },
    contentBody: { paddingHorizontal: 20, marginBottom: 20 },
    eventTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 5 },
    eventDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 15 },
    mediaPlaceholder: {
        width: '100%',
        height: 250,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    mediaText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
    mediaPagination: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    paginationText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    metaGrid: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 40 },
    metaItem: { gap: 4 },
    metaLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    metaValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
    vibeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, gap: 10 },
    vibeIcon: { fontSize: 16 },
    vibeTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    vibeTagText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    activeVibeTag: { backgroundColor: 'rgba(255,77,166,0.1)', borderColor: '#ff4da6' },
    activeVibeTagText: { color: '#ff4da6', fontWeight: 'bold' },
    interactionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    metrics: { flexDirection: 'row', gap: 12 },
    metricBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metricIcon: { fontSize: 18, color: '#fff' },
    metricText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    actionButtons: { flexDirection: 'row', gap: 10 },
    rsvpBtn: { backgroundColor: '#a855f7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    rsvpBtnText: { color: '#fff', fontWeight: 'bold' },
    buyBtn: { backgroundColor: '#ffcc00', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
    buyBtnText: { color: '#000', fontWeight: 'bold' },
    commentsSection: { backgroundColor: 'rgba(0,0,0,0.1)', padding: 20 },
    commentsTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 15 },
    comment: { marginBottom: 15 },
    commentAuthor: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    commentText: { fontWeight: 'normal', opacity: 0.8 },
    commentActions: { flexDirection: 'row', gap: 15, marginTop: 5 },
    commentActionText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
    inlineInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 18,
        paddingHorizontal: 15,
        height: 50,
    },
    inlineInput: { flex: 1, color: '#fff', fontSize: 14 },
    recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)', // Subtle red tint
        borderRadius: 18,
        paddingHorizontal: 15,
        height: 50,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    recordingText: {
        flex: 1,
        color: '#ef4444',
        fontSize: 14,
        fontWeight: 'bold',
    },
    stopRecordingBtn: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopIconText: { color: '#fff', fontSize: 14 },
    inputActions: { flexDirection: 'row', gap: 10 },
    micIcon: { fontSize: 18, color: '#fff' },
    inputActionBtn: { width: 35, height: 35, justifyContent: 'center', alignItems: 'center', opacity: 0.8 },
    sendBtn: { width: 35, height: 35, borderRadius: 10, backgroundColor: '#a855f7', justifyContent: 'center', alignItems: 'center' },
    absBookmark: { position: 'absolute', top: 50, right: 65, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    absMenu: { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    absIcon: { color: '#fff', fontSize: 18 },
});
