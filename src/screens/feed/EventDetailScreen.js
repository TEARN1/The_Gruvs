import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, Platform, TextInput, KeyboardAvoidingView, Share, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { THEME, ACCENT, GOLD } from '../../theme';
import { useStore } from '../../state/useStore';

const { width, height } = Dimensions.get('window');

export default function EventDetailScreen({ route, navigation }) {
    const { event } = route.params || {};
    const { user, handleRSVP, rsvpState, handleFollow, followedUsers } = useStore();
    const [isSaved, setIsSaved] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isFollowing, setIsFollowing] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    const [messages, setMessages] = useState([
        { id: 1, author: 'Dubai Luxury', avatar: 'V', text: 'Can\'t wait for this event!', timestamp: '2m' },
        { id: 2, author: 'You', avatar: 'Y', text: 'Same! Should be amazing 🎉', timestamp: '1m' }
    ]);

    if (!event) return null;

    const myRSVP = rsvpState[event.id];
    const authorId = event.content?.author_id || event.author_id || 'unknown';

    // Countdown timer effect
    useEffect(() => {
        const calculateCountdown = () => {
            try {
                // Use future date or event date if available
                const eventDate = event?.date_time ? new Date(event.date_time) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now by default
                const now = new Date();
                const diff = eventDate - now;

                if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    
                    if (days > 0) {
                        setTimeLeft(`${days}d ${hours}h`);
                    } else if (hours > 0) {
                        setTimeLeft(`${hours}h ${minutes}m`);
                    } else {
                        setTimeLeft(`${Math.max(minutes, 1)}m`);
                    }
                } else {
                    setTimeLeft('Event started');
                }
            } catch (err) {
                console.warn('Countdown calculation error:', err);
                setTimeLeft('Soon');
            }
        };

        calculateCountdown();
        const timer = setInterval(calculateCountdown, 60000); // Update every minute
        return () => clearInterval(timer);
    }, [event]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this event: ${event.content?.title || event.title}\nJoin us at ${event.content?.location || 'the venue'}`,
                url: 'gruvs://event/' + event.id,
                title: event.content?.title || event.title,
            });
        } catch (err) {
            console.error('Share error:', err);
        }
    };

    const toggleFollow = () => {
        handleFollow(authorId);
        setIsFollowing(!isFollowing);
    };

    const handleSendMessage = () => {
        if (inputText.trim()) {
            setMessages([...messages, {
                id: messages.length + 1,
                author: user?.name || 'You',
                avatar: user?.name?.charAt(0) || 'Y',
                text: inputText,
                timestamp: 'now'
            }]);
            setInputText('');
        }
    };

    const navigateToProfile = () => {
        navigation.navigate('Profile', { 
            userId: authorId,
            userName: event.content?.author_name || event.author_name || 'User'
        });
    };

    return (
        <KeyboardAvoidingView 
            style={[styles.container, { backgroundColor: THEME.bg }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{event.content?.title || event.title}</Text>
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                        <Ionicons name="share-social-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
                    <View style={styles.bannerContainer}>
                        <View style={styles.bannerPlaceholder} />
                        <View style={styles.badgeRow}>
                            <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>EVENT</Text></View>
                            <View style={styles.distanceBadge}><Text style={styles.distanceText}>📍 2.4km away</Text></View>
                            {timeLeft && <View style={styles.countdownBadge}><Text style={styles.countdownText}>⏱️ {timeLeft}</Text></View>}
                        </View>
                    </View>

                    <View style={styles.contentSection}>
                        <Text style={styles.categoryText}>{event.content?.category || event.category}</Text>
                        <Text style={styles.titleText}>{event.content?.title || event.title}</Text>
                        <Text style={styles.dateTimeText}>Friday, Jan 12 • 20:00</Text>

                        <View style={[styles.actionRow, Platform.OS === 'web' && { flexDirection: 'column' }]}>
                            <View style={[styles.btnStack, Platform.OS === 'web' && { width: '100%' }]}>
                                <TouchableOpacity 
                                    style={[styles.mainBtn, myRSVP === 'going' ? styles.goingBtn : { backgroundColor: '#fff' }]}
                                    onPress={() => handleRSVP(event.id, 'going')}
                                >
                                    <Text style={[styles.mainBtnText, myRSVP === 'going' ? { color: '#fff' } : { color: '#000' }]}>
                                        {myRSVP === 'going' ? '✓ Going' : '⚡ RSVP Now'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.secondaryBtn}>
                                    <Text style={styles.secondaryBtnText}>🎫 Get Ticket</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => setIsSaved(!isSaved)}>
                                <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={24} color={isSaved ? ACCENT : "#fff"} />
                            </TouchableOpacity>
                        </View>

                        {/* Host Card with clickable avatar and follow */}
                        <View style={styles.hostCard}>
                            <TouchableOpacity 
                                style={styles.hostAvatar}
                                onPress={navigateToProfile}
                            >
                                <Text style={styles.avatarText}>{(event.content?.author_name || event.author_name || 'V').charAt(0)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.hostInfo} onPress={navigateToProfile}>
                                <Text style={styles.hostName}>{event.content?.author_name || event.author_name || 'Dubai Luxury'}</Text>
                                <Text style={styles.hostLabel}>Organizer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                                onPress={toggleFollow}
                            >
                                <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                                    {isFollowing ? '✓ Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionTitle}>About this vibe</Text>
                        <Text style={styles.descText}>{event.content?.text || event.description || 'No description provided.'}</Text>
                    </View>

                    {/* Chat Section */}
                    <View style={styles.chatSection}>
                        <Text style={styles.sectionTitle}>Vibe Central</Text>
                        <View style={styles.messagesContainer}>
                            {messages.map((msg) => (
                                <View key={msg.id} style={styles.messageRow}>
                                    <View style={styles.messageAvatar}>
                                        <Text style={styles.messageAvatarText}>{msg.avatar}</Text>
                                    </View>
                                    <View style={styles.messageBubble}>
                                        <Text style={styles.messageAuthor}>{msg.author}</Text>
                                        <Text style={styles.messageText}>{msg.text}</Text>
                                        <Text style={styles.messageTime}>{msg.timestamp}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                {/* Chat Input - Responsive Footer */}
                <View style={styles.chatInputContainer}>
                    <TextInput
                        placeholder="Join the chat..."
                        placeholderTextColor="#55608a"
                        style={styles.chatInput}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity 
                        style={[styles.chatActionBtn, !inputText.trim() && styles.chatActionBtnDisabled]}
                        onPress={handleSendMessage}
                        disabled={!inputText.trim()}
                    >
                        <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chatActionBtn}>
                        <Ionicons name="image-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chatActionBtn}>
                        <Ionicons name="mic-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    safeArea: { flex: 1, flexDirection: 'column' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: width < 600 ? 15 : 20, height: 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { color: '#fff', fontSize: width < 600 ? 14 : 16, fontWeight: '900', flex: 1, textAlign: 'center', marginHorizontal: 10 },
    shareBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
    scrollArea: { paddingBottom: width < 600 ? 80 : 100 },
    bannerContainer: { width: '100%', height: width < 600 ? 250 : 350, backgroundColor: '#1e1e3f', position: 'relative' },
    bannerPlaceholder: { width: '100%', height: '100%' },
    badgeRow: { position: 'absolute', bottom: width < 600 ? 12 : 20, left: width < 600 ? 12 : 20, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    typeBadge: { backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    typeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
    distanceBadge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    distanceText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
    countdownBadge: { backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    countdownText: { color: '#000', fontSize: 9, fontWeight: 'bold' },
    contentSection: { padding: width < 600 ? 15 : 25 },
    categoryText: { color: ACCENT, fontSize: width < 600 ? 11 : 13, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10 },
    titleText: { color: '#fff', fontSize: width < 600 ? 24 : 32, fontWeight: '900', lineHeight: width < 600 ? 28 : 38, marginBottom: 10 },
    dateTimeText: { color: 'rgba(255,255,255,0.5)', fontSize: width < 600 ? 14 : 16, marginBottom: width < 600 ? 20 : 30 },
    actionRow: { flexDirection: width < 600 ? 'column' : 'row', gap: 12, alignItems: 'flex-start', marginBottom: width < 600 ? 25 : 40 },
    btnStack: { flex: 1, gap: 12, width: '100%' },
    mainBtn: { height: width < 600 ? 50 : 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowOpacity: 0.3, shadowRadius: 10 },
    mainBtnText: { fontSize: width < 600 ? 14 : 16, fontWeight: '900' },
    goingBtn: { backgroundColor: '#10b981' },
    secondaryBtn: { height: width < 600 ? 50 : 60, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    secondaryBtnText: { color: '#fff', fontSize: width < 600 ? 14 : 16, fontWeight: '800' },
    iconBtn: { width: width < 600 ? 50 : 60, height: width < 600 ? 50 : 60, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    hostCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: width < 600 ? 12 : 20, borderRadius: 25, marginBottom: width < 600 ? 25 : 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    hostAvatar: { width: width < 600 ? 45 : 55, height: width < 600 ? 45 : 55, borderRadius: 20, backgroundColor: ACCENT, marginRight: width < 600 ? 12 : 15, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: width < 600 ? 16 : 20, fontWeight: 'bold' },
    hostInfo: { flex: 1 },
    hostName: { color: '#fff', fontSize: width < 600 ? 15 : 17, fontWeight: 'bold' },
    hostLabel: { color: 'rgba(255,255,255,0.4)', fontSize: width < 600 ? 10 : 12, marginTop: 2 },
    followBtn: { paddingHorizontal: width < 600 ? 12 : 16, paddingVertical: width < 600 ? 6 : 8, borderRadius: 12, borderWidth: 1, borderColor: ACCENT },
    followBtnText: { color: ACCENT, fontSize: width < 600 ? 11 : 13, fontWeight: 'bold' },
    followingBtn: { backgroundColor: ACCENT, borderColor: ACCENT },
    followingBtnText: { color: '#fff' },
    sectionTitle: { color: '#fff', fontSize: width < 600 ? 18 : 20, fontWeight: '900', marginBottom: 15 },
    descText: { color: 'rgba(255,255,255,0.6)', fontSize: width < 600 ? 14 : 16, lineHeight: 26 },
    
    // Chat Section Styles
    chatSection: { padding: width < 600 ? 15 : 25, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    messagesContainer: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 15, padding: width < 600 ? 12 : 15, maxHeight: 300, marginBottom: 15 },
    messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
    messageAvatar: { width: 35, height: 35, borderRadius: 10, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    messageAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    messageBubble: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    messageAuthor: { color: ACCENT, fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
    messageText: { color: '#fff', fontSize: 13, lineHeight: 18 },
    messageTime: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4 },
    
    // Chat Input Styles - Responsive
    chatInputContainer: { 
        flexDirection: 'row', 
        alignItems: width < 600 ? 'flex-end' : 'center', 
        gap: width < 600 ? 6 : 8, 
        padding: width < 600 ? 10 : 15, 
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)'
    },
    chatInput: { 
        flex: 1, 
        backgroundColor: 'rgba(30, 30, 63, 0.6)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: width < 600 ? 12 : 15,
        borderWidth: 1,
        color: '#fff',
        fontSize: width < 600 ? 12 : 14,
        paddingHorizontal: width < 600 ? 12 : 15,
        paddingVertical: width < 600 ? 10 : 12,
        maxHeight: 100,
        fontFamily: 'System'
    },
    chatActionBtn: {
        width: width < 600 ? 40 : 50,
        height: width < 600 ? 40 : 50,
        borderRadius: width < 600 ? 10 : 12,
        backgroundColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center'
    },
    chatActionBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.2)'
    }
});

