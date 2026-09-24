/**
 * InstallAppBanner — always-available "Get the app" entry point for the website
 * (web only; renders nothing on native or once installed).
 *
 * Plug-and-play: the button is ALWAYS shown (not gated on Chrome's
 * beforeinstallprompt, which often never fires), and opening it launches
 * GetAppModal, which walks the user through install on ANY platform / in-app
 * browser. Dismissing collapses it to a small floating pill so it's never fully
 * gone — users can always get back to it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { GetAppModal } from './GetAppModal';

const COLLAPSE_KEY = 'gruvs_install_collapsed_v2';

export const InstallAppBanner = ({ primary = '#00f2ff' }) => {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;
    if (standalone) { setInstalled(true); return; }

    if (window.localStorage?.getItem(COLLAPSE_KEY)) setCollapsed(true);

    // Register the service worker + ensure the manifest link exists (install
    // requires both), regardless of the served HTML template.
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest'; link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setModalOpen(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || installed) return null;

  const collapse = () => {
    setCollapsed(true);
    try { window.localStorage?.setItem(COLLAPSE_KEY, '1'); } catch {}
  };
  const expand = () => {
    setCollapsed(false);
    try { window.localStorage?.removeItem(COLLAPSE_KEY); } catch {}
  };

  return (
    <>
      {collapsed ? (
        // Persistent small pill — always reachable
        <TouchableOpacity
          onPress={() => { expand(); setModalOpen(true); }}
          style={[styles.fab, { backgroundColor: primary }]}
          activeOpacity={0.85}
          accessibilityLabel="Get the app"
        >
          <Feather name="download" size={16} color="#000" />
          <Text style={styles.fabText}>Get App</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.bar, { borderColor: `${primary}55` }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${primary}22` }]}>
            <Feather name="smartphone" size={16} color={primary} />
          </View>
          <Text style={styles.text} numberOfLines={2}>
            <Text style={{ fontWeight: '900', color: '#fff' }}>Get the app.</Text> Install The Gruvs — no store needed.
          </Text>
          <TouchableOpacity onPress={() => setModalOpen(true)} style={[styles.btn, { backgroundColor: primary }]} activeOpacity={0.85}>
            <Text style={styles.btnText}>Install</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={collapse} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      )}

      <GetAppModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        deferredPrompt={deferred}
        primary={primary}
      />
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderRadius: 14, marginHorizontal: 12, marginTop: 8,
    backgroundColor: '#12181a',
  },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 11 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 12.5 },
  fab: {
    // Bottom-LEFT so it never collides with the Create (+) FAB on the right.
    position: 'absolute', bottom: 84, left: 14, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  fabText: { color: '#000', fontWeight: '900', fontSize: 13 },
});
