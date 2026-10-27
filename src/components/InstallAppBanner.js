/**
 * InstallAppBanner — Always-available "Get the app" entry point for the website
 * (web only; renders nothing on native or once installed in standalone mode).
 *
 * Connects directly to appInstallService and GetAppModal to provide:
 *  - Clear Apple & Android support indicators
 *  - 1-tap installation when browser engine is primed
 *  - Collapsible floating action button for zero screen obstruction
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { GetAppModal } from './GetAppModal';
import { appInstallService } from '../services/appInstallService';

const COLLAPSE_KEY = 'gruvs_install_collapsed_v3';

export const InstallAppBanner = ({ primary = '#00f2ff' }) => {
  const [installed, setInstalled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [canOneTap, setCanOneTap] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const env = appInstallService.detectEnvironment();
    if (env.isStandalone) {
      setInstalled(true);
      return;
    }

    if (window.localStorage?.getItem(COLLAPSE_KEY)) {
      setCollapsed(true);
    }

    // Register service worker + manifest if missing
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    setCanOneTap(appInstallService.canInstallOneTap());

    // Subscribe to service updates (prompts, modal triggers, installs)
    const unsubscribe = appInstallService.subscribe((state) => {
      setCanOneTap(state.canOneTap);
      if (state.isInstalled) {
        setInstalled(true);
        setModalOpen(false);
      }
      if (state.modalState?.isOpen !== undefined) {
        setModalOpen(state.modalState.isOpen);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (Platform.OS !== 'web' || installed) return null;

  const collapse = () => {
    setCollapsed(true);
    try {
      window.localStorage?.setItem(COLLAPSE_KEY, '1');
    } catch {}
  };

  const expand = () => {
    setCollapsed(false);
    try {
      window.localStorage?.removeItem(COLLAPSE_KEY);
    } catch {}
  };

  return (
    <>
      {collapsed ? (
        // Persistent compact pill — always reachable at bottom-left
        <TouchableOpacity
          onPress={() => {
            expand();
            setModalOpen(true);
          }}
          style={[styles.fab, { backgroundColor: primary }]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Download and install The Gruvs App for Apple or Android"
        >
          <Feather name="download" size={16} color="#000" />
          <View>
            <Text style={styles.fabText}>Get App</Text>
            <Text style={styles.fabSubText}>iOS • Android</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[styles.bar, { borderColor: `${primary}55` }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${primary}22` }]}>
            <Feather name="smartphone" size={18} color={primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.text} numberOfLines={2}>
              <Text style={{ fontWeight: '900', color: '#fff' }}>Get The Gruvs App.</Text>{' '}
              Free install for Apple & Android — zero store wait.
            </Text>
            <View style={styles.pillRow}>
              <View style={styles.platformBadge}>
                <Text style={styles.platformBadgeText}>iOS</Text>
              </View>
              <View style={styles.platformBadge}>
                <Text style={styles.platformBadgeText}>Android</Text>
              </View>
              {canOneTap && (
                <View style={[styles.platformBadge, { backgroundColor: `${primary}25` }]}>
                  <Text style={[styles.platformBadgeText, { color: primary }]}>1-tap ready</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setModalOpen(true)}
            style={[styles.btn, { backgroundColor: primary }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Install The Gruvs app"
          >
            <Text style={styles.btnText}>Install</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={collapse}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss install banner"
          >
            <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      )}

      <GetAppModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          appInstallService.closeModal();
        }}
        primary={primary}
      />
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#12181a',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  platformBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  platformBadgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9.5,
    fontWeight: '800',
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  btnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    bottom: 84,
    left: 14,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12.5,
    lineHeight: 14,
  },
  fabSubText: {
    color: 'rgba(0,0,0,0.7)',
    fontWeight: '800',
    fontSize: 8.5,
    letterSpacing: 0.3,
  },
});
