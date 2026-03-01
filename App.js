import React, {useState, useEffect} from 'react';
import {SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet} from 'react-native';
import {StatusBar} from 'expo-status-bar';

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

export default function App() {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        let raw = null;
        if (AsyncStorage) raw = await AsyncStorage.getItem(STORAGE_KEY);
        else if (typeof window !== 'undefined' && window.localStorage) raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setItems(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to load items', e);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function save() {
      try {
        const raw = JSON.stringify(items);
        if (AsyncStorage) await AsyncStorage.setItem(STORAGE_KEY, raw);
        else if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(STORAGE_KEY, raw);
      } catch (e) {
        console.warn('Failed to save items', e);
      }
    }
    save();
  }, [items]);

  function addItem() {
    if (!text.trim()) return;
    const newItem = {id: Date.now().toString(), text: text.trim(), done: false};
    setItems(prev => [newItem, ...prev]);
    setText('');
  }

  function toggleDone(id) {
    setItems(prev => prev.map(i => (i.id === id ? {...i, done: !i.done} : i)));
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const renderItem = ({item}) => (
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
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {backgroundColor: '#fff', flex: 1, padding: 16},
  deleteBtn: {paddingHorizontal: 12, paddingVertical: 6},
  deleteText: {color: '#d00'},
  input: {borderColor: '#ccc', borderRadius: 6, borderWidth: 1, flex: 1, marginRight: 8, padding: 10},
  inputRow: {alignItems: 'center', flexDirection: 'row', marginBottom: 12},
  itemDone: {color: '#888', textDecorationLine: 'line-through'},
  itemRow: {alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', paddingVertical: 10},
  itemText: {fontSize: 16},
  itemTextWrap: {flex: 1},
  list: {paddingBottom: 80},
  title: {fontSize: 28, fontWeight: '700', marginBottom: 12}
});
