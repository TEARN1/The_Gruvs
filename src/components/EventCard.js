import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, TextInput, useWindowDimensions } from 'react-native';
import * as Descriptors from '../descriptors';

export function EventCard({ post, theme, onPress, onLike, onRSVP }) {
    const { content, engagement_metrics } = post;
    const [isFollowing, setIsFollowing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordTime, setRecordTime] = useState(0);
    const [isReposted, setIsReposted] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [currentMediaIdx, setCurrentMediaIdx] = useState(0);

    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const mediaItems = content.media || [
        { type: 'image', url: 'https://via.placeholder.com/400x250?text=Event+Image+1' },
        { type: 'video', url: 'https://via.placeholder.com/400x250?text=Event+Video+1' }
    ];

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
        <View
            style={[styles.card, isHovered && styles.cardGlow]}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
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
            <TouchableOpacity onPress={onPress} style={[styles.contentBody, isMobile && { paddingHorizontal: 15 }]}>
                <Text style={[styles.eventTitle, isMobile && { fontSize: 20 }]}>{content.title}</Text>
                <Text style={[styles.eventDesc, isMobile && { fontSize: 13 }]}>{content.text}</Text>

                <View style={[styles.mediaCarousel, isMobile && { height: 200 }]}>
                    <View style={[styles.mediaPlaceholder, isMobile && { height: 200 }]}>
                        <Text style={styles.mediaText}>
                            {mediaItems[currentMediaIdx].type.toUpperCase()}: {content.title} {currentMediaIdx + 1}
                        </Text>
                        <View style={styles.mediaPagination}>
                            <Text style={styles.paginationText}>{currentMediaIdx + 1}/{mediaItems.length}</Text>
                        </View>
                        {mediaItems.length > 1 && (
                            <>
                                <TouchableOpacity
                                    style={[styles.carouselNav, { left: 10 }]}
                                    onPress={(e) => { e.stopPropagation(); setCurrentMediaIdx(prev => (prev > 0 ? prev - 1 : mediaItems.length - 1)); }}
                                >
                                    <Text style={styles.carouselNavText}>‹</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.carouselNav, { right: 10 }]}
                                    onPress={(e) => { e.stopPropagation(); setCurrentMediaIdx(prev => (prev < mediaItems.length - 1 ? prev + 1 : 0)); }}
                                >
                                    <Text style={styles.carouselNavText}>›</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </TouchableOpacity>

            {/* Location & Distance Grid */}
            <View style={[styles.metaGrid, isMobile && { gap: 20, paddingHorizontal: 15 }]}>
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
                    <View key={idx} style={[styles.vibeTag, idx === 0 && [styles.activeVibeTag, { borderColor: theme.accent, backgroundColor: `${theme.accent}1A` }]]}>
                        <Text style={[styles.vibeTagText, idx === 0 && [styles.activeVibeTagText, { color: theme.accent }]]}>{vibe}</Text>
                    </View>
                ))}
            </View>

            {/* Interaction Bar */}
            <View style={styles.interactionBar}>
                <View style={styles.metrics}>
                    <TouchableOpacity style={styles.metricItem} onPress={onLike}>
                        <Text style={styles.metricIcon}>❤️</Text>
                        <Text style={styles.metricText}>{post.engagement_metrics.likes}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.metricItem}>
                        <Text style={styles.metricIcon}>💬</Text>
                        <Text style={styles.metricText}>{post.engagement_metrics.comments}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.metricItem} onPress={() => setIsReposted(!isReposted)}>
                        <Text style={[styles.metricIcon, isReposted && { color: '#10b981' }]}>↺</Text>
                        <Text style={styles.metricText}>{post.engagement_metrics.reposts + (isReposted ? 1 : 0)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.metricItem} onPress={() => setIsSaved(!isSaved)}>
                        <Text style={[styles.metricIcon, isSaved && { color: theme.accent }]}>{isSaved ? '🔖' : '🏷️'}</Text>
                        <Text style={styles.metricText}>Save</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.actionButtons}>
                    <TouchableOpacity style={[styles.rsvpBtn, { backgroundColor: theme.accent }]} onPress={onRSVP}>
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
                    <Text style={[styles.commentAuthor, { color: theme.accent }]}>Alex: <Text style={styles.commentText}>Hello, Can i come ?</Text></Text>
                    {/* Top Comment Highlight */}
                    <View style={[styles.topCommentBox, { borderLeftColor: theme.accent }]}>
                        <Text style={[styles.topCommentLabel, { color: theme.accent }]}>Top Comment</Text>
                        <Text style={styles.topCommentText} numberOfLines={2}>
                            "Best rooftop vibe in JHB! Make sure to get there early for the sunset view. 🎷🌇"
                        </Text>
                    </View>

                    <View style={styles.commentInputRow}>
                        <TouchableOpacity><Text style={styles.commentActionText}>👍 1</Text></TouchableOpacity>
                        <TouchableOpacity><Text style={styles.commentActionText}>Reply</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Inline Input or Recording */}
                {isRecording ? (
                    <View style={[styles.recordingContainer, { backgroundColor: `${theme.red}1A`, borderColor: `${theme.red}33` }]}>
                        <View style={[styles.recordingDot, { backgroundColor: theme.red }]} />
                        <Text style={[styles.recordingText, { color: theme.red }]}>Recording... {recordTime}s / 30s</Text>
                        <TouchableOpacity style={[styles.stopRecordingBtn, { backgroundColor: theme.red }]} onPress={() => setIsRecording(false)}>
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
                            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.accent }]}><Text>✈️</Text></TouchableOpacity>
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
        transition: 'all 0.3s ease',
    },
    cardGlow: {
        borderColor: '#ffcc00',
        shadowColor: '#ffcc00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 20,
        transform: [{ scale: 1.01 }],
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
        backgroundColor: theme.accent,
        borderColor: theme.accent,
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
    mediaCarousel: { width: '100%', position: 'relative' },
    carouselNav: {
        position: 'absolute',
        top: '45%',
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    carouselNavText: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: -4 },
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
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metrics: {
        flexDirection: 'row',
        gap: 20,
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metricIcon: { color: 'rgba(255,255,255,0.4)', fontSize: 16 },
    metricText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 'bold' },
    actionButtons: { flexDirection: 'row', gap: 10 },
    rsvpBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
    rsvpBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    buyBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    buyBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    commentsSection: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    commentsTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15 },
    comment: { marginBottom: 15 },
    commentAuthor: { fontWeight: 'bold', fontSize: 13 },
    commentText: { color: 'rgba(255,255,255,0.8)', fontWeight: 'normal' },
    commentActions: { flexDirection: 'row', gap: 15, marginTop: 8 },
    commentActionText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 'bold' },

    topCommentBox: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 15,
        padding: 12,
        marginTop: 10,
        marginBottom: 10,
        borderLeftWidth: 3,
    },
    topCommentLabel: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
    topCommentText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontStyle: 'italic' },

    commentInputRow: { marginTop: 15 },
    inlineInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
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
    },
    recordingText: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
    },
    stopRecordingBtn: {
        width: 35,
        height: 35,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopIconText: { color: '#fff', fontSize: 14 },
    inputActions: { flexDirection: 'row', gap: 10 },
    micIcon: { fontSize: 18, color: '#fff' },
    inputActionBtn: { width: 35, height: 35, justifyContent: 'center', alignItems: 'center', opacity: 0.8 },
    sendBtn: { width: 35, height: 35, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    absBookmark: { position: 'absolute', top: 50, right: 65, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    absMenu: { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    absIcon: { color: '#fff', fontSize: 18 },
});
