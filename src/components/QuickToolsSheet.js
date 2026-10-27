import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { GlassView } from './GlassView';
import { appInstallService } from '../services/appInstallService';

export function QuickToolsSheet({
  visible,
  onClose,
  onOpenRoulette,
  onOpenSensory,
  onOpenCulture,
  onOpenRides,
  onOpenReels,
  onOpenCalendar,
  onOpenNotifications,
  hasReels = true,
  hasSensory = true,
  primary: propPrimary,
  surface: propSurface,
  textColor: propTextColor,
  muted: propMuted,
}) {
  const themeContext = useTheme?.();
  const currentTheme = themeContext?.currentTheme;
  const primary = propPrimary || currentTheme?.primary || '#00f2ff';
  const surface = propSurface || currentTheme?.surface || '#12181b';
  const textColor = propTextColor || currentTheme?.text || '#ffffff';
  const muted = propMuted || currentTheme?.textMuted || 'rgba(255,255,255,0.6)';

  if (!visible) return null;

  const tools = [
    {
      id: 'roulette',
      title: 'Vibe Roulette',
      subtitle: 'Spin for spontaneous nightlife spots',
      icon: 'compass',
      color: primary,
      onPress: () => {
        onClose();
        onOpenRoulette?.();
      },
    },
    ...(hasSensory
      ? [
          {
            id: 'sensory',
            title: 'Sensory Suite',
            subtitle: 'Audio haptics, bass & lighting suite',
            icon: 'zap',
            color: '#00f2ff',
            onPress: () => {
              onClose();
              onOpenSensory?.();
            },
          },
        ]
      : []),
    {
      id: 'culture',
      title: 'Culture Artifacts',
      subtitle: 'Heritage tokens, Kasi street culture',
      icon: 'award',
      color: '#f59e0b',
      onPress: () => {
        onClose();
        onOpenCulture?.();
      },
    },
    ...(onOpenCalendar
      ? [
          {
            id: 'calendar',
            title: 'Lineup & Itinerary',
            subtitle: 'Day-by-day festival calendar & schedule',
            icon: 'calendar',
            color: '#06b6d4',
            onPress: () => {
              onClose();
              onOpenCalendar?.();
            },
          },
        ]
      : []),
    ...(onOpenNotifications
      ? [
          {
            id: 'notifications',
            title: 'Pings & Activity',
            subtitle: 'Alerts, check-in invites & mentions',
            icon: 'bell',
            color: '#ef4444',
            onPress: () => {
              onClose();
              onOpenNotifications?.();
            },
          },
        ]
      : []),
    {
      id: 'rides',
      title: 'Resident Rides',
      subtitle: 'Safe carpools, door-to-door lifts',
      icon: 'navigation',
      color: '#10b981',
      onPress: () => {
        onClose();
        onOpenRides?.();
      },
    },
    ...(hasReels
      ? [
          {
            id: 'reels',
            title: 'Reels & Clips',
            subtitle: 'Short video vibes from the floor',
            icon: 'film',
            color: '#a855f7',
            onPress: () => {
              onClose();
              onOpenReels?.();
            },
          },
        ]
      : []),
    ...(Platform.OS === 'web'
      ? [
          {
            id: 'download',
            title: 'Get The App',
            subtitle: 'Install on Apple iOS or Android',
            icon: 'download',
            color: '#ec4899',
            onPress: () => {
              onClose();
              appInstallService.openModal();
            },
          },
        ]
      : []),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: surface, borderColor: `${primary}35` }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: `${primary}18` }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.glowBadge, { backgroundColor: `${primary}18`, borderColor: `${primary}45` }]}>
                <Feather name="grid" size={16} color={primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: textColor }]}>Explore & Tools</Text>
                <Text style={[styles.subtitle, { color: muted }]}>Quick access to Gruvs features</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
              accessibilityRole="button"
              accessibilityLabel="Close explore tools"
            >
              <Feather name="x" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Grid of Tools */}
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {tools.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: `${t.color}0a`,
                    borderColor: `${t.color}30`,
                  },
                ]}
                onPress={t.onPress}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${t.title}, ${t.subtitle}`}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: `${t.color}20`,
                      borderColor: `${t.color}50`,
                    },
                  ]}
                >
                  <Feather name={t.icon} size={20} color={t.color} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>
                    {t.title}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: muted }]} numberOfLines={2}>
                    {t.subtitle}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={muted} style={styles.cardChevron} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '80%',
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  glowBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardChevron: {
    marginLeft: 4,
  },
});
