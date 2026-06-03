import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ScrollView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ALL_CATEGORIES, CATEGORY_GROUPS, searchCategories } from '../constants/AllCategories';
import { useBackClose } from '../hooks/useBackClose';

const CategoryCell = React.memo(({ item, isSelected, color, textColor, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={[
      cp.cell,
      {
        backgroundColor: isSelected ? `${color}22` : `${color}0A`,
        borderColor: isSelected ? color : `${color}22`,
        ...(Platform.OS === 'web' && isSelected ? { boxShadow: `0 0 10px ${color}50` } : {}),
      },
    ]}
  >
    <Text style={cp.cellIcon}>{item.icon}</Text>
    <Text style={[cp.cellLabel, { color: isSelected ? color : textColor }]} numberOfLines={2}>
      {item.label}
    </Text>
    {isSelected && (
      <View style={[cp.checkBadge, { backgroundColor: color }]}>
        <Feather name="check" size={8} color="#000" />
      </View>
    )}
  </TouchableOpacity>
));

export const CategoryPickerModal = ({
  visible,
  onClose,
  selected = [],       // array of keys
  onConfirm,           // (selectedKeys) => void
  multiSelect = true,
  maxSelect = null,    // null = unlimited
  title = 'Pick Categories',
}) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface    || "#131a1c";

  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [picks, setPicks] = useState(() => new Set(selected));
  const [customInput, setCustomInput] = useState('');

  const results = useMemo(() => {
    let list = searchCategories(query);
    if (activeGroup !== 'All') list = list.filter(c => c.group === activeGroup);
    return list;
  }, [query, activeGroup]);

  const toggle = useCallback((key) => {
    setPicks(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (maxSelect && next.size >= maxSelect) return prev;
        next.add(key);
      }
      return next;
    });
  }, [maxSelect]);

  const renderCategoryItem = useCallback(({ item }) => (
    <CategoryCell
      item={item}
      isSelected={picks.has(item.key)}
      color={item.color}
      textColor={textColor}
      onPress={() => toggle(item.key)}
    />
  ), [picks, toggle, textColor]);

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const key = `custom_${trimmed.toLowerCase().replace(/\s+/g, '_')}`;
    // Add to picks directly
    setPicks(prev => {
      const next = new Set(prev);
      if (maxSelect && next.size >= maxSelect) return prev;
      next.add(key);
      return next;
    });
    setCustomInput('');
  };

  const confirm = () => {
    onConfirm?.(Array.from(picks));
    onClose();
  };

  const clearAll = () => setPicks(new Set());

  const groups = ['All', ...CATEGORY_GROUPS];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cp.overlay}>
        <View style={[cp.sheet, { backgroundColor: bg, borderColor: `${primary}25` }]}>

          {/* Handle bar */}
          <View style={[cp.pill, { backgroundColor: `${primary}50` }]} />

          {/* Header */}
          <View style={cp.header}>
            <View style={{ flex: 1 }}>
              <Text style={[cp.title, { color: primary }]}>{title}</Text>
              <Text style={[cp.subtitle, { color: muted }]}>
                {picks.size} selected{maxSelect ? ` / ${maxSelect} max` : ''} · {ALL_CATEGORIES.length}+ types
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={[cp.searchWrap, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}>
            <Feather name="search" size={16} color={query ? primary : muted} />
            <TextInput
              style={[cp.searchInput, { color: textColor }]}
              placeholder="Search any interest..."
              placeholderTextColor={muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x-circle" size={16} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Group tabs */}
          {!query && (
            <ScrollView showsVerticalScrollIndicator={false}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={cp.groupScroll}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {groups.map(g => {
                const isActive = activeGroup === g;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setActiveGroup(g)}
                    style={[
                      cp.groupPill,
                      {
                        backgroundColor: isActive ? primary : `${primary}10`,
                        borderColor: isActive ? primary : `${primary}25`,
                      },
                    ]}
                  >
                    <Text style={[cp.groupText, { color: isActive ? '#000' : primary }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Category grid */}
          <FlatList
            data={results}
            keyExtractor={item => item.key}
            numColumns={3}
            style={cp.list}
            contentContainerStyle={cp.grid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={renderCategoryItem}
            ListEmptyComponent={
              <View style={cp.empty}>
                <Text style={{ fontSize: 32 }}>🔍</Text>
                <Text style={[cp.emptyText, { color: muted }]}>No categories match "{query}"</Text>
                <Text style={[cp.emptySub, { color: muted }]}>Add it as a custom category below!</Text>
              </View>
            }
          />

          {/* Custom category input */}
          <View style={[cp.customRow, { borderTopColor: `${primary}15` }]}>
            <View style={[cp.customInputWrap, { borderColor: `${primary}30` }]}>
              <TextInput
                style={[cp.customInput, { color: textColor }]}
                placeholder="Add your own category..."
                placeholderTextColor={muted}
                value={customInput}
                onChangeText={setCustomInput}
                onSubmitEditing={addCustom}
                returnKeyType="done"
                maxLength={40}
              />
            </View>
            <TouchableOpacity
              style={[cp.customAddBtn, { backgroundColor: customInput.trim() ? primary : `${primary}20` }]}
              onPress={addCustom}
            >
              <Feather name="plus" size={18} color={customInput.trim() ? '#000' : muted} />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={cp.footer}>
            <TouchableOpacity onPress={clearAll} style={cp.clearBtn}>
              <Text style={[cp.clearText, { color: muted }]}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cp.confirmBtn, { backgroundColor: picks.size > 0 ? primary : `${primary}30` }]}
              onPress={confirm}
            >
              <Feather name="check" size={16} color={picks.size > 0 ? '#000' : muted} />
              <Text style={[cp.confirmText, { color: picks.size > 0 ? '#000' : muted }]}>
                Confirm {picks.size > 0 ? `(${picks.size})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const CELL_SIZE = 100;

const cp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: {
    height: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pill: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { fontSize: 11, marginTop: 3, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14,
    height: 46, borderRadius: 23, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  groupScroll: { maxHeight: 44, marginBottom: 12 },
  groupPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  groupText: { fontSize: 11, fontWeight: '800' },
  list: { flex: 1 },
  grid: { paddingHorizontal: 12, paddingBottom: 10, gap: 0 },
  cell: {
    flex: 1,
    margin: 4,
    minWidth: CELL_SIZE,
    maxWidth: CELL_SIZE,
    height: 82,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    position: 'relative',
  },
  cellIcon: { fontSize: 22 },
  cellLabel: { fontSize: 10, fontWeight: '800', textAlign: 'center', paddingHorizontal: 4, lineHeight: 13 },
  checkBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 12 },
  customRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1,
  },
  customInputWrap: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  customInput: { fontSize: 13 },
  customAddBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  clearBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  clearText: { fontSize: 13, fontWeight: '700' },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 30 },
  confirmText: { fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});
