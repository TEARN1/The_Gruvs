/**
 * ViberSearchPickerModal — Search and share ANY Viber's card into direct messages.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SmartImage } from './SmartImage';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../utils/haptics';

export function ViberSearchPickerModal({
  visible,
  onClose,
  onSelectViber,
}) {
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#090d0f';
  const surface   = currentTheme?.surface   || '#131b1f';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.72)';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      return;
    }
    // Pre-load active vibers
    loadTrendingVibers();
  }, [visible]);

  const loadTrendingVibers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, vibe_score, is_verified, followers_count')
        .order('vibe_score', { ascending: false })
        .limit(10);
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text) => {
    setQuery(text);
    if (!text.trim()) {
      loadTrendingVibers();
      return;
    }
    setLoading(true);
    try {
      const clean = text.trim().replace(/^@/, '');
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, vibe_score, is_verified, followers_count')
        .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
        .limit(15);
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: bg, borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: `${primary}20` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="search" size={18} color={primary} />
              <Text style={[styles.headerTitle, { color: textColor }]}>SHARE A VIBE CARD</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBox, { backgroundColor: surface, borderColor: `${primary}30` }]}>
            <Feather name="at-sign" size={15} color={primary} />
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="Search by username or display name..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={query}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Feather name="x-circle" size={14} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results List */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 8 }}>
            {loading ? (
              <ActivityIndicator color={primary} style={{ marginTop: 20 }} />
            ) : results.length === 0 ? (
              <Text style={[styles.emptyText, { color: muted }]}>No Vibers found</Text>
            ) : (
              results.map((viber) => (
                <TouchableOpacity
                  key={viber.id}
                  onPress={() => {
                    haptics.impactLight();
                    onSelectViber(viber);
                  }}
                  style={[styles.viberRow, { backgroundColor: surface, borderColor: `${primary}20` }]}
                >
                  <SmartImage source={viber.avatar_url} style={styles.avatar} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.username, { color: textColor }]}>
                        @{viber.username || 'viber'}
                      </Text>
                      {viber.is_verified && <Feather name="check-circle" size={12} color={primary} />}
                    </View>
                    <Text style={[styles.displayName, { color: muted }]}>
                      {viber.display_name || 'Viber'}
                    </Text>
                  </View>
                  <View style={[styles.vibeScoreBadge, { backgroundColor: `${primary}15` }]}>
                    <Feather name="zap" size={11} color={primary} />
                    <Text style={[styles.scoreText, { color: primary }]}>{viber.vibe_score || 0}</Text>
                  </View>
                  <Feather name="share-2" size={15} color={primary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 13,
  },
  viberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  username: {
    fontSize: 13,
    fontWeight: '800',
  },
  displayName: {
    fontSize: 11,
  },
  vibeScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
