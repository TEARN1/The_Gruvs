/**
 * MapLayersModal — Clean, intuitive layer drawer for The Vibe Map.
 * Replaces the messy 16-button vertical FAB stack with a categorized,
 * beautiful bottom sheet (Apple Maps / Google Maps / Airbnb style).
 */
import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Pressable
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { GLASS, RADIUS } from '../constants/DesignTokens';

export function MapLayersModal({
  visible,
  onClose,
  // Layer states & toggles
  mapStyle = 'dark',
  onSelectStyle,
  heat = false,
  onToggleHeat,
  liveOnly = false,
  onToggleLiveOnly,
  showMine = false,
  onToggleMine,
  showCrew = false,
  onToggleCrew,
  showNearby = false,
  onToggleNearby,
  showTrails = false,
  onToggleTrails,
  showStays = false,
  onToggleStays,
  show3D = false,
  onToggle3D,
  showWeather = false,
  onToggleWeather,
  // Capabilities
  caps = {},
}) {
  const { currentTheme } = useTheme();
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#ffffff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';
  const surface = currentTheme?.surface || '#141a1c';
  const primary = currentTheme?.primary || '#00f2ff';

  const STYLES = [
    { key: 'dark', label: 'Dark Vibe', icon: 'moon', desc: 'Neon nightlife contrast' },
    { key: 'light', label: 'Daylight', icon: 'sun', desc: 'Clear street contrast' },
    { key: 'liberty', label: 'Outdoor', icon: 'compass', desc: 'Detailed landmarks & roads' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}35` }]} onPress={(e) => e.stopPropagation()}>
          {/* Sheet Handle */}
          <View style={[s.handle, { backgroundColor: `${muted}40` }]} />

          {/* Header */}
          <View style={s.headerRow}>
            <View>
              <Text style={[s.title, { color: text }]}>Map Layers & Modes</Text>
              <Text style={[s.sub, { color: muted }]}>Tailor what you see on the streets tonight</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: surface, borderColor: `${primary}20` }]}>
              <Feather name="x" size={20} color={text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            {/* 1. Basemap Style */}
            <Text style={[s.sectionHeader, { color: primary }]}>BASEMAP STYLE</Text>
            <View style={s.styleGrid}>
              {STYLES.map((st) => {
                const active = mapStyle === st.key;
                return (
                  <TouchableOpacity
                    key={st.key}
                    onPress={() => onSelectStyle?.(st.key)}
                    style={[
                      s.styleCard,
                      {
                        backgroundColor: active ? `${primary}18` : surface,
                        borderColor: active ? primary : 'rgba(255,255,255,0.08)',
                      }
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={[s.styleIconWrap, { backgroundColor: active ? primary : `${text}10` }]}>
                      <Feather name={st.icon} size={18} color={active ? '#000' : text} />
                    </View>
                    <Text style={[s.styleLabel, { color: active ? primary : text }]}>{st.label}</Text>
                    <Text style={[s.styleDesc, { color: muted }]}>{st.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. Crowd & Vibe Intelligence */}
            <Text style={[s.sectionHeader, { color: primary, marginTop: 18 }]}>VIBE INTELLIGENCE</Text>
            <View style={s.toggleList}>
              <ToggleRow
                icon="activity"
                iconColor="#f59e0b"
                title="Crowd Heatmap"
                desc="Glow intensity matches verified live Touch Downs"
                active={heat}
                onToggle={onToggleHeat}
                primary={primary}
                surface={surface}
                text={text}
                muted={muted}
              />
              <ToggleRow
                icon="radio"
                iconColor="#10b981"
                title="Verified Live Only"
                desc="Filter map to only venues with people confirmed there now"
                active={liveOnly}
                onToggle={onToggleLiveOnly}
                primary={primary}
                surface={surface}
                text={text}
                muted={muted}
              />
              <ToggleRow
                icon="trending-up"
                iconColor="#06b6d4"
                title="Crowd Flow Trails"
                desc="Visualizes real movement between venues as crowds hop"
                active={showTrails}
                onToggle={onToggleTrails}
                primary={primary}
                surface={surface}
                text={text}
                muted={muted}
              />
            </View>

            {/* 3. Social & Crew */}
            <Text style={[s.sectionHeader, { color: primary, marginTop: 18 }]}>SOCIAL & YOUR SCENE</Text>
            <View style={s.toggleList}>
              <ToggleRow
                icon="users"
                iconColor="#ec4899"
                title="Crew Convergence"
                desc="See which spots your squad and mutuals are heading to"
                active={showCrew}
                onToggle={onToggleCrew}
                primary={primary}
                surface={surface}
                text={text}
                muted={muted}
              />
              <ToggleRow
                icon="star"
                iconColor="#fbbf24"
                title="Vibe Fog (My Spots)"
                desc="Lights up venues you have personally Touched Down at"
                active={showMine}
                onToggle={onToggleMine}
                primary={primary}
                surface={surface}
                text={text}
                muted={muted}
              />
              <ToggleRow
                icon="user-check"
                iconColor="#8b5cf6"
                title="Discoverable Vibers"
                desc="Find nearby people looking to connect and vibe"
                active={showNearby}
                onToggle={onToggleNearby}
                primary={primary}
                surface={surface}
                text={text}
                muted={muted}
              />
              <ToggleRow
                icon="home"
                iconColor="#f59e0b"
                title="Places to Stay (Resident)"
                desc="Rooms & verified stays near your favorite venues"
                active={showStays}
                onToggle={onToggleStays}
                primary={primary}
                surface={surface}
                text={text}
                muted={muted}
              />
            </View>

            {/* 4. Display & Environment (Conditional based on caps) */}
            {(caps.threeD || caps.weather) && (
              <>
                <Text style={[s.sectionHeader, { color: primary, marginTop: 18 }]}>ENVIRONMENT</Text>
                <View style={s.toggleList}>
                  {caps.threeD && (
                    <ToggleRow
                      icon="box"
                      iconColor={primary}
                      title="3D City Buildings"
                      desc="Extruded 3D structures in major city blocks"
                      active={show3D}
                      onToggle={onToggle3D}
                      primary={primary}
                      surface={surface}
                      text={text}
                      muted={muted}
                    />
                  )}
                  {caps.weather && (
                    <ToggleRow
                      icon="cloud-rain"
                      iconColor="#3b82f6"
                      title="Live Weather Overlay"
                      desc="Live cloud and rain radar for outdoor safety"
                      active={showWeather}
                      onToggle={onToggleWeather}
                      primary={primary}
                      surface={surface}
                      text={text}
                      muted={muted}
                    />
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ToggleRow({
  icon, iconColor, title, desc, active, onToggle, primary, surface, text, muted
}) {
  return (
    <TouchableOpacity
      style={[
        s.toggleCard,
        {
          backgroundColor: surface,
          borderColor: active ? `${primary}55` : 'rgba(255,255,255,0.06)'
        }
      ]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[s.toggleIconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Feather name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[s.toggleTitle, { color: text }]}>{title}</Text>
        <Text style={[s.toggleDesc, { color: muted }]}>{desc}</Text>
      </View>
      <View style={[s.switchTrack, { backgroundColor: active ? primary : 'rgba(255,255,255,0.12)' }]}>
        <View style={[s.switchThumb, active ? s.switchThumbOn : s.switchThumbOff]} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    maxHeight: '82%',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  styleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  styleCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  styleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  styleLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  styleDesc: {
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 12,
  },
  toggleList: {
    gap: 8,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  toggleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  toggleDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: '#000',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
});
