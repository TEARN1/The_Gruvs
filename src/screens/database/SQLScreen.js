import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, ACCENT } from '../../theme';

export default function SQLScreen() {
  const [query, setQuery] = useState('SELECT * FROM events LIMIT 5;');
  
  const mockResult = [
    { id: 1, title: 'Summer Jazz Night', category: 'Music', date: '2026-06-15' },
    { id: 2, title: 'Tech Meetup', category: 'Networking', date: '2026-06-20' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="database" size={28} color={ACCENT} />
        <Text style={styles.headerTitle}>SQL EXPLORER</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.queryCard}>
          <Text style={styles.label}>Console</Text>
          <TextInput
            style={styles.input}
            multiline
            value={query}
            onChangeText={setQuery}
            placeholder="Enter SQL query..."
            placeholderTextColor={THEME.sub}
          />
          <TouchableOpacity style={styles.runBtn}>
            <Text style={styles.runBtnText}>Run Query</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.label}>Results</Text>
          {mockResult.map((item, index) => (
            <View key={index} style={styles.row}>
              <Text style={styles.rowText}>{JSON.stringify(item, null, 2)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  queryCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    marginBottom: 20,
  },
  label: {
    color: THEME.sub,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontFamily: 'monospace',
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  runBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  runBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  resultCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  row: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  rowText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
