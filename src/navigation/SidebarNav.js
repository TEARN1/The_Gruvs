/**
 * SidebarNav.js — Wide-screen desktop and tablet collapsible sidebar navigation.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { BrandLogo } from '../components/BrandLogo';
import { feature } from '../constants/launchConfig';
import { TABS, SIDEBAR_OPEN_WIDTH, SIDEBAR_CLOSED_WIDTH } from './navigationConfig';

export const SidebarNav = ({
  currentTab,
  onTabChange,
  primary,
  muted,
  bg,
  isOpen,
  onToggle,
  onGodView,
  onBusiness,
  onDownloadApp,
}) => (
  <View
    accessibilityRole="navigation"
    accessibilityLabel="Main navigation"
    style={[
      styles.root,
      {
        width: isOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_CLOSED_WIDTH,
        backgroundColor: bg,
        borderRightColor: `${primary}15`,
      },
      Platform.OS === 'web' && { transition: 'width 0.2s ease' },
    ]}
  >
    {/* Logo */}
    <TouchableOpacity
      activeOpacity={1}
      onLongPress={onGodView}
      style={[styles.logoRow, { justifyContent: isOpen ? 'flex-start' : 'center' }]}
      accessibilityRole="button"
      accessibilityLabel="The Gruvs Logo"
    >
      <BrandLogo size={24} showGlow={isOpen} />
      {isOpen && (
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.logoName, { color: primary }]}>THE GRUVS</Text>
          <Text style={[styles.logoSub, { color: muted }]}>Royale Edition</Text>
        </View>
      )}
    </TouchableOpacity>

    <View style={[styles.divider, { backgroundColor: `${primary}15` }]} />

    {/* Nav items */}
    <View style={styles.nav}>
      {TABS.map((tab) => {
        const isActive = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.item,
              { justifyContent: isOpen ? 'flex-start' : 'center' },
              isActive && {
                backgroundColor: `${primary}15`,
                borderRightWidth: 2.5,
                borderRightColor: primary,
              },
            ]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            {...(!isOpen && Platform.OS === 'web' ? { 'data-tooltip': tab.label } : {})}
          >
            <Feather
              name={tab.icon}
              size={19}
              color={isActive ? primary : muted}
              style={{ opacity: isActive ? 1 : 0.5 }}
            />
            {isOpen && (
              <Text style={[styles.itemLabel, { color: isActive ? primary : muted }]}>
                {tab.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>

    {/* The Gruvs for Business shortcut */}
    {feature('business') && onBusiness && (
      <TouchableOpacity
        style={[styles.item, { justifyContent: isOpen ? 'flex-start' : 'center', marginTop: 'auto' }]}
        onPress={onBusiness}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="The Gruvs for Business"
        {...(!isOpen && Platform.OS === 'web' ? { 'data-tooltip': 'For Business' } : {})}
      >
        <Feather name="briefcase" size={19} color={primary} />
        {isOpen && (
          <Text style={[styles.itemLabel, { color: primary, fontWeight: '800' }]}>
            For Business
          </Text>
        )}
      </TouchableOpacity>
    )}

    {/* Universal App Download entry for web visitors */}
    {Platform.OS === 'web' && onDownloadApp && (
      <TouchableOpacity
        style={[
          styles.item,
          {
            justifyContent: isOpen ? 'flex-start' : 'center',
            marginTop: !feature('business') || !onBusiness ? 'auto' : 0,
            marginBottom: 4,
          },
        ]}
        onPress={onDownloadApp}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Download and install The Gruvs App for Apple or Android"
        {...(!isOpen && Platform.OS === 'web' ? { 'data-tooltip': 'Get App' } : {})}
      >
        <Feather name="download" size={19} color={primary} />
        {isOpen && (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.itemLabel, { color: primary, fontWeight: '800' }]}>Get App</Text>
            <View style={{ backgroundColor: `${primary}25`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
              <Text style={{ color: primary, fontSize: 8.5, fontWeight: '900' }}>iOS • ANDROID</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    )}

    {/* Toggle sidebar button */}
    <TouchableOpacity
      style={[styles.toggleBtn, { justifyContent: isOpen ? 'flex-start' : 'center' }]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      <Feather
        name={isOpen ? 'sidebar' : 'menu'}
        size={17}
        color={muted}
        style={{ opacity: 0.55 }}
      />
      {isOpen && <Text style={[styles.toggleLabel, { color: muted }]}>Collapse</Text>}
    </TouchableOpacity>
  </View>
);

export default SidebarNav;

const styles = StyleSheet.create({
  root: {
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  logoName: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  logoSub: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
    opacity: 0.6,
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  nav: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
