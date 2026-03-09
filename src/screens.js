import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, useWindowDimensions, Alert } from 'react-native';
import { GENDERS, getTheme, INTERESTS } from './data';
import * as ImagePicker from 'expo-image-picker';
import { GlowButton } from './components';

export function AuthScreen({ onLogin, onSignup }) {
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', gender: '' });
    const [interests, setInterests] = useState([]);

    const isSignup = mode === 'signup';
    const previewAcc = GENDERS.find(g => g.value === form.gender)?.accent || '#ff4da6';

    const toggleInterest = (id) => {
        setInterests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSubmit = () => {
        if (isSignup) onSignup({ ...form, interests });
        else onLogin(form);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#f0f2f5' }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.center}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <Text style={[styles.logo, { color: previewAcc }]}>THE GRUVS</Text>
                    <Text style={styles.tagline}>ADVANCED NETWORK</Text>

                    <View style={[styles.card, { borderColor: previewAcc, boxShadow: `0px 8px 30px rgba(0,0,0,0.08)` }]}>
                        <Text style={styles.title}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>

                        <TextInput style={styles.input} placeholder="Username" value={form.username} onChangeText={t => setForm(p => ({ ...p, username: t }))} />
                        {isSignup && <TextInput style={styles.input} placeholder="Email" value={form.email} onChangeText={t => setForm(p => ({ ...p, email: t }))} keyboardType="email-address" />}
                        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={form.password} onChangeText={t => setForm(p => ({ ...p, password: t }))} />
                        {isSignup && <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry value={form.confirm} onChangeText={t => setForm(p => ({ ...p, confirm: t }))} />}

                        {isSignup && (
                            <View style={styles.gap}>
                                <Text style={styles.label}>Select Gender</Text>
                                <View style={styles.row}>
                                    {GENDERS.map(g => (
                                        <TouchableOpacity key={g.value} onPress={() => setForm(p => ({ ...p, gender: g.value }))}
                                            style={[styles.pill, { borderColor: g.accent, backgroundColor: form.gender === g.value ? g.accent : 'transparent' }]}>
                                            <Text style={{ color: form.gender === g.value ? '#fff' : g.accent, fontWeight: '700', fontSize: 13 }}>{g.icon} {g.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.label, { marginTop: 15 }]}>What are your interests? (Helps personalize feed)</Text>
                                <View style={styles.row}>
                                    {INTERESTS.map(int => (
                                        <TouchableOpacity key={int.id} onPress={() => toggleInterest(int.id)}
                                            style={[styles.pill, { borderColor: int.color, backgroundColor: interests.includes(int.id) ? int.color : 'transparent' }]}>
                                            <Text style={{ color: interests.includes(int.id) ? '#fff' : int.color, fontWeight: '700', fontSize: 12 }}>{int.icon} {int.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        <GlowButton themeAcc={previewAcc} style={[styles.btn, { backgroundColor: previewAcc }]} onPress={handleSubmit}>
                            <Text style={styles.btnText}>{isSignup ? 'SIGN UP' : 'LOGIN'}</Text>
                        </GlowButton>

                        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setMode(isSignup ? 'login' : 'signup')}>
                            <Text style={styles.switchText}>
                                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                                <Text style={{ color: previewAcc, fontWeight: '800' }}>{isSignup ? 'LOGIN' : 'SIGN UP'}</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

export function ProfileScreen({ user, theme, onUpdate, onLogout, onBack }) {
    const [activeTab, setActiveTab] = useState('Overview');

    const stats = [
        { label: 'Points', value: '0' },
        { label: 'Followers', value: '1' },
        { label: 'Following', value: '0' },
        { label: 'Events', value: '0' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={styles.detailHeader}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Cover Image & Avatar */}
                <View style={styles.bannerContainer}>
                    <View style={styles.bannerPlaceholder} />
                    <View style={styles.userFollowedBadge}>
                        <Text style={styles.followedBadgeText}>✓ User followed</Text>
                    </View>
                </View>

                <View style={styles.profileHeader}>
                    <View style={styles.avatarWrapper}>
                        <View style={[styles.avatarCircle, { borderColor: theme.acc }]}>
                            <Text style={styles.avatarText}>{user?.name?.[0]}</Text>
                        </View>
                        <View style={styles.levelBadge}>
                            <Text style={styles.levelText}>Lvl 1</Text>
                        </View>
                        <View style={styles.statusDot} />
                    </View>

                    <View style={styles.headerInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.profileName}>{user?.name} Hub Global</Text>
                            <View style={styles.verifiedIcon}><Text style={{ color: '#fff', fontSize: 10 }}>@</Text></View>
                        </View>

                        <View style={styles.levelProgressContainer}>
                            <Text style={styles.levelProgressText}>Level 1</Text>
                            <Text style={styles.xpText}>/ 100 XP</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { backgroundColor: theme.acc, width: '40%' }]} />
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.msgIconBtn}>
                            <Text style={styles.msgIcon}>💬</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.followBtn, { backgroundColor: '#fff' }]}>
                            <Text style={styles.followBtnText}>Following</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.bioSection}>
                    <Text style={styles.bioText}>No bio yet.</Text>
                    <View style={styles.locationRow}>
                        <Text style={styles.locIcon}>📍</Text>
                        <Text style={styles.webLink}>🔗 website.com</Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    {stats.map((s, idx) => (
                        <View key={idx} style={[styles.statItem, idx < stats.length - 1 && styles.statBorder]}>
                            <Text style={styles.statValue}>{s.value}</Text>
                            <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    {['Overview', 'Moments', 'Badges'].map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.suggestionsHeader}>
                    <Text style={styles.suggestionsTitle}>👥 People You Might Know</Text>
                </View>
            </ScrollView>

        </SafeAreaView>
    );
}

export function ExploreScreen({ theme, onNavigate }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [activeTab, setActiveTab] = useState('Top');
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
    const [selectedEvent, setSelectedEvent] = useState(null);

    const trendingTags = ['#techno', '#rave', '#underground', '#berlin', '#housemusic'];
    const people = [
        { id: '1', name: 'Sarah Jones', handle: '@sarahj', bio: 'Music lover 🎵' },
        { id: '2', name: 'Mike Smith', handle: '@mikes', bio: 'Tech enthusiast 💻' },
        { id: '3', name: 'Jessica Brown', handle: '@jessb', bio: 'Art & Design 🎨' },
        { id: '4', name: 'David Lee', handle: '@davidl', bio: 'Foodie 🍔' },
        { id: '5', name: 'Emma Wilson', handle: '@emmaw', bio: 'Traveller ✈️' },
    ];
    const events = [
        { id: '1', title: 'Joburg Rooftop Jazz', date: '2025-12-03', loc: 'Sandton', desc: 'Smooth jazz with a view of the skyline.' },
        { id: '2', title: 'Cape Town Gaming Expo', date: '2025-12-03', loc: 'Century City', desc: 'The ultimate fighting game showdown.' },
        { id: '3', title: 'Zeitz MOCAA Art Fair', date: '2025-12-03', loc: 'V&A Waterfront', desc: 'Discover contemporary African artists.' },
        { id: '4', title: 'Clifton Sunset Yoga', date: '2025-12-03', loc: 'Clifton', desc: 'Yoga by the ocean.' },
        { id: '5', title: 'Braamfontein Poetry Slam', date: '2025-12-03', loc: 'Braamfontein', desc: 'Spoken word in the heart of Joburg.' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={styles.exploreHeader}>
                <View style={[styles.searchBarContainer, isMobile && { flex: 1 }]}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Gruv Gem..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                </View>
                {activeTab === 'Events' && (
                    <TouchableOpacity
                        style={styles.viewToggleBtn}
                        onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
                    >
                        <Text style={styles.viewToggleIcon}>{viewMode === 'list' ? '📍' : '☰'}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.tabsContainer}>
                {['Top', 'People', 'Events', 'Tags'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {activeTab === 'Top' && (
                    <>
                        <Text style={styles.sectionTitle}>Trending Now</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
                            {trendingTags.map(tag => (
                                <View key={tag} style={styles.trendingTag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </ScrollView>

                        <Text style={styles.sectionTitle}>People to Follow</Text>
                        {people.slice(0, 3).map(person => (
                            <View key={person.id} style={styles.personRow}>
                                <View style={styles.personAvatar} />
                                <View style={styles.personInfo}>
                                    <Text style={styles.personName}>{person.name}</Text>
                                    <Text style={styles.personHandle}>{person.handle}</Text>
                                </View>
                                <TouchableOpacity style={styles.followBtn}>
                                    <Text style={styles.followBtnText}>Follow</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </>
                )}

                {activeTab === 'People' && (
                    people.map(person => (
                        <View key={person.id} style={styles.personRowLarge}>
                            <View style={styles.personAvatarLarge} />
                            <View style={styles.personInfo}>
                                <Text style={styles.personName}>{person.name}</Text>
                                <Text style={styles.personHandle}>{person.handle}</Text>
                                <Text style={styles.personBio}>{person.bio}</Text>
                            </View>
                        </View>
                    ))
                )}

                {activeTab === 'Events' && (
                    viewMode === 'list' ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                            {events.map(event => (
                                <View key={event.id} style={[styles.eventRow, { width: width > 768 ? '48%' : '100%', marginBottom: 15 }]}>
                                    <View style={styles.eventThumb} />
                                    <View style={styles.eventInfo}>
                                        <Text style={styles.eventName}>{event.title}</Text>
                                        <Text style={styles.eventMeta}>{event.date} • {event.loc}</Text>
                                        {!isMobile && <Text style={styles.eventSnippet}>{event.desc}</Text>}
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.mapContainer}>
                            <TouchableOpacity activeOpacity={1} style={styles.mapMock} onPress={() => setSelectedEvent(null)}>
                                <TouchableOpacity style={[styles.mapPin, { top: 50, left: 150 }]} onPress={() => setSelectedEvent(events[0])} />
                                <TouchableOpacity style={[styles.mapPin, { top: 120, left: 80 }]} onPress={() => setSelectedEvent(events[1])} />
                                <TouchableOpacity style={[styles.mapPin, { top: 180, left: 220 }, selectedEvent?.id === '3' && styles.activeMapPin]} onPress={() => setSelectedEvent(events[2])} />
                                <TouchableOpacity style={[styles.mapPin, { top: 250, left: 130 }]} onPress={() => setSelectedEvent(events[3])} />
                                <TouchableOpacity style={[styles.mapPin, { top: 60, left: 280 }]} onPress={() => setSelectedEvent(events[4])} />
                            </TouchableOpacity>

                            {selectedEvent && (
                                <View style={styles.mapPreviewCard}>
                                    <View style={styles.previewHeader}>
                                        <View style={styles.previewThumb} />
                                        <View style={styles.previewInfo}>
                                            <Text style={styles.previewTitle}>{selectedEvent.title}</Text>
                                            <Text style={styles.previewStatus}>Upcoming</Text>
                                            <Text style={styles.previewLoc}>{selectedEvent.loc}, Dubai</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.previewBtn}
                                        onPress={() => onNavigate('event_detail', selectedEvent)}
                                    >
                                        <Text style={styles.previewBtnText}>View Details</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.mapControls}>
                                <TouchableOpacity style={styles.mapControlBtn}><Text style={{ color: '#fff' }}>+</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.mapControlBtn}><Text style={{ color: '#fff' }}>-</Text></TouchableOpacity>
                            </View>
                        </View>
                    )
                )}

                {activeTab === 'Tags' && (
                    <View style={styles.tagsGrid}>
                        {trendingTags.map(tag => (
                            <TouchableOpacity key={tag} style={styles.tagCard}>
                                <Text style={styles.tagCardText}>{tag}</Text>
                                <Text style={styles.tagCardSub}>Trending in Music</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

export function EventDetailScreen({ event, theme, onBack }) {
    const [isGoing, setIsGoing] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            {isSaved && (
                <View style={styles.saveToast}>
                    <Text style={styles.saveToastText}>✓ Saved to collection</Text>
                </View>
            )}
            <View style={styles.detailHeader}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{event?.title || 'Burj Khalifa Gala'}</Text>
                <TouchableOpacity style={styles.shareBtn}>
                    <Text style={styles.shareIcon}>📤</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailContent}>
                <View style={styles.detailBanner}>
                    <View style={styles.bannerPlaceholder} />
                    <View style={styles.detailTags}>
                        <View style={styles.detailTag}><Text style={styles.detailTagText}>EVENT</Text></View>
                        <View style={styles.detailTag}><Text style={styles.detailTagText}>📍 6419.9 km</Text></View>
                    </View>
                </View>

                <View style={styles.detailInfoSection}>
                    <Text style={styles.detailTitle}>{event?.title || 'Burj Khalifa Gala'}</Text>
                    <Text style={styles.detailMeta}>Friday, January 2 • Time TBC</Text>

                    <View style={styles.actionRow}>
                        {isGoing ? (
                            <TouchableOpacity
                                style={[styles.bigBtn, styles.goingBtn]}
                                onPress={() => setIsGoing(false)}
                            >
                                <Text style={styles.bigBtnText}>✓ Going</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.buttonGroup}>
                                <TouchableOpacity style={[styles.bigBtn, styles.rsvpBtn]}>
                                    <Text style={[styles.bigBtnText, { color: '#4b168c' }]}>⚡ RSVP Now</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.bigBtn, styles.buyBtn]}>
                                    <Text style={[styles.bigBtnText, { color: '#000' }]}>🎫 Buy Ticket</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity style={styles.smallActionBtn}><Text style={styles.smallIcon}>♡</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.smallActionBtn} onPress={handleSave}>
                            <Text style={[styles.smallIcon, isSaved && { color: theme.acc }]}>🔖</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.hostCard}>
                        <View style={styles.hostAvatar} />
                        <View style={styles.hostInfo}>
                            <Text style={styles.hostName}>Dubai Luxury</Text>
                            <Text style={styles.hostLabel}>Host</Text>
                        </View>
                        <TouchableOpacity style={styles.followActionBtn}>
                            <Text style={styles.followActionText}>Follow</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.detailSectionTitle}>About Event</Text>
                    <Text style={styles.detailDesc}>The height of luxury.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

export function LeaderboardScreen({ onNavigate, theme }) {
    const top3 = [
        { id: '2', name: 'Alex', points: '2,450', rank: 2, avatar: '🥈' },
        { id: '1', name: 'Sarah', points: '3,120', rank: 1, avatar: '👑' },
        { id: '3', name: 'Mike', points: '1,890', rank: 3, avatar: '🥉' },
    ];

    const users = [
        { id: '4', name: 'Jordan', points: '1,200', rank: 4 },
        { id: '5', name: 'Casey', points: '1,150', rank: 5 },
        { id: '6', name: 'Taylor', points: '980', rank: 6 },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.sidebarBg }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => onNavigate('feed')}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
                <Text style={styles.headerTitle}>LEADERBOARD</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.podiumContainer}>
                {top3.map(user => (
                    <View key={user.id} style={[styles.podiumItem, user.rank === 1 && styles.firstPlace]}>
                        <Text style={styles.rankAvatar}>{user.avatar}</Text>
                        <Text style={styles.podiumName}>{user.name}</Text>
                        <Text style={styles.podiumPoints}>{user.points} pts</Text>
                    </View>
                ))}
            </View>

            <ScrollView style={styles.listContainer}>
                {users.map(user => (
                    <View key={user.id} style={styles.boardItem}>
                        <Text style={styles.itemRank}>{user.rank}</Text>
                        <View style={styles.itemAvatarSmall} />
                        <Text style={styles.itemName}>{user.name}</Text>
                        <Text style={styles.itemPoints}>{user.points}</Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

export function MessagesScreen({ onNavigate, theme }) {
    const chats = [
        { id: '1', name: 'Sarah', lastMsg: 'See you at the Jazz night!', time: '10m', unread: 2 },
        { id: '2', name: 'Vibe Central', lastMsg: 'Your RSVP is confirmed.', time: '2h', unread: 0 },
        { id: '3', name: 'Gamer Hub', lastMsg: 'New drop alert! 🎮', time: '5h', unread: 1 },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.sidebarBg }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>MESSAGES</Text>
            </View>
            <View style={styles.searchBar}>
                <Text>🔍</Text>
                <TextInput placeholder="Search chats..." placeholderTextColor="rgba(255,255,255,0.4)" style={styles.searchInput} />
            </View>
            <ScrollView style={styles.chatList}>
                {chats.map(chat => (
                    <TouchableOpacity key={chat.id} style={styles.chatItem}>
                        <View style={styles.itemAvatarSmall} />
                        <View style={styles.chatInfo}>
                            <Text style={styles.chatName}>{chat.name}</Text>
                            <Text style={styles.chatMsg} numberOfLines={1}>{chat.lastMsg}</Text>
                        </View>
                        <View style={styles.chatMeta}>
                            <Text style={styles.chatTime}>{chat.time}</Text>
                            {chat.unread > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{chat.unread}</Text></View>}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

export function DropsScreen({ onNavigate, theme }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const numColumns = width > 1200 ? 4 : (width > 768 ? 2 : 1);

    const [drops, setDrops] = useState([
        { id: '1', title: 'Jazz VIP Pass', cost: '500 VP', claimed: false },
        { id: '2', title: 'Tech Hub Sticker', cost: '100 VP', claimed: true },
        { id: '3', title: 'Rooftop NFT', cost: '2500 VP', claimed: false },
        { id: '4', title: 'Coffee Voucher', cost: '300 VP', claimed: false },
    ]);

    const handleClaim = (id) => {
        setDrops(prev => prev.map(d => d.id === id ? { ...d, claimed: true } : d));
        Alert.alert('Success', 'Drop claimed! Check your wallet.');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.sidebarBg }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>EXCLUSIVE DROPS</Text>
            </View>
            <ScrollView contentContainerStyle={[styles.dropsGrid, { paddingHorizontal: isMobile ? 20 : 10 }]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {drops.map(drop => (
                        <View key={drop.id} style={[styles.dropCard, { width: width > 1200 ? '23%' : (width > 768 ? '48%' : '100%') }]}>
                            <View style={styles.dropImage} />
                            <Text style={styles.dropTitle}>{drop.title}</Text>
                            <Text style={styles.dropCost}>{drop.cost}</Text>
                            <TouchableOpacity
                                style={[styles.claimBtn, drop.claimed && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                                onPress={() => !drop.claimed && handleClaim(drop.id)}
                            >
                                <Text style={styles.claimText}>{drop.claimed ? 'Claimed' : 'Claim now'}</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

export function HappeningsScreen({ theme, onNavigate }) {
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.sidebarBg }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>HAPPENINGS</Text>
            </View>
            <ScrollView style={styles.scrollContent}>
                <Text style={styles.sectionTitle}>What's Buzzing</Text>
                <View style={styles.eventRow}>
                    <View style={styles.eventThumb} />
                    <View style={styles.eventInfo}>
                        <Text style={styles.eventName}>Secret Garden Party</Text>
                        <Text style={styles.eventMeta}>Trending in Joburg • 2.4k buzz</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

export function WalletScreen({ theme, onNavigate }) {
    const tickets = [
        { id: '1', event: 'Joburg Rooftop Jazz', date: 'March 15, 2026', time: '19:00', code: 'GRV-JAZZ-X9' },
        { id: '2', event: 'Cape Town Gaming Expo', date: 'April 02, 2026', time: '10:00', code: 'GRV-GAME-L2' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.sidebarBg }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => onNavigate('feed')}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
                <Text style={styles.headerTitle}>MY WALLET</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Total Vibe Points</Text>
                <Text style={styles.balanceValue}>12,450</Text>
                <Text style={styles.balanceEth}>≈ 0.45 ETH</Text>
            </View>

            <Text style={styles.ticketSectionTitle}>My Tickets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ticketScroll}>
                {tickets.map(ticket => (
                    <View key={ticket.id} style={styles.ticketCard}>
                        <View style={styles.ticketMain}>
                            <Text style={styles.ticketEvent}>{ticket.event}</Text>
                            <Text style={styles.ticketDate}>{ticket.date} • {ticket.time}</Text>
                        </View>
                        <View style={styles.qrPlaceholder}>
                            <View style={styles.qrDotContainer}>
                                {[...Array(16)].map((_, i) => <View key={i} style={styles.qrDot} />)}
                            </View>
                            <Text style={styles.qrCodeText}>{ticket.code}</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

export function CommunityScreen({ theme, onNavigate }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [tribesList, setTribesList] = useState([
        { id: '1', name: 'Jazz Lovers', members: '1.2k', desc: 'Chill vibes & saxophones.', joined: true },
        { id: '2', name: 'Techies JHB', members: '3.5k', desc: 'Building the future of Mzansi.', joined: false },
        { id: '3', name: 'Desert Nomads', members: '800', desc: 'Burning Man afrika style.', joined: false },
    ]);

    const toggleJoinTribe = (id) => {
        setTribesList(prev => prev.map(t => t.id === id ? { ...t, joined: !t.joined } : t));
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.sidebarBg }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => onNavigate('feed')}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
                <Text style={styles.headerTitle}>COMMUNITY TRIBES</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={[styles.tribeGrid, { paddingHorizontal: isMobile ? 20 : 10 }]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {tribesList.map(tribe => (
                        <View key={tribe.id} style={[styles.tribeCard, { width: width > 1024 ? '31%' : (width > 768 ? '48%' : '100%') }]}>
                            <View style={styles.tribeHeader}>
                                <View style={styles.tribeAvatar} />
                                <View>
                                    <Text style={styles.tribeName}>{tribe.name}</Text>
                                    <Text style={styles.tribeMembers}>{tribe.members} members</Text>
                                </View>
                            </View>
                            <Text style={styles.tribeDesc}>{tribe.desc}</Text>
                            <TouchableOpacity
                                style={[styles.tribeActionBtn, tribe.joined && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                                onPress={() => toggleJoinTribe(tribe.id)}
                            >
                                <Text style={[styles.tribeActionText, tribe.joined && { opacity: 0.5 }]}>
                                    {tribe.joined ? 'Joined' : 'Join Tribe'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bannerContainer: { width: '100%', height: 200, position: 'relative' },
    bannerPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1e0a35' },
    userFollowedBadge: {
        position: 'absolute',
        top: 20,
        alignSelf: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    followedBadgeText: { color: '#fff', fontWeight: 'bold' },
    profileHeader: {
        flexDirection: 'row',
        paddingHorizontal: 25,
        marginTop: -50,
        alignItems: 'flex-end',
    },
    avatarWrapper: { position: 'relative' },
    avatarCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#333',
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
    levelBadge: {
        position: 'absolute',
        bottom: -15,
        alignSelf: 'center',
        backgroundColor: '#310a5d',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    levelText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    statusDot: {
        position: 'absolute',
        right: 5,
        bottom: 10,
        width: 25,
        height: 25,
        borderRadius: 13,
        backgroundColor: '#22c55e',
        borderWidth: 3,
        borderColor: '#310a5d',
    },
    headerInfo: { flex: 1, marginLeft: 20, paddingBottom: 10 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
    profileName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    verifiedIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelProgressContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    levelProgressText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    xpText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, width: '100%' },
    progressFill: { height: '100%', borderRadius: 3 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingBottom: 15 },
    msgIconBtn: { opacity: 0.6 },
    msgIcon: { fontSize: 24, color: '#fff' },
    followBtn: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25 },
    followBtnText: { color: '#000', fontWeight: 'bold' },
    bioSection: { paddingHorizontal: 25, marginTop: 25 },
    bioText: { color: '#fff', fontSize: 16, marginBottom: 15 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    locIcon: { fontSize: 16, opacity: 0.4 },
    webLink: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.03)',
        margin: 25,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statItem: { flex: 1, alignItems: 'center' },
    statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' },
    statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
    exploreHeader: { flexDirection: 'row', paddingHorizontal: 25, marginTop: 15, gap: 15, alignItems: 'center' },
    searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 25, paddingHorizontal: 20, height: 55, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchIcon: { fontSize: 18, marginRight: 15, opacity: 0.5 },
    searchInput: { flex: 1, color: '#fff', fontSize: 16 },
    viewToggleBtn: { width: 55, height: 55, backgroundColor: 'rgba(168, 85, 247, 0.5)', borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
    viewToggleIcon: { fontSize: 22 },
    tabsContainer: { flexDirection: 'row', paddingHorizontal: 25, marginTop: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    tab: { paddingVertical: 15, marginRight: 30 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#fff' },
    tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
    activeTabText: { color: '#fff' },
    scrollContent: { padding: 25, paddingBottom: 100 },
    sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, marginTop: 10 },
    tagsScroll: { marginBottom: 30 },
    trendingTag: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginRight: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    tagText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    personRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    personAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', marginRight: 15 },
    personInfo: { flex: 1 },
    personName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    personHandle: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
    followBtn: { backgroundColor: '#a855f7', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    followBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    personRowLarge: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
    personAvatarLarge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#333', marginRight: 20 },
    personBio: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 },
    eventRow: { flexDirection: 'row', marginBottom: 30 },
    eventThumb: { width: 80, height: 80, borderRadius: 15, backgroundColor: '#333', marginRight: 20 },
    eventName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    eventMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginVertical: 4 },
    eventSnippet: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
    mapContainer: { width: '100%', height: 400, backgroundColor: '#1e0a35', borderRadius: 20, overflow: 'hidden', position: 'relative' },
    mapMock: { flex: 1 },
    mapPin: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#ff4da6', borderWidth: 3, borderColor: '#fff' },
    mapControls: { position: 'absolute', top: 20, right: 20, gap: 10 },
    mapControlBtn: { width: 40, height: 40, backgroundColor: '#000', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    suggestionsHeader: { padding: 25 },
    suggestionsTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', opacity: 0.8 },
    fabContainer: { position: 'absolute', bottom: 30, right: 20, gap: 15 },
    fabUp: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fabChat: {
        width: 65,
        height: 65,
        borderRadius: 33,
        backgroundColor: '#ff4da6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fabIcon: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
    tagCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 20, width: '47%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    tagCardText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    tagCardSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 5 },

    // New Styles for Event Details & Map Interaction
    activeMapPin: { borderColor: '#a855f7', transform: [{ scale: 1.2 }] },
    mapPreviewCard: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(30, 10, 53, 0.9)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
    },
    previewHeader: { flexDirection: 'row', gap: 15, marginBottom: 15, alignItems: 'flex-start' },
    previewThumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
    previewInfo: { flex: 1 },
    previewTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    previewStatus: { color: '#a855f7', fontSize: 12, fontWeight: 'bold', marginVertical: 2 },
    previewLoc: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    previewBtn: { backgroundColor: '#a855f7', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    previewBtnText: { color: '#fff', fontWeight: 'bold' },

    detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    backIcon: { color: '#fff', fontSize: 24 },
    headerTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    logoutIconText: { fontSize: 20 },

    // Profile Screen Styles
    profileHeader: { alignItems: 'center', paddingVertical: 30 },
    avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#444', marginBottom: 15, position: 'relative' },
    vipBadgeSmall: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#ffcc00', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 2, borderColor: '#310a5d' },
    vipTextSmall: { color: '#000', fontSize: 8, fontWeight: '900' },
    profileName: { color: '#fff', fontSize: 24, fontWeight: '900' },
    profileHandle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 25, gap: 20 },
    statItem: { alignItems: 'center' },
    statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    lineDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 25, marginTop: 20, marginBottom: 15 },
    achievementScroll: { paddingLeft: 25, paddingRight: 10 },
    achievementCard: { width: 80, height: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    achIcon: { fontSize: 28, marginBottom: 8 },
    achLabel: { color: '#fff', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', marginTop: 30, paddingHorizontal: 25 },
    tabItem: { paddingVertical: 15, marginRight: 25, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTabItem: { borderBottomColor: '#a855f7' },
    tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 'bold' },
    activeTabText: { color: '#fff' },
    tabContent: { padding: 50, alignItems: 'center' },
    emptyContentText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },

    // Event Detail Styles
    detailCard: { padding: 25 },
    trendingTribeBadge: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 },
    trendingText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    detailInfo: { marginTop: 25 },
    detailTitle: { color: '#fff', fontSize: 32, fontWeight: '900', lineHeight: 38 },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
    locIcon: { fontSize: 14 },
    locText: { color: '#a855f7', fontSize: 16, fontWeight: 'bold' },
    socialProofSection: { flexDirection: 'row', alignItems: 'center', marginTop: 25, height: 40 },
    avatarStack: { width: 100, height: 40, position: 'relative' },
    stackAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#555', borderWidth: 3, borderColor: '#310a5d', position: 'absolute' },
    proofText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1, marginLeft: 15 },
    detailDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 26, marginTop: 25 },
    lineupCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 25, marginTop: 30 },
    lineupLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    lineupValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 10 },
    bottomAction: { padding: 25, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    mainActionBtn: { height: 65, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    mainActionText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    shareBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
    shareIcon: { fontSize: 20 },

    detailContent: { paddingBottom: 50 },
    detailBanner: { width: '100%', height: 300, position: 'relative' },

    detailTags: { position: 'absolute', bottom: 20, left: 20, flexDirection: 'row', gap: 10 },
    detailTag: { backgroundColor: 'rgba(168, 85, 247, 0.8)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    detailTagText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    detailInfoSection: { padding: 25 },
    detailTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 10 },
    detailMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 16, marginBottom: 25 },

    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 },
    buttonGroup: { flex: 1, flexDirection: 'row', gap: 10 },
    bigBtn: { flex: 1, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    bigBtnText: { fontSize: 16, fontWeight: 'bold' },
    rsvpBtn: { backgroundColor: '#fff' },
    buyBtn: { backgroundColor: '#ffcc00' },
    goingBtn: { backgroundColor: '#10b981', flex: 1 },
    smallActionBtn: { width: 55, height: 55, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    smallIcon: { color: '#fff', fontSize: 20 },

    hostCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 15, borderRadius: 20, marginBottom: 30 },
    hostAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', marginRight: 15 },
    hostInfo: { flex: 1 },
    hostName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    hostLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    followActionBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    followActionText: { color: '#fff', fontWeight: 'bold' },

    detailSectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    detailDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 24 },

    saveToast: {
        position: 'absolute',
        top: 20,
        alignSelf: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
    },
    saveToastText: { color: '#fff', fontWeight: 'bold' },

    // Podium Styles
    podiumContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 20,
    },
    podiumItem: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 20,
        borderRadius: 25,
        width: 100,
    },
    firstPlace: {
        height: 180,
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderColor: '#a855f7',
        borderWidth: 1,
    },
    rankAvatar: { fontSize: 40, marginBottom: 10 },
    podiumName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    podiumPoints: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },

    // Board Items
    boardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 15,
        marginBottom: 10,
        marginHorizontal: 20,
    },
    itemRank: { color: 'rgba(255,255,255,0.3)', width: 30, fontWeight: 'bold' },
    itemAvatarSmall: { width: 35, height: 35, borderRadius: 10, backgroundColor: '#444', marginRight: 15 },
    itemName: { flex: 1, color: '#fff', fontWeight: '600' },
    itemPoints: { color: '#a855f7', fontWeight: 'bold' },

    // Message Styles
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        margin: 20,
        paddingHorizontal: 15,
        height: 50,
        borderRadius: 15,
        gap: 10,
    },
    searchInput: { flex: 1, color: '#fff' },
    chatItem: {
        flexDirection: 'row',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    chatInfo: { flex: 1, marginLeft: 15 },
    chatName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    chatMsg: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 },
    chatMeta: { alignItems: 'flex-end', gap: 8 },
    chatTime: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
    unreadBadge: {
        backgroundColor: '#ff4da6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    unreadText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    // Drops Grid
    dropsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 10,
        gap: 15,
        justifyContent: 'center',
    },
    dropCard: {
        width: '45%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    dropImage: { height: 120, borderRadius: 15, marginBottom: 12 },
    dropType: { color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 },
    dropTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 15 },
    claimBtn: { paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    claimText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    // Wallet Styles
    balanceCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        margin: 25,
        borderRadius: 30,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    balanceLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 10 },
    balanceValue: { color: '#fff', fontSize: 42, fontWeight: '900' },
    balanceEth: { color: '#a855f7', fontSize: 16, marginTop: 5, fontWeight: 'bold' },
    ticketSectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 25, marginBottom: 15 },
    ticketScroll: { paddingLeft: 25, paddingRight: 10 },
    ticketCard: {
        width: 300,
        height: 180,
        backgroundColor: '#fff',
        borderRadius: 25,
        marginRight: 20,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    ticketMain: { flex: 1, padding: 20, justifyContent: 'center' },
    ticketEvent: { color: '#000', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    ticketDate: { color: 'rgba(0,0,0,0.5)', fontSize: 12 },
    qrPlaceholder: {
        width: 100,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 1,
        borderLeftColor: '#e5e7eb',
        borderStyle: 'dashed',
    },
    qrDotContainer: { width: 40, height: 40, flexWrap: 'wrap', flexDirection: 'row', gap: 4 },
    qrDot: { width: 6, height: 6, backgroundColor: '#000' },
    qrCodeText: { color: '#000', fontSize: 10, fontWeight: 'bold', marginTop: 15, opacity: 0.3 },

    // Community Styles
    tribeGrid: { padding: 20, gap: 20 },
    tribeCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 25,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tribeHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
    tribeAvatar: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#444' },
    tribeName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    tribeMembers: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    tribeDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, marginBottom: 20 },
    tribeActionBtn: {
        backgroundColor: '#a855f7',
        paddingVertical: 12,
        borderRadius: 15,
        alignItems: 'center',
    },
    tribeActionText: { color: '#fff', fontWeight: 'bold' },
});
