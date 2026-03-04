import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';

let AsyncStorage;
try {
  // optional native async storage
  // will work if `@react-native-async-storage/async-storage` is installed
  // for web, we fall back to window.localStorage
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const STORAGE_KEY = 'the-gruvs:events';
const API_URL = '/api/events';

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

        // Attempt to fetch from our Vercel Serverless Backend
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

        // If backend failed, load locally
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
        setLoading(false); // Done loading! Prevents blank screen.
      }
    }
    load();
  }, []);

  // 2. Battery & CPU Friendly Sync: Only save locally when items actually change, NOT on mount.
  useEffect(() => {
    if (loading) return; // FIX: Prevents saving an empty array over real data before loading finishes

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

    // Optimistic UI update (Fast, responsive feeling for the user)
    setItems(prev => [newItem, ...prev]);
    setText('');

    // Sync to Backend
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
      await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend sync failed for delete:', err);
    }
  }

  const renderItem = ({ item }) => {
    // Failsafe against corrupted local storage data
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

      {/* Show a spinner instead of a blank screen while loading */}
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i?.id || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          // Performance optimization for long lists (battery/CPU friendly):
          removeClippedSubviews={true}
          initialNumToRender={10}
        />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', flex: 1, padding: 16 },
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
