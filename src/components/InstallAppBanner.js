/**
 * InstallAppBanner — lets people install The Gruvs straight from the website
 * (no app store needed). Web-only; renders nothing on native.
 *
 * - Registers the service worker (required for install) and makes sure the
 *   manifest is linked, regardless of the served HTML template.
 * - When the browser fires `beforeinstallprompt`, shows an "Install app"
 *   button that triggers the native install.
 * - On iOS Safari (which has no install event) shows the Add-to-Home-Screen
 *   hint instead.
 * - Hides itself once installed (standalone) or dismissed.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const DISMISS_KEY = 'gruvs_install_dismissed_v1';

export const InstallAppBanner = ({ primary = '#00f2ff' }) => {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Already installed? (standalone display mode / iOS standalone)
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;
    if (standalone) return;
    if (window.localStorage?.getItem(DISMISS_KEY)) return;

    // 1. Register the service worker (install prompts require one).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // 2. Ensure the manifest is linked even if the HTML template omits it.
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // 3. Capture the install prompt (Chrome/Edge/Android).
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setShow(false));

    // 4. iOS Safari has no beforeinstallprompt — offer the manual hint.
    const ua = window.navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
    if (isIOS && isSafari) { setIosHint(true); setShow(true); }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (Platform.OS !== 'web' || !show) return null;

  const dismiss = () => {
    setShow(false);
    try { window.localStorage?.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setShow(false);
  };

  return (
    <View style={[styles.bar, { borderColor: `${primary}55`, backgroundColor: '#0d1112' }]}>
      <Feather name="download" size={16} color={primary} />
      <Text style={styles.text} numberOfLines={2}>
        {iosHint
          ? 'Install The Gruvs: tap Share, then “Add to Home Screen”.'
          : 'Get the app — install The Gruvs on your device.'}
      </Text>
      {!iosHint && (
        <TouchableOpacity onPress={install} style={[styles.btn, { backgroundColor: primary }]}>
          <Text style={styles.btnText}>Install</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderRadius: 12, marginHorizontal: 12, marginTop: 8,
  },
  text: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700' },
  btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 12 },
});
