import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEY = 'gruv_search_history';
const MAX_HISTORY = 10;

export const saveSearch = async (query) => {
  if (!query || !query.trim()) return;
  const trimmed = query.trim();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const deduped = [trimmed, ...existing.filter((q) => q !== trimmed)];
    const capped = deduped.slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // ignore storage errors
  }
};

export const SearchHistoryBar = ({ onSelect, currentQuery }) => {
  const { currentTheme } = useTheme();
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const deleteEntry = useCallback(async (query) => {
    try {
      const updated = history.filter((q) => q !== query);
      setHistory(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [history]);

  const clearAll = useCallback(async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  if (currentQuery || history.length === 0) return null;

  const primary = currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#131a1c";
  const text = currentTheme?.text || "#ffffff";

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {history.map((query) => (
          <View
            key={query}
            style={[styles.chip, { backgroundColor: surface, borderColor: primary + '40' }]}
          >
            <Feather name="clock" size={12} color={primary} style={styles.chipIcon} />
            <TouchableOpacity
              onPress={() => onSelect(query)}
              activeOpacity={0.7}
              style={styles.chipTextTouchable}
            >
              <Text style={[styles.chipText, { color: text }]} numberOfLines={1}>
                {query}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteEntry(query)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.deleteBtn}
            >
              <Feather name="x" size={11} color={text + '80'} />
            </TouchableOpacity>
          </View>
        ))}

        {history.length > 0 && (
          <TouchableOpacity
            onPress={clearAll}
            activeOpacity={0.7}
            style={styles.clearBtn}
          >
            <Text style={[styles.clearText, { color: primary }]}>Clear all</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 160,
  },
  chipIcon: {
    marginRight: 5,
  },
  chipTextTouchable: {
    flex: 1,
    flexShrink: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteBtn: {
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
