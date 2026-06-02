import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;

const extractHashtags = (text) => {
  if (!text) return [];
  const matches = [];
  let match;
  while ((match = HASHTAG_REGEX.exec(text)) !== null) {
    matches.push(match[1].toLowerCase());
  }
  return matches;
};

const aggregateTags = (texts) => {
  const counts = {};
  for (const text of texts) {
    for (const tag of extractHashtags(text)) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
};

const fetchFromHashtagsTable = async () => {
  const { data, error } = await supabase
    .from('hashtags')
    .select('tag, count')
    .order('count', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
};

const fetchFallbackFromEvents = async () => {
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('description')
    .not('description', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (evErr) throw evErr;

  const { data: echoes, error: ecErr } = await supabase
    .from('echoes')
    .select('body')
    .not('body', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const texts = [
    ...(events || []).map((e) => e.description || ''),
    ...(!ecErr && echoes ? echoes.map((e) => e.body || '') : []),
  ];

  return aggregateTags(texts);
};

export const HashtagStrip = ({ onTagSelect }) => {
  const { currentTheme } = useTheme();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState(null);

  const primary = currentTheme?.primary || "#00f2ff";
  const surface = currentTheme?.surface || "#131a1c";
  const text = currentTheme?.text || "#ffffff";
  const background = currentTheme?.background || "#0d1112";

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      // Skip the hashtags table (doesn't exist in DB) — extract from events/echoes directly
      const data = await fetchFallbackFromEvents();
      setTags(data || []);
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleTagPress = useCallback(
    (tag) => {
      const formatted = '#' + tag;
      const next = activeTag === formatted ? null : formatted;
      setActiveTag(next);
      onTagSelect && onTagSelect(next);
    },
    [activeTag, onTagSelect]
  );

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="small" color={primary} />
      </View>
    );
  }

  if (tags.length === 0) return null;

  return (
    <View style={[styles.wrapper, { backgroundColor: background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tags.map(({ tag, count }) => {
          const formatted = '#' + tag;
          const isActive = activeTag === formatted;
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => handleTagPress(tag)}
              activeOpacity={0.75}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? primary : surface,
                  borderColor: isActive ? primary : primary + '35',
                },
              ]}
            >
              <Feather
                name="hash"
                size={11}
                color={isActive ? background : primary}
                style={styles.hashIcon}
              />
              <Text
                style={[
                  styles.tagText,
                  { color: isActive ? background : text },
                ]}
              >
                {tag}
              </Text>
              <Text
                style={[
                  styles.countBadge,
                  { color: isActive ? background + 'cc' : text + '60' },
                ]}
              >
                {' '}
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 10,
  },
  loadingWrapper: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  hashIcon: {
    marginRight: 2,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  countBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
});
