import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../state/useStore';
import { ACCENT } from '../../theme';

export default function DebugScreen() {
  const { user, posts, loading, error } = useStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Info</Text>
      <ScrollView style={styles.content}>
        <Section title="User">
          <Text style={styles.text}>{JSON.stringify(user, null, 2)}</Text>
        </Section>
        
        <Section title="Posts">
          <Text style={styles.text}>Count: {posts?.length || 0}</Text>
          <Text style={styles.text}>Loading: {loading ? 'yes' : 'no'}</Text>
          {error && <Text style={[styles.text, styles.error]}>{error}</Text>}
        </Section>

        <Section title="Logs">
          <Text style={styles.text}>Check console for detailed logs</Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginBottom: 16,backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8 }}>
      <Text style={{ color: ACCENT, fontWeight: 'bold', marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510', padding: 16, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  content: { flex: 1 },
  text: { color: '#fff', fontSize: 12, fontFamily: 'monospace', marginVertical: 2 },
  error: { color: '#ff4444' },
});
