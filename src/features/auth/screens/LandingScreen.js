import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../../core/state/useStore';
import { ACCENT } from '../../../core/theme';
import GruvsLogo from '../../../shared/components/GruvsLogo';

export default function LandingScreen({ navigation }) {
  const setUser = useStore(s => s.setUser);

  const handleJoin = () => {
    navigation.navigate('Auth');
  };

  const handleVisitor = () => {
    setUser({ id: 'visitor', name: 'Visitor', gender: 'other', visitor: true });
  };

  return (
    <View style={styles.authPage}>
      <View style={styles.glassContainer}>
        <GruvsLogo size={80} style={{ marginBottom: 20 }} />
        <View style={styles.authWelcomeRow}>
          <Text style={styles.authWelcomeTitle}>Welcome to the Frequency</Text>
          <Ionicons name="sparkles" size={24} color={ACCENT} />
        </View>
        <Text style={styles.subTitle}>Find Your Frequency.</Text>
        <Text style={styles.authDesc}>Join the movement. Curate your vibe, find your crew, and unlock exclusive drops.</Text>
        
        <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
          <Text style={styles.joinBtnText}>Join the Gruvs</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.lookBtn} onPress={handleVisitor}>
          <Text style={styles.lookBtnText}>Just Looking Around</Text>
        </TouchableOpacity>
        
        <Text style={styles.legalText}>By continuing, you agree to our Terms & Privacy Policy.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authPage: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 25,
    backgroundColor: '#050514'
  },
  glassContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      web: { boxShadow: '0 10px 20px rgba(0,0,0,0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
      }
    })
  },
  authWelcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, justifyContent: 'center' },
  authWelcomeTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: '600', marginBottom: 15, textAlign: 'center' },
  authDesc: { color: '#f1f5f9', fontSize: 15, lineHeight: 22, marginBottom: 30, textAlign: 'center' },
  joinBtn: { 
    width: '100%', 
    backgroundColor: ACCENT, 
    paddingVertical: 18, 
    borderRadius: 20, 
    alignItems: 'center', 
    marginBottom: 15,
    ...Platform.select({
      web: { boxShadow: `0 8px 10px ${ACCENT}66` },
      default: { shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 }
    })
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  lookBtn: { width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 18, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  lookBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  legalText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 30 },
});
