/**
 * QuickThemeBar.js — High-accessibility quick theme & brightness switcher for The Gruvs.
 * Placed directly near the top header so users can effortlessly toggle between Light and Dark
 * modes and preview all 24 vibrant themes without digging through settings.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { THEMES, GENDERS } from '../constants/Themes';
import { cyberAudio } from '../utils/cyberAudio';
import { useToast } from './ToastNotification';

export function QuickThemeBar({ isOpen, onClose }) {
  const { currentTheme, gender, themeIndex, changeTheme, isLight, toggleLightDark } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'light' | 'dark'
  const [selectedGender, setSelectedGender] = useState(gender || GENDERS.MALE);

  const primary = currentTheme?.primary || '#00f2ff';
  const surface = currentTheme?.surface || '#172023';
  const textColor = currentTheme?.text || '#ffffff';
  const textMuted = currentTheme?.textMuted || 'rgba(255,255,255,0.7)';
  const borderCol = currentTheme?.borderColor || 'rgba(255,255,255,0.15)';

  // Filter themes according to tab (light = indices 4..7, dark = indices 0..3)
  const availableThemes = useMemo(() => {
    const list = THEMES[selectedGender] || [];
    return list.map((t, index) => ({
      ...t,
      index,
      isThemeLight: index >= 4,
    })).filter(t => {
      if (activeTab === 'light') return t.isThemeLight;
      if (activeTab === 'dark') return !t.isThemeLight;
      return true;
    });
  }, [selectedGender, activeTab]);

  const handleSelectTheme = (idx) => {
    try { cyberAudio?.play?.('lockVibe'); } catch {}
    changeTheme(selectedGender, idx);
    const chosen = THEMES[selectedGender]?.[idx];
    if (chosen) {
      toast?.show?.(`Switched to ${chosen.name} (${idx >= 4 ? 'Light' : 'Dark'})`, 'success');
    }
  };

  const handleToggleLightDark = () => {
    try { cyberAudio?.play?.('telemetryTick'); } catch {}
    toggleLightDark();
    toast?.show?.(isLight ? 'Switched to Dark Mode' : 'Switched to Light Mode', 'success');
  };

  if (!isOpen) return null;

  return (
    <View style={[styles.container, { backgroundColor: surface, borderColor: borderCol }]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Feather name={isLight ? 'sun' : 'moon'} size={18} color={primary} />
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Themes & Brightness
          </Text>
          <View style={[styles.modeBadge, { backgroundColor: isLight ? 'rgba(0,119,182,0.15)' : 'rgba(0,242,255,0.15)' }]}>
            <Text style={[styles.modeBadgeText, { color: primary }]}>
              {isLight ? 'Light Mode' : 'Dark Mode'}
            </Text>
          </View>
        </View>

        <View style={styles.actionBtns}>
          {/* Quick Toggle Light / Dark */}
          <TouchableOpacity
            style={[styles.togglePill, { backgroundColor: primary, borderColor: primary }]}
            onPress={handleToggleLightDark}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${isLight ? 'Dark' : 'Light'} theme`}
          >
            <Feather name={isLight ? 'moon' : 'sun'} size={14} color="#000" />
            <Text style={styles.togglePillText}>
              {isLight ? 'Dark Mode' : 'Light Mode'}
            </Text>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: borderCol }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close theme picker"
            >
              <Feather name="x" size={16} color={textColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs & Gender Pills */}
      <View style={styles.filterRow}>
        <View style={styles.tabGroup}>
          {[
            { id: 'all', label: 'All' },
            { id: 'light', label: '☀️ Light' },
            { id: 'dark', label: '🌙 Dark' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.filterTab,
                  active && { backgroundColor: `${primary}25`, borderColor: primary },
                ]}
              >
                <Text style={[styles.filterTabText, { color: active ? primary : textMuted }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Gender / Collection Filter */}
        <View style={styles.genderGroup}>
          {[
            { id: GENDERS.MALE, label: 'Cyber' },
            { id: GENDERS.FEMALE, label: 'Vibrant' },
            { id: GENDERS.NON_BINARY, label: 'Pastel' },
          ].map((g) => {
            const active = selectedGender === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => setSelectedGender(g.id)}
                style={[
                  styles.genderChip,
                  active && { backgroundColor: `${primary}20`, borderColor: primary },
                ]}
              >
                <Text style={[styles.genderChipText, { color: active ? primary : textMuted }]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Swatches Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatchScroll}
      >
        {availableThemes.map((t) => {
          const isSelected = selectedGender === gender && themeIndex === t.index;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.swatchCard,
                {
                  backgroundColor: t.surface || '#12161a',
                  borderColor: isSelected ? primary : (t.borderColor || borderCol),
                  borderWidth: isSelected ? 2 : 1,
                },
                isSelected && styles.swatchCardSelected,
              ]}
              onPress={() => handleSelectTheme(t.index)}
              activeOpacity={0.8}
            >
              {/* Dual Color Dot (Primary + Background) */}
              <View style={styles.colorPillWrap}>
                <View style={[styles.colorHalf, { backgroundColor: t.background || '#000' }]} />
                <View style={[styles.colorHalf, { backgroundColor: t.primary || '#00f2ff' }]} />
                {isSelected && (
                  <View style={[styles.selectedCheckBadge, { backgroundColor: primary }]}>
                    <Feather name="check" size={10} color="#000" />
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.swatchName,
                  { color: t.text || '#fff', fontWeight: isSelected ? '800' : '600' },
                ]}
                numberOfLines={1}
              >
                {t.name}
              </Text>

              <Text style={[styles.swatchTone, { color: t.isThemeLight ? '#0077b6' : '#f59e0b' }]}>
                {t.isThemeLight ? '☀️ Light' : '🌙 Dark'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 4,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  togglePillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  genderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  genderChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  genderChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  swatchScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  swatchCard: {
    width: 110,
    padding: 10,
    borderRadius: 14,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  swatchCardSelected: {
    shadowColor: '#00f2ff',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  colorPillWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  colorHalf: {
    flex: 1,
    height: '100%',
  },
  selectedCheckBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.95,
  },
  swatchName: {
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  swatchTone: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
