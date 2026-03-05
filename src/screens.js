import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { GENDERS, getTheme, INTERESTS } from './data';
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
                    <Text style={[styles.logo, { color: previewAcc }]}>THE GRUV</Text>
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
    const [edit, setEdit] = useState(false);
    const [form, setForm] = useState({ bio: user?.bio || '', email: user?.email || '', gender: user?.gender || 'male', interests: user?.interests || [] });

    const toggleInterest = (id) => setForm(p => ({ ...p, interests: p.interests.includes(id) ? p.interests.filter(x => x !== id) : [...p.interests, id] }));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <ScrollView contentContainerStyle={{ padding: 25, paddingBottom: 100, maxWidth: 800, alignSelf: 'center', width: '100%' }}>
                <TouchableOpacity onPress={onBack} style={{ marginBottom: 20 }}>
                    <Text style={{ color: theme.acc, fontSize: 15, fontWeight: '600' }}>← Back to Feed</Text>
                </TouchableOpacity>

                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <View style={[styles.avatar, { backgroundColor: theme.acc }]}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text></View>
                    <Text style={[styles.profileName, { color: theme.text }]}>{user?.name}</Text>
                    <Text style={{ color: theme.sub, fontSize: 14 }}>{user?.email}</Text>
                    {user?.bio ? <Text style={{ color: theme.text, marginTop: 10, textAlign: 'center', maxWidth: 400, lineHeight: 22 }}>{user.bio}</Text> : null}

                    <View style={[styles.row, { justifyContent: 'center', marginTop: 15 }]}>
                        {(user?.interests || []).map(intId => {
                            const int = INTERESTS.find(i => i.id === intId);
                            if (!int) return null;
                            return <Text key={intId} style={[styles.pill, { color: int.color, borderColor: int.color }]}>{int.icon} {int.label}</Text>;
                        })}
                    </View>
                </View>

                {!edit ? (
                    <View style={styles.gap}>
                        <GlowButton themeAcc={theme.acc} style={[styles.btn, { backgroundColor: theme.acc }]} onPress={() => setEdit(true)}>
                            <Text style={styles.btnText}>✏️ EDIT PROFILE</Text>
                        </GlowButton>
                        <GlowButton themeAcc="#ef4444" style={[styles.btn, { backgroundColor: '#ef4444' }]} onPress={onLogout}>
                            <Text style={styles.btnText}>LOGOUT</Text>
                        </GlowButton>
                    </View>
                ) : (
                    <View style={styles.gap}>
                        <Text style={[styles.title, { color: theme.text, textAlign: 'left', marginBottom: 5 }]}>Edit Profile</Text>
                        <TextInput style={[styles.input, { backgroundColor: theme.inp, color: theme.it }]} placeholder="Email" value={form.email} onChangeText={t => setForm(p => ({ ...p, email: t }))} placeholderTextColor={theme.sub} />
                        <TextInput style={[styles.input, { backgroundColor: theme.inp, color: theme.it, height: 80 }]} placeholder="Bio" multiline value={form.bio} onChangeText={t => setForm(p => ({ ...p, bio: t }))} placeholderTextColor={theme.sub} />

                        <Text style={[styles.label, { color: theme.text }]}>Gender</Text>
                        <View style={styles.row}>
                            {GENDERS.map(g => (
                                <TouchableOpacity key={g.value} onPress={() => setForm(p => ({ ...p, gender: g.value }))}
                                    style={[styles.pill, { borderColor: g.accent, backgroundColor: form.gender === g.value ? g.accent : 'transparent' }]}>
                                    <Text style={{ color: form.gender === g.value ? '#fff' : g.accent, fontWeight: '700', fontSize: 12 }}>{g.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>Interests</Text>
                        <View style={styles.row}>
                            {INTERESTS.map(int => (
                                <TouchableOpacity key={int.id} onPress={() => toggleInterest(int.id)}
                                    style={[styles.pill, { borderColor: int.color, backgroundColor: form.interests.includes(int.id) ? int.color : 'transparent' }]}>
                                    <Text style={{ color: form.interests.includes(int.id) ? '#fff' : int.color, fontWeight: '700', fontSize: 12 }}>{int.icon} {int.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={[styles.row, { marginTop: 20 }]}>
                            <GlowButton themeAcc="#10b981" style={[styles.btn, { backgroundColor: '#10b981', flex: 1 }]} onPress={() => { onUpdate(form); setEdit(false); }}>
                                <Text style={styles.btnText}>SAVE CHANGES</Text>
                            </GlowButton>
                            <GlowButton themeAcc="#888" style={[styles.btn, { backgroundColor: '#888', flex: 1 }]} onPress={() => setEdit(false)}>
                                <Text style={styles.btnText}>CANCEL</Text>
                            </GlowButton>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center' },
    scroll: { alignItems: 'center', padding: 20, paddingBottom: 40 },
    logo: { fontSize: 28, fontWeight: '900', letterSpacing: 8, marginBottom: 4 },
    tagline: { color: '#888', fontSize: 12, letterSpacing: 5, marginBottom: 30, fontWeight: '600' },
    card: { width: '100%', maxWidth: 500, backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, padding: 30 },
    title: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 20, textAlign: 'center' },
    input: { width: '100%', backgroundColor: '#f5f7f9', padding: 15, borderRadius: 14, marginBottom: 14, fontSize: 15, fontWeight: '500' },
    gap: { width: '100%', gap: 12, marginBottom: 15 },
    label: { fontWeight: '700', color: '#444', marginBottom: 6, fontSize: 13 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 2 },
    btn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 10 },
    btnText: { color: '#fff', fontWeight: '800', letterSpacing: 1.5, fontSize: 14 },
    switchText: { color: '#666', fontSize: 13, textAlign: 'center' },
    avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
    avatarText: { color: '#fff', fontSize: 36, fontWeight: '900' },
    profileName: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
});
