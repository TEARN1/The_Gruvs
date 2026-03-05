import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Fallback AsyncStorage for Web/Native
let AsyncStorage;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const STORAGE_KEY = 'the-gruvs:events';

// Logic for API URL
// On Web, Vercel allows /api/events
// On Mobile, we need the full URL
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = (Platform.OS === 'web' && !BASE_URL) ? '/api/events' : `${BASE_URL}/api/events`;

export default function App() {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErrorMsg('');

        let initialData = [];

        // 1. Try Local Storage first (Fastest UI)
        try {
          let raw = null;
          if (AsyncStorage) raw = await AsyncStorage.getItem(STORAGE_KEY);
          else if (typeof window !== 'undefined' && window.localStorage) raw = window.localStorage.getItem(STORAGE_KEY);

          if (raw) {
            initialData = JSON.parse(raw);
            setItems(initialData);
          }
        } catch (e) {
          console.warn('Local storage load failed', e);
        }

        // 2. Try to Sync with Backend
        if (BASE_URL || Platform.OS === 'web') {
          try {
            const res = await fetch(API_URL);
            if (res.ok) {
              const apiData = await res.json();
              if (Array.isArray(apiData) && apiData.length > 0) {
                setItems(apiData);
              }
            }
          } catch (apiErr) {
            console.warn('Backend sync failed', apiErr);
          }
        }

      } catch (e) {
        console.error('Load failed', e);
        setErrorMsg('Connection error. Using offline mode.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Save locally whenever items change
  useEffect(() => {
    if (loading) return;
    async function saveLocally() {
      try {
        const raw = JSON.stringify(items);
        if (AsyncStorage) await AsyncStorage.setItem(STORAGE_KEY, raw);
        else if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(STORAGE_KEY, raw);
      } catch (e) {
        console.warn('Local save failed', e);
      }
    }
    saveLocally();
  }, [items, loading]);

  async function addItem() {
    if (!text.trim()) return;
    const newItem = { id: Date.now().toString(), text: text.trim(), done: false };
    setItems(prev => [newItem, ...prev]);
    setText('');

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
    } catch (err) { console.warn('Sync failed'); }
  }

  async function toggleDone(id) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, done: !i.done } : i)));
    try {
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (err) { console.warn('Sync failed'); }
  }

  async function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      const deleteUrl = API_URL.includes('?') ? `${API_URL}&id=${id}` : `${API_URL}?id=${id}`;
      await fetch(deleteUrl, { method: 'DELETE' });
    } catch (err) { console.warn('Sync failed'); }
  }

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      <TouchableOpacity onPress={() => toggleDone(item.id)} style={styles.itemTextWrap}>
        <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>The Gruvs</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add an event..."
            value={text}
            onChangeText={setText}
            onSubmitEditing={addItem}
          />
          <Button title="Add" onPress={addItem} />
        </View>

        {loading && items.length === 0 ? (
          <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>No events yet. Add one above!</Text>}
          />
        )}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', flex: 1 },
  inner: { flex: 1, padding: 20, paddingTop: Platform.OS === 'android' ? 45 : 20 },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 20, color: '#000', textAlign: 'center' },
  inputRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  input: { flex: 1, borderBottomWidth: 2, borderColor: '#000', marginRight: 10, padding: 8, fontSize: 18 },
  list: { paddingBottom: 50 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#eee' },
  itemTextWrap: { flex: 1 },
  itemText: { fontSize: 18, color: '#333' },
  itemDone: { textDecorationLine: 'line-through', color: '#aaa' },
  deleteBtn: { padding: 5 },
  deleteText: { color: '#ff4444', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 }
});
