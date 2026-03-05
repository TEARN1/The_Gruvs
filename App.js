import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

let AsyncStorage;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const STORAGE_KEY = 'the-gruvs:events';

// For Web, /api works if hosted on the same domain (Vercel).
// For Mobile, we MUST use an absolute URL.
// Change 'https://the-gruvs.vercel.app' to your actual Vercel deployment URL.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = BASE_URL ? `${BASE_URL}/api/events` : '/api/events';

export default function App() {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initial Load: Try Backend, fallback to Local Storage
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErrorMsg('');

        let dataFetched = false;

        // If we're on mobile and have no BASE_URL, we can't fetch from backend.
        if (Platform.OS !== 'web' && !BASE_URL) {
          console.warn('No API BASE_URL configured for mobile. Falling back to local storage.');
        } else {
          try {
            const res = await fetch(API_URL);
            if (res.ok) {
              const apiData = await res.json();
              if (Array.isArray(apiData)) {
                setItems(apiData);
                dataFetched = true;
              }
            }
          } catch (apiErr) {
            console.warn('Backend unavailable, falling back to local storage', apiErr);
          }
        }

        if (!dataFetched) {
          let raw = null;
          if (AsyncStorage) raw = await AsyncStorage.getItem(STORAGE_KEY);
          else if (typeof window !== 'undefined' && window.localStorage) raw = window.localStorage.getItem(STORAGE_KEY);

          if (raw) setItems(JSON.parse(raw));
        }

      } catch (e) {
        console.error('Critical failure loading items:', e);
        setErrorMsg('Unable to load data. Please refresh.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 2. Battery & CPU Friendly Sync: Only save locally when items actually change.
  useEffect(() => {
    if (loading) return;

    async function saveLocally() {
      try {
        const raw = JSON.stringify(items);
        if (AsyncStorage) await AsyncStorage.setItem(STORAGE_KEY, raw);
        else if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(STORAGE_KEY, raw);
      } catch (e) {
        console.warn('Failed to save items to local storage', e);
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
    } catch (err) {
      console.warn('Backend sync failed for add:', err);
    }
  }

  async function toggleDone(id) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, done: !i.done } : i)));
    try {
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (err) {
      console.warn('Backend sync failed for toggle:', err);
    }
  }

  async function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      const deleteUrl = API_URL.includes('?') ? `${API_URL}&id=${id}` : `${API_URL}?id=${id}`;
      await fetch(deleteUrl, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend sync failed for delete:', err);
    }
  }

  const renderItem = ({ item }) => {
    if (!item) return null;
    return (
      <View style={styles.itemRow}>
        <TouchableOpacity onPress={() => toggleDone(item.id)} style={styles.itemTextWrap}>
          <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>The Gruvs</Text>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

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

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i?.id || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          removeClippedSubviews={true}
          initialNumToRender={10}
        />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', flex: 1, padding: 16, paddingTop: Platform.OS === 'android' ? 40 : 16 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  deleteText: { color: '#d00', fontWeight: 'bold' },
  errorText: { color: 'red', marginBottom: 10, textAlign: 'center' },
  input: { borderColor: '#ccc', borderRadius: 6, borderWidth: 1, flex: 1, marginRight: 8, padding: 10, backgroundColor: '#f9f9f9' },
  inputRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 16 },
  itemDone: { color: '#888', textDecorationLine: 'line-through' },
  itemRow: { alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', paddingVertical: 12 },
  itemText: { fontSize: 16, color: '#333' },
  itemTextWrap: { flex: 1 },
  list: { paddingBottom: 80 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16, color: '#111', textAlign: 'center' }
});
