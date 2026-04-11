import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../../core/state/useStore';
import { supabase } from '../../../services/supabase';
import { THEME, ACCENT } from '../../../core/theme';

export default function MessagesScreen({ navigation }) {
    const { user } = useStore();
    const [selectedChat, setSelectedChat] = useState(null);
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchChats = async () => {
        if (!user || user.isVisitor || !supabase) {
            setChats([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        // Fetch conversations where user is a participant
        const { data, error } = await supabase
            .from('conversation_participants')
            .select(`
                conversation:conversation_id (
                    id, 
                    last_message, 
                    last_message_at,
                    conversation_participants (
                        user:user_id (id, username, name, avatar)
                    )
                )
            `)
            .eq('user_id', user.id);

        if (!error && data) {
            setChats(data.map(d => d.conversation));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (user && !user.isVisitor) fetchChats();
        else {
            setChats([]);
            setLoading(false);
        }
    }, [user]);

    const fetchMessages = async (chatId) => {
        if (!supabase) return;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', chatId)
            .order('created_at', { ascending: true });

        if (!error && data) setMessages(data);
    };

    useEffect(() => {
        if (selectedChat) {
            fetchMessages(selectedChat.id);
            const unsubscribe = useStore.getState().subscribeToRealtime(selectedChat.id);
            return () => unsubscribe();
        }
    }, [selectedChat]);

    const sendMessage = async () => {
        if (!supabase || !inputText.trim() || !selectedChat || !user) return;
        
        const newMsg = {
            conversation_id: selectedChat.id,
            sender_id: user.id,
            text: inputText,
        };

        const { error } = await supabase.from('messages').insert([newMsg]);
        if (!error) {
            setInputText('');
            fetchMessages(selectedChat.id);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator color={ACCENT} size="large" />
            </View>
        );
    }

    if (user?.isVisitor) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
                <View style={styles.contentWrapper}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>WAVES</Text>
                    </View>
                    <View style={styles.emptyContainer}>
                        <View style={styles.visitorIconContainer}>
                            <Ionicons name="chatbubbles-outline" size={80} color={ACCENT} />
                            <View style={styles.lockBadge}>
                                <Ionicons name="lock-closed" size={16} color="#fff" />
                            </View>
                        </View>
                        <Text style={styles.visitorTitle}>Join the Conversation</Text>
                        <Text style={styles.visitorText}>Create an account to start waving with the community and DJs.</Text>
                        <TouchableOpacity
                            style={styles.visitorBtn}
                            onPress={() => navigation.navigate('Auth')}
                        >
                            <Text style={styles.visitorBtnText}>Sign Up / Log In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    if (selectedChat) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
                <View style={styles.contentWrapper}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => {
                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedChat(null);
                            }}
                            accessibilityLabel="Back to waves"
                            accessibilityRole="button"
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.chatHeaderInfo} accessibilityRole="header">
                            <Text style={styles.headerTitle}>{selectedChat.conversation_participants?.find(p => p.user.id !== user.id)?.user.name || 'Wave'}</Text>
                            <Text style={styles.chatStatusSub}>Active Now</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>
                    <ScrollView contentContainerStyle={styles.messageBubbleContainer}>
                        {messages.map(msg => (
                            <View key={msg.id} style={[
                                msg.sender_id === user.id ? styles.msgBubbleRight : styles.msgBubbleLeft
                            ]}>
                                <Text style={[styles.msgText, msg.sender_id === user.id && { color: '#fff' }]}>{msg.text}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatInputRow}>
                        <TextInput
                            placeholder="Type a vibe..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={styles.chatInput}
                            value={inputText}
                            onChangeText={setInputText}
                        />
                        <TouchableOpacity
                            style={[styles.sendCircle, { backgroundColor: ACCENT }]}
                            onPress={() => {
                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                sendMessage();
                            }}
                            accessibilityLabel="Send message"
                            accessibilityRole="button"
                        >
                            <Ionicons name="send" size={20} color="#fff" />
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={styles.contentWrapper}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle} accessibilityRole="header">WAVES</Text>
                    <TouchableOpacity
                        style={styles.headerAction}
                        accessibilityLabel="Create new wave"
                        accessibilityRole="button"
                        onPress={() => {
                            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        <Ionicons name="create-outline" size={24} color={ACCENT} />
                    </TouchableOpacity>
                </View>

                {/* Vibe Stories */}
                <View style={styles.vibeStoriesContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyScroll}>
                        <TouchableOpacity
                            style={styles.addStory}
                            accessibilityLabel="Add to my vibe"
                            accessibilityRole="button"
                            onPress={() => {
                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <View style={styles.addStoryCircle}>
                                <Ionicons name="add" size={24} color="#fff" />
                            </View>
                            <Text style={styles.storyLabel}>My Vibe</Text>
                        </TouchableOpacity>
                        {[1,2,3,4,5].map(i => (
                            <View key={i} style={styles.storyItem}>
                                <View style={[styles.storyCircle, { borderColor: i % 2 === 0 ? ACCENT : '#ff00ff' }]} />
                                <Text style={styles.storyLabel}>User {i}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
                        <TextInput
                            placeholder="Search waves..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={styles.searchInput}
                        />
                </View>

                <ScrollView style={styles.chatList}>
                    {chats.map(chat => (
                        <TouchableOpacity key={chat.id} style={styles.chatItem} onPress={() => {
                            setSelectedChat(chat);
                            fetchMessages(chat.id);
                        }}>
                            <View style={styles.itemAvatarSmall}>
                                <View style={styles.activePulse} />
                            </View>
                            <View style={styles.chatInfo}>
                                <View style={styles.chatRowTop}>
                                    <Text style={styles.chatName}>{chat.conversation_participants?.find(p => p.user.id !== user.id)?.user.name || 'Wave'}</Text>
                                    <Text style={styles.chatTime}>{chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</Text>
                                </View>
                                <View style={styles.chatRowBottom}>
                                    <Text style={styles.chatMsg} numberOfLines={1}>{chat.last_message || 'Catch a new frequency...'}</Text>
                                    {chat.unread_count > 0 && (
                                        <View style={styles.unreadBadge}><Text style={styles.unreadText}>{chat.unread_count}</Text></View>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {chats.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="radio-outline" size={64} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.emptyText}>No active frequencies. Discover nearby vibes to start a wave.</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    contentWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: 700,
        alignSelf: 'center',
        borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
        borderRightWidth: Platform.OS === 'web' ? 1 : 0,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 4 },
    headerAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    
    vibeStoriesContainer: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
    storyScroll: { paddingHorizontal: 20, gap: 15 },
    addStory: { alignItems: 'center', gap: 8 },
    addStoryCircle: { width: 60, height: 60, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    storyItem: { alignItems: 'center', gap: 8 },
    storyCircle: { width: 60, height: 60, borderRadius: 22, backgroundColor: '#1e1e3f', borderWidth: 2 },
    storyLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },

    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', margin: 20, paddingHorizontal: 15, height: 45, borderRadius: 12, gap: 10 },
    searchInput: { flex: 1, color: '#fff', fontSize: 14 },
    
    chatList: { flex: 1 },
    chatItem: { flexDirection: 'row', padding: 15, marginHorizontal: 10, borderRadius: 16, marginBottom: 5 },
    itemAvatarSmall: { width: 55, height: 55, borderRadius: 20, backgroundColor: '#1e1e3f', marginRight: 15, position: 'relative' },
    activePulse: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#00ff00', borderWidth: 3, borderColor: '#050514' },
    chatInfo: { flex: 1, justifyContent: 'center' },
    chatRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    chatName: { color: '#fff', fontWeight: '800', fontSize: 15 },
    chatTime: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700' },
    chatRowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chatMsg: { color: 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 },
    unreadBadge: { backgroundColor: ACCENT, paddingHorizontal: 6, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
    unreadText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    chatHeaderInfo: { flex: 1, alignItems: 'center' },
    chatStatusSub: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2, fontWeight: 'bold' },
    messageBubbleContainer: { padding: 20, gap: 15 },
    msgBubbleLeft: { 
        alignSelf: 'flex-start', 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        paddingHorizontal: 16, 
        paddingVertical: 12, 
        borderRadius: 20, 
        borderTopLeftRadius: 4, 
        maxWidth: '80%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)'
    },
    msgBubbleRight: { 
        alignSelf: 'flex-end', 
        backgroundColor: ACCENT,
        paddingHorizontal: 16, 
        paddingVertical: 12, 
        borderRadius: 20, 
        borderTopRightRadius: 4, 
        maxWidth: '80%',
        ...Platform.select({
            web: { boxShadow: '0 8px 16px rgba(0,0,0,0.3)' },
            default: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }
        })
    },
    msgText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20, fontWeight: '500' },
    chatInputRow: { 
        flexDirection: 'row', 
        padding: 15, 
        alignItems: 'center', 
        borderTopWidth: 1, 
        borderTopColor: 'rgba(255,255,255,0.03)',
        backgroundColor: 'rgba(5,5,20,0.8)'
    },
    chatInput: { flex: 1, color: '#fff', fontSize: 14, paddingHorizontal: 20, height: 48, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    sendCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    
    emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 60, gap: 20 },
    emptyText: { color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontSize: 13, lineHeight: 20, fontWeight: '600' },

    visitorIconContainer: { position: 'relative', marginBottom: 10 },
    lockBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: ACCENT, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#050514' },
    visitorTitle: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
    visitorText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 14, lineHeight: 22, paddingHorizontal: 20 },
    visitorBtn: { backgroundColor: ACCENT, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, marginTop: 10 },
    visitorBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

