/**
 * WritingStylePicker — pick your signature font under Switch Aura.
 *
 * Shows 15 Unicode "writing styles" for the current aura/gender, with a big
 * live preview and per-style chips. The pick is saved per-user to AsyncStorage
 * (writing_style:<id>) so composers can stamp it onto what you send.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { transform, stylesForGender } from '../utils/writingStyles';
import { haptics } from '../utils/haptics';

export const writingStyleKey = (userId) => `writing_style:${userId || 'me'}`;

export const WritingStylePicker = ({ gender = 'male', sample = 'The Gruvs', userId, primary = '#00f2ff', textColor = '#fff', muted = 'rgba(255,255,255,0.55)' }) => {
  const [selected, setSelected] = useState('normal');
  const styleOptions = stylesForGender((gender || 'male').replace('_', ' '));

  useEffect(() => {
    AsyncStorage.getItem(writingStyleKey(userId)).then(v => { if (v) setSelected(v); }).catch(() => {});
  }, [userId]);

  const pick = (key) => {
    try { haptics.select?.(); } catch {}
    setSelected(key);
    AsyncStorage.setItem(writingStyleKey(userId), key).catch(() => {});
  };

  const previewText = (sample && sample.trim()) ? sample.trim().slice(0, 16) : 'The Gruvs';

  return (
    <View style={ws.wrap}>
      <View style={ws.headerRow}>
        <Feather name="edit-3" size={14} color={primary} />
        <Text style={[ws.title, { color: textColor }]}>Writing Style</Text>
        <Text style={[ws.count, { color: muted }]}>15 in this aura</Text>
      </View>
      <Text style={[ws.hint, { color: muted }]}>Your signature font. Each aura has its own set — tap to make it yours.</Text>

      <View style={[ws.preview, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}>
        <Text style={[ws.previewText, { color: primary }]} numberOfLines={1}>{transform(previewText, selected)}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 8 }}>
        {styleOptions.map(s => {
          const active = selected === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => pick(s.key)}
              activeOpacity={0.85}
              style={[ws.chip, { backgroundColor: active ? primary : `${primary}10`, borderColor: active ? primary : `${primary}28` }]}
            >
              <Text style={{ color: active ? '#000' : textColor, fontSize: 16 }} numberOfLines={1}>{transform('Aa', s.key)}</Text>
              <Text style={{ color: active ? '#000' : muted, fontSize: 9, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const ws = StyleSheet.create({
  wrap: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '900' },
  count: { fontSize: 10, fontWeight: '700', marginLeft: 'auto' },
  hint: { fontSize: 11, marginBottom: 10, lineHeight: 15 },
  preview: { borderRadius: 14, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', marginBottom: 12 },
  previewText: { fontSize: 24, fontWeight: '800' },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 14, borderWidth: 1, alignItems: 'center', minWidth: 56 },
});

export default WritingStylePicker;