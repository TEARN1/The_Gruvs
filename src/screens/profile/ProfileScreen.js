import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useStore } from '../../state/useStore';
import { ACCENT, THEME, GOLD } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }) {
  const { user, setUser } = useStore();
  const [ghostMode, setGhostMode] = useState(false);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>You are not logged in.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Landing')}>
          <Text style={styles.btnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{user.name[0]}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <View style={styles.proBadge}><Text style={styles.proText}>PRO</Text></View>
      </View>

      <View style={styles.settingRow}>
        <View>
          <Text style={styles.settingTitle}>Ghost Mode</Text>
          <Text style={styles.settingDesc}>Hide location from the global map</Text>
        </View>
        <Switch value={ghostMode} onValueChange={setGhostMode} trackColor={{ false: '#2a2a4a', true: ACCENT }} />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => { setUser(null); navigation.navigate('Landing'); }}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg, padding: 20 },
  header: { alignItems: 'center', marginVertical: 40 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1e1e3f', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  proBadge: { backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  proText: { color: '#000', fontWeight: '900', fontSize: 12 },
  
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.card, padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: THEME.cardBorder },
  settingTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  settingDesc: { color: THEME.sub, fontSize: 13 },
  
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 16, marginTop: 'auto', marginBottom: 40 },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '800' },
  
  title: { color: '#fff', fontSize: 18, marginBottom: 20, textAlign: 'center' },
  btn: { backgroundColor: ACCENT, padding: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});
