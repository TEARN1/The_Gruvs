import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
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

            {/* Floating Buttons */}
            <View style={styles.fabContainer}>
                <TouchableOpacity style={styles.fabUp}><Text style={styles.fabIcon}>↑</Text></TouchableOpacity>
                <TouchableOpacity style={styles.fabChat}><Text style={styles.fabIcon}>💬</Text></TouchableOpacity>
            </View>
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
    tabsContainer: { flexDirection: 'row', paddingHorizontal: 25, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    tab: { paddingVertical: 15, marginRight: 30 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#fff' },
    tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
    activeTabText: { color: '#fff' },
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
    fabIcon: { color: '#fff', fontSize: 24, fontWeight: 'bold' }
});
