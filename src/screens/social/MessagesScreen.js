import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../state/useStore';
import { supabase } from '../../supabase';
import { THEME, ACCENT } from '../../theme';

export default function MessagesScreen({ navigation }) {
    const { user } = useStore();
    const [selectedChat, setSelectedChat] = useState(null);
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchChats = async () => {
        if (!user || !supabase) {
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
        if (user) fetchChats();
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
            // Realtime is hooked to 'INSERT' now
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

    if (selectedChat) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setSelectedChat(null)}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.chatHeaderInfo}>
                        <Text style={styles.headerTitle}>{selectedChat.conversation_participants?.find(p => p.user.id !== user.id)?.user.name || 'Chat'}</Text>
                        <Text style={styles.chatStatusSub}>Active Now</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>
                <ScrollView contentContainerStyle={styles.messageBubbleContainer}>
                    {messages.map(msg => (
                        <View key={msg.id} style={[
                            msg.sender_id === user.id ? styles.msgBubbleRight : styles.msgBubbleLeft,
                            msg.sender_id === user.id && { backgroundColor: ACCENT }
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
                    <TouchableOpacity style={[styles.sendCircle, { backgroundColor: ACCENT }]} onPress={sendMessage}>
                        <Ionicons name="send" size={20} color="#fff" />
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: THEME.bg }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>MESSAGES</Text>
            </View>
            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
                <TextInput placeholder="Search chats..." placeholderTextColor="rgba(255,255,255,0.4)" style={styles.searchInput} />
            </View>
            <ScrollView style={styles.chatList}>
                {chats.map(chat => (
                    <TouchableOpacity key={chat.id} style={styles.chatItem} onPress={() => {
                        setSelectedChat(chat);
                        fetchMessages(chat.id);
                    }}>
                        <View style={styles.itemAvatarSmall} />
                        <View style={styles.chatInfo}>
                            <View style={styles.chatRowTop}>
                                <Text style={styles.chatName}>{chat.conversation_participants?.find(p => p.user.id !== user.id)?.user.name || 'User'}</Text>
                                <Text style={styles.chatTime}>{chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                            </View>
                            <Text style={styles.chatMsg} numberOfLines={1}>{chat.last_message || 'Start a conversation'}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
                {chats.length === 0 && (
                    <Text style={styles.emptyText}>No messages yet. Start a vibe from someone's profile!</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050514' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 70, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    headerTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    chatHeaderInfo: { flex: 1, alignItems: 'center' },
    chatStatusSub: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', margin: 20, paddingHorizontal: 15, height: 50, borderRadius: 15, gap: 10 },
    searchInput: { flex: 1, color: '#fff' },
    chatList: { flex: 1 },
    chatItem: { flexDirection: 'row', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    itemAvatarSmall: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#1e1e3f', marginRight: 15 },
    chatInfo: { flex: 1 },
    chatRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    chatName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    chatTime: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
    chatMsg: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    messageBubbleContainer: { padding: 20, gap: 12 },
    msgBubbleLeft: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderTopLeftRadius: 4, maxWidth: '80%' },
    msgBubbleRight: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderTopRightRadius: 4, maxWidth: '80%' },
    msgText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22 },
    chatInputRow: { flexDirection: 'row', padding: 15, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    chatInput: { flex: 1, color: '#fff', fontSize: 15, paddingHorizontal: 20, height: 50, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 25 },
    sendCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
    emptyText: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 100, paddingHorizontal: 40 }
});
