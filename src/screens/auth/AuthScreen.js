import React, { useState } from 'react';
import { useStore } from '../../state/useStore';
import { 
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, 
  KeyboardAvoidingView, Platform, SafeAreaView, Alert, ActivityIndicator 
} from 'react-native';
import { GENDERS, INTERESTS } from '../../data';
import GruvsLogo from '../../components/GruvsLogo';

export default function AuthScreen() {
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', gender: 'other' });
    const [interests, setInterests] = useState([]);

    const isSignup = mode === 'signup';
    const previewAcc = GENDERS.find(g => g.value === form.gender)?.accent || '#ff4da6';

    const toggleInterest = (id) => {
        setInterests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const { signUp, signIn, loading, error } = useStore();

    const handleSubmit = async () => {
        if (isSignup) {
            if (!form.email || !form.password || !form.username) {
                Alert.alert('Missing Fields', 'Please fill in all required fields.');
                return;
            }
            if (form.password !== form.confirm) {
                Alert.alert('Mismatch', 'Passwords do not match.');
                return;
            }
            const res = await signUp(form.email, form.password, { 
                username: form.username, 
                gender: form.gender, 
                interests 
            });
            if (res.success) Alert.alert('Success', 'Account created! Welcome to the frequency.');
        } else {
            const res = await signIn(form.email || form.username, form.password);
            if (res.success) {
                // Login handles state change
            }
        }
    };

    const handleVisitor = () => {
        useStore.getState().setUser({ id: 'visitor', name: 'Visitor', visitor: true });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#050514' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={[styles.center, { flexGrow: 1, paddingVertical: 40 }]}>
                    <View style={styles.glassContainerAuth}>
                        <GruvsLogo size={80} style={{ marginBottom: 15 }} />
                        <Text style={styles.tagline}>ADVANCED NETWORK</Text>

                        <Text style={styles.authTitle}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>

                        <TextInput 
                          style={styles.glassInput} 
                          placeholder={isSignup ? "Username" : "Email or Username"} 
                          placeholderTextColor="rgba(255,255,255,0.6)" 
                          value={isSignup ? form.username : (form.email || form.username)} 
                          onChangeText={t => setForm(p => ({ ...p, username: t, email: isSignup ? p.email : t }))} 
                        />
                        
                        {isSignup && (
                          <TextInput 
                            style={styles.glassInput} 
                            placeholder="Email" 
                            placeholderTextColor="rgba(255,255,255,0.6)" 
                            value={form.email} 
                            onChangeText={t => setForm(p => ({ ...p, email: t }))} 
                            keyboardType="email-address" 
                          />
                        )}

                        <TextInput 
                          style={styles.glassInput} 
                          placeholder="Password" 
                          placeholderTextColor="rgba(255,255,255,0.6)" 
                          secureTextEntry 
                          value={form.password} 
                          onChangeText={t => setForm(p => ({ ...p, password: t }))} 
                        />

                        {isSignup && (
                          <TextInput 
                            style={styles.glassInput} 
                            placeholder="Confirm Password" 
                            placeholderTextColor="rgba(255,255,255,0.6)" 
                            secureTextEntry 
                            value={form.confirm} 
                            onChangeText={t => setForm(p => ({ ...p, confirm: t }))} 
                          />
                        )}

                        {isSignup && (
                            <View style={styles.gap}>
                                <Text style={styles.glassLabel}>Select Gender</Text>
                                <View style={styles.row}>
                                    {GENDERS.map(g => (
                                        <TouchableOpacity key={g.value} onPress={() => setForm(p => ({ ...p, gender: g.value }))}
                                            style={[styles.glassPill, { borderColor: form.gender === g.value ? g.accent : 'rgba(255,255,255,0.3)', backgroundColor: form.gender === g.value ? g.accent : 'transparent' }]}>
                                            <Text style={{ color: form.gender === g.value ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 13 }}>{g.icon} {g.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.glassLabel, { marginTop: 15 }]}>What are your interests?</Text>
                                <View style={styles.row}>
                                    {INTERESTS.map(int => (
                                        <TouchableOpacity key={int.id} onPress={() => toggleInterest(int.id)}
                                            style={[styles.glassPill, { borderColor: interests.includes(int.id) ? int.color : 'rgba(255,255,255,0.3)', backgroundColor: interests.includes(int.id) ? int.color : 'transparent' }]}>
                                            <Text style={{ color: interests.includes(int.id) ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 12 }}>{int.icon} {int.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {error && <Text style={{ color: '#ef4444', marginBottom: 12, fontSize: 13, textAlign: 'center' }}>{error}</Text>}

                        <TouchableOpacity 
                          style={[styles.glassJoinBtn, { backgroundColor: previewAcc }]} 
                          onPress={handleSubmit}
                          disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.glassJoinBtnText}>{isSignup ? 'SIGN UP' : 'LOGIN'}</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setMode(isSignup ? 'login' : 'signup')}>
                            <Text style={styles.switchText}>
                                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                                <Text style={{ color: previewAcc, fontWeight: '800' }}>{isSignup ? 'LOGIN' : 'SIGN UP'}</Text>
                            </Text>
                        </TouchableOpacity>

                        {!isSignup && (
                          <TouchableOpacity style={{ marginTop: 30, opacity: 0.8 }} onPress={handleVisitor}>
                              <Text style={styles.switchText}>Just Looking Around</Text>
                          </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    glassContainerAuth: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 30,
        padding: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center'
    },
    tagline: { color: 'rgba(255,255,255,0.5)', letterSpacing: 4, fontSize: 10, fontWeight: '800', marginBottom: 5 },
    authTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 25, textAlign: 'center' },
    glassInput: { 
        width: '100%', 
        height: 54, 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        borderRadius: 16, 
        paddingHorizontal: 20, 
        color: '#fff', 
        fontSize: 15, 
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    glassLabel: { color: 'rgba(255,255,255,0.6)', alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', marginBottom: 10 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 10 },
    glassPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    glassJoinBtn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowOpacity: 0.3, shadowRadius: 10 },
    glassJoinBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    switchText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },
    gap: { width: '100%', marginVertical: 10 }
});
