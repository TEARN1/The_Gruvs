/**
 * GetAppModal — plug-and-play "install the app" flow for the website (web only).
 *
 * Handles EVERY real-world case so a user is never stuck:
 *  - Chrome/Android/Edge/Desktop with a captured install prompt → one-tap Install.
 *  - Android Chrome without a prompt yet → clear ⋮ → "Install app" steps.
 *  - iOS Safari → visual Share → "Add to Home Screen" steps.
 *  - In-app browsers (WhatsApp / Facebook / Instagram / TikTok) → the big SA
 *    gotcha: PWA install is impossible there, so we tell them to open in the
 *    real browser and give a one-tap "Open in Chrome/Safari" + copy-link.
 *  - Desktop → a QR code to hop to their phone, plus the address-bar hint.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Image, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

const APP_URL = 'https://thegruvs.com';

function detectEnv() {
  if (typeof window === 'undefined') return {};
  const ua = window.navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/i.test(ua);
  const inApp = /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|WeChat|TikTok|Snapchat|Pinterest)/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua);
  const isDesktop = !isIOS && !isAndroid;
  return { isIOS, isAndroid, inApp, isChrome, isDesktop };
}

const Step = ({ n, children, primary }) => (
  <View style={s.step}>
    <View style={[s.stepNum, { backgroundColor: primary }]}><Text style={s.stepNumText}>{n}</Text></View>
    <Text style={s.stepText}>{children}</Text>
  </View>
);

export const GetAppModal = ({ visible, onClose, deferredPrompt, primary = '#00f2ff' }) => {
  const env = useMemo(detectEnv, [visible]);
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

  // Build a QR (desktop → phone) lazily with the bundled `qrcode` lib.
  useEffect(() => {
    if (!visible || !env.isDesktop || typeof window === 'undefined') return;
    let alive = true;
    import('qrcode')
      .then(QR => QR.toDataURL(APP_URL, { margin: 1, width: 220, color: { dark: '#0d1112', light: '#ffffff' } }))
      .then(url => { if (alive) setQr(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [visible, env.isDesktop]);

  const oneTap = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    onClose?.();
  };

  const openInBrowser = () => {
    // In-app browsers ignore target, but many honour a fresh location on the
    // Android intent scheme / a plain open — best effort + copy fallback below.
    try { window.open(APP_URL, '_blank'); } catch {}
    try { window.location.href = APP_URL; } catch {}
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(APP_URL); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.card, { borderColor: `${primary}44` }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.header}>
              <View style={[s.logoDot, { backgroundColor: primary }]}><Feather name="zap" size={18} color="#000" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Get The Gruvs</Text>
                <Text style={s.sub}>Install the app — free, no store needed.</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            </View>

            {/* CASE 1 — one-tap install available */}
            {deferredPrompt ? (
              <>
                <TouchableOpacity onPress={oneTap} style={[s.cta, { backgroundColor: primary }]} activeOpacity={0.85}>
                  <Feather name="download" size={18} color="#000" />
                  <Text style={s.ctaText}>Install now</Text>
                </TouchableOpacity>
                <Text style={s.note}>One tap. It adds to your home screen and opens fullscreen like a normal app.</Text>
              </>
            ) : env.inApp ? (
              /* CASE 2 — inside WhatsApp/FB/IG browser: install is blocked here */
              <>
                <View style={[s.warn, { borderColor: `${primary}55` }]}>
                  <Feather name="alert-circle" size={16} color={primary} />
                  <Text style={s.warnText}>You opened this inside another app. To install, open it in your normal browser first.</Text>
                </View>
                <TouchableOpacity onPress={openInBrowser} style={[s.cta, { backgroundColor: primary }]} activeOpacity={0.85}>
                  <Feather name="external-link" size={18} color="#000" />
                  <Text style={s.ctaText}>Open in browser</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={copyLink} style={[s.ctaGhost, { borderColor: `${primary}55` }]} activeOpacity={0.85}>
                  <Feather name={copied ? 'check' : 'copy'} size={16} color={primary} />
                  <Text style={[s.ctaGhostText, { color: primary }]}>{copied ? 'Link copied!' : 'Copy link'}</Text>
                </TouchableOpacity>
                <Text style={s.note}>Then paste it into Chrome{env.isIOS ? ' or Safari' : ''} and tap “Get the App” again.</Text>
              </>
            ) : env.isIOS ? (
              /* CASE 3 — iOS Safari: manual add, shown visually */
              <>
                <View style={s.steps}>
                  <Step n="1" primary={primary}>Tap the <Feather name="share" size={13} color="#fff" /> <Text style={{ fontWeight: '900' }}>Share</Text> button at the bottom of Safari.</Step>
                  <Step n="2" primary={primary}>Scroll down and tap <Text style={{ fontWeight: '900' }}>“Add to Home Screen”</Text>.</Step>
                  <Step n="3" primary={primary}>Tap <Text style={{ fontWeight: '900' }}>“Add”</Text> — done. The Gruvs is on your home screen.</Step>
                </View>
              </>
            ) : env.isDesktop ? (
              /* CASE 4 — desktop: QR to phone + address-bar hint */
              <>
                {qr ? (
                  <View style={s.qrWrap}>
                    <Image source={{ uri: qr }} style={s.qr} />
                    <Text style={s.qrLabel}>Scan with your phone camera to open The Gruvs, then install it there.</Text>
                  </View>
                ) : null}
                <View style={s.steps}>
                  <Step n="1" primary={primary}>On desktop, click the <Feather name="download" size={13} color="#fff" /> install icon in the address bar.</Step>
                  <Step n="2" primary={primary}>Or scan the code above to install on your phone.</Step>
                </View>
              </>
            ) : (
              /* CASE 5 — Android without a prompt yet (or other) */
              <>
                <View style={s.steps}>
                  <Step n="1" primary={primary}>Tap the <Text style={{ fontWeight: '900' }}>⋮</Text> menu (top-right of {env.isChrome ? 'Chrome' : 'your browser'}).</Step>
                  <Step n="2" primary={primary}>Tap <Text style={{ fontWeight: '900' }}>“Install app”</Text> or <Text style={{ fontWeight: '900' }}>“Add to Home screen”</Text>.</Step>
                  <Step n="3" primary={primary}>Confirm — it lands on your home screen.</Step>
                </View>
                {!env.isChrome && (
                  <Text style={s.note}>Tip: it installs most reliably in Google Chrome.</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: { width: '100%', maxWidth: 420, maxHeight: '88%', backgroundColor: '#0d1112', borderWidth: 1, borderRadius: 22, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  logoDot: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 19, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 15 },
  ctaGhost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, marginTop: 10 },
  ctaGhostText: { fontWeight: '800', fontSize: 13 },
  note: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  warn: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.03)' },
  warnText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  steps: { gap: 14, marginTop: 6, marginBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#000', fontWeight: '900', fontSize: 13 },
  stepText: { flex: 1, color: '#fff', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  qrWrap: { alignItems: 'center', marginVertical: 6, marginBottom: 16 },
  qr: { width: 200, height: 200, borderRadius: 14, backgroundColor: '#fff' },
  qrLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 12, maxWidth: 260, lineHeight: 17 },
});
