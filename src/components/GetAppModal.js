/**
 * GetAppModal.js / DownloadAppModal.js
 *
 * Universal Multi-Platform App Download & Installation Hub for The Gruvs:
 *  - Apple iOS & iPadOS (Safari Web Clip, Add to Home Screen, App Store / TestFlight)
 *  - Android (1-Tap Native PWA Install, Google Play Store, Direct APK Fallback)
 *  - Desktop & Web (Chrome / Edge Desktop PWA, Live Phone QR Hand-off)
 *  - In-App Browser Sandbox Shield (WhatsApp, Instagram, TikTok, Facebook escape)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Image,
  ScrollView, Platform, Linking,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { appInstallService, APP_DOWNLOAD_CONFIG } from '../services/appInstallService';

const Step = ({ n, title, children, primary, iconName }) => (
  <View style={styles.step}>
    <View style={[styles.stepNum, { backgroundColor: primary }]}>
      {iconName ? <Feather name={iconName} size={14} color="#000" /> : <Text style={styles.stepNumText}>{n}</Text>}
    </View>
    <View style={{ flex: 1 }}>
      {title && <Text style={styles.stepTitle}>{title}</Text>}
      <Text style={styles.stepText}>{children}</Text>
    </View>
  </View>
);

export const GetAppModal = ({
  visible,
  onClose,
  deferredPrompt: propDeferredPrompt,
  primary = '#00f2ff',
  initialPlatform = null,
}) => {
  const env = useMemo(() => appInstallService.detectEnvironment(), [visible]);
  const [activeTab, setActiveTab] = useState('apple');
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (initialPlatform) {
      setActiveTab(initialPlatform === 'ios' ? 'apple' : initialPlatform);
    } else if (env.isIOS) {
      setActiveTab('apple');
    } else if (env.isAndroid) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }
  }, [visible, initialPlatform, env.isIOS, env.isAndroid]);

  const isAppleActive = activeTab === 'apple' || activeTab === 'ios';

  useEffect(() => {
    if (!visible || typeof window === 'undefined') return;
    let isMounted = true;
    import('qrcode')
      .then((QR) =>
        QR.toDataURL(APP_DOWNLOAD_CONFIG.siteUrl, {
          margin: 1,
          width: 200,
          color: { dark: '#0d1112', light: '#ffffff' },
        })
      )
      .then((url) => { if (isMounted) setQrCodeUrl(url); })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [visible]);

  const effectivePrompt = propDeferredPrompt || appInstallService.deferredPrompt;

  const handleOneTapInstall = useCallback(async () => {
    setInstalling(true);
    try {
      if (propDeferredPrompt) {
        propDeferredPrompt.prompt();
        await propDeferredPrompt.userChoice;
        onClose?.();
      } else {
        await appInstallService.promptOneTapInstall();
        onClose?.();
      }
    } catch {}
    setInstalling(false);
  }, [propDeferredPrompt, onClose]);

  const handleCopyLink = useCallback(async () => {
    const success = await appInstallService.copyDownloadLink();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleOpenExternal = useCallback((url) => {
    if (!url) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }, []);

  const handleOpenInBrowser = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.open(APP_DOWNLOAD_CONFIG.siteUrl, '_blank');
        window.location.href = APP_DOWNLOAD_CONFIG.siteUrl;
      }
    } catch {}
  }, []);

  if (Platform.OS !== 'web' && !visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.card, { borderColor: `${primary}45` }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoDot, { backgroundColor: primary }]}>
              <Feather name="zap" size={20} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Download The Gruvs</Text>
              <Text style={styles.sub}>Choose your platform — Apple, Android, or Desktop.</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close download dialog">
              <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Platform Segmented Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity onPress={() => setActiveTab('apple')} style={[styles.tabBtn, isAppleActive && { backgroundColor: `${primary}20`, borderColor: primary }]} accessibilityRole="tab" accessibilityState={{ selected: isAppleActive }}>
              <Feather name="smartphone" size={14} color={isAppleActive ? primary : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.tabBtnText, { color: isAppleActive ? primary : 'rgba(255,255,255,0.6)' }]}>Apple iOS</Text>
              {env.isIOS && <View style={[styles.devicePill, { backgroundColor: primary }]}><Text style={styles.devicePillText}>YOU</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setActiveTab('android')} style={[styles.tabBtn, activeTab === 'android' && { backgroundColor: `${primary}20`, borderColor: primary }]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'android' }}>
              <Feather name="smartphone" size={14} color={activeTab === 'android' ? primary : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.tabBtnText, { color: activeTab === 'android' ? primary : 'rgba(255,255,255,0.6)' }]}>Android</Text>
              {env.isAndroid && <View style={[styles.devicePill, { backgroundColor: primary }]}><Text style={styles.devicePillText}>YOU</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setActiveTab('desktop')} style={[styles.tabBtn, activeTab === 'desktop' && { backgroundColor: `${primary}20`, borderColor: primary }]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'desktop' }}>
              <Feather name="monitor" size={14} color={activeTab === 'desktop' ? primary : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.tabBtnText, { color: activeTab === 'desktop' ? primary : 'rgba(255,255,255,0.6)' }]}>Desktop</Text>
              {env.isDesktop && <View style={[styles.devicePill, { backgroundColor: primary }]}><Text style={styles.devicePillText}>YOU</Text></View>}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* In-App Browser Warning Alert */}
            {env.isInApp && (
              <View style={[styles.inAppWarn, { borderColor: `${primary}55` }]}>
                <Feather name="alert-circle" size={18} color={primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inAppWarnTitle}>In-App Browser Detected</Text>
                  <Text style={styles.inAppWarnText}>Instagram, WhatsApp, and TikTok restrict home screen installs. Open in Safari or Chrome to install.</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={handleOpenInBrowser} style={[styles.smallActionBtn, { backgroundColor: primary }]} activeOpacity={0.85}>
                      <Feather name="external-link" size={13} color="#000" />
                      <Text style={styles.smallActionBtnText}>Open Browser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCopyLink} style={[styles.smallGhostBtn, { borderColor: `${primary}55` }]} activeOpacity={0.85}>
                      <Feather name={copied ? 'check' : 'copy'} size={13} color={primary} />
                      <Text style={[styles.smallGhostBtnText, { color: primary }]}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* TAB 1: APPLE (iOS & iPadOS) */}
            {isAppleActive && (
              <View style={styles.sectionWrap}>
                <View style={styles.benefitCard}>
                  <Text style={styles.benefitTitle}>Instant iOS web app (fastest, nothing to download)</Text>
                  <Text style={styles.benefitDesc}>Add The Gruvs directly to your iPhone or iPad home screen with full fullscreen experience and instant updates.</Text>
                </View>

                <View style={styles.stepsList}>
                  <Step n="1" iconName="share" primary={primary} title="Tap the Share Button">
                    In Safari, tap the <Feather name="share" size={13} color="#fff" /> <Text style={{ fontWeight: '800', color: '#fff' }}>Share</Text> icon at the bottom toolbar.
                  </Step>
                  <Step n="2" iconName="plus-square" primary={primary} title="Select 'Add to Home Screen'">
                    Scroll down and tap <Text style={{ fontWeight: '800', color: '#fff' }}>“Add to Home Screen”</Text>.
                  </Step>
                  <Step n="3" iconName="check" primary={primary} title="Tap 'Add' (Top-Right)">
                    Tap <Text style={{ fontWeight: '800', color: '#fff' }}>“Add”</Text> in the top-right corner. The Gruvs launches fullscreen from your home screen!
                  </Step>
                </View>

                <View style={styles.altButtonsRow}>
                  <TouchableOpacity onPress={() => handleOpenExternal(APP_DOWNLOAD_CONFIG.appStoreUrl)} style={[styles.storePill, { borderColor: 'rgba(255,255,255,0.2)' }]} activeOpacity={0.85}>
                    <Feather name="external-link" size={14} color="#fff" />
                    <Text style={styles.storePillText}>App Store / TestFlight</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCopyLink} style={[styles.storePill, { borderColor: `${primary}55` }]} activeOpacity={0.85}>
                    <Feather name={copied ? 'check' : 'copy'} size={14} color={primary} />
                    <Text style={[styles.storePillText, { color: primary }]}>{copied ? 'Link Copied!' : 'Copy iPhone Link'}</Text>
                  </TouchableOpacity>
                </View>

                {qrCodeUrl && env.isDesktop && (
                  <View style={styles.qrContainer}>
                    <Image source={{ uri: qrCodeUrl }} style={styles.qrImage} />
                    <Text style={styles.qrCaption}>Scan with your iPhone Camera to open directly in Safari.</Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: ANDROID */}
            {activeTab === 'android' && (
              <View style={styles.sectionWrap}>
                {effectivePrompt ? (
                  <View style={{ marginBottom: 16 }}>
                    <TouchableOpacity onPress={handleOneTapInstall} style={[styles.primaryCta, { backgroundColor: primary }]} activeOpacity={0.85} disabled={installing}>
                      <Feather name="download" size={18} color="#000" />
                      <Text style={styles.primaryCtaText}>{installing ? 'Installing...' : 'Install Android App (1-Tap)'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.ctaHint}>Adds The Gruvs straight to your app drawer — runs offline and takes &lt; 3MB.</Text>
                  </View>
                ) : (
                  <View style={styles.stepsList}>
                    <Step n="1" primary={primary} title="Open Chrome / Browser Menu">
                      Tap the <Text style={{ fontWeight: '800', color: '#fff' }}>⋮</Text> menu icon in the top-right corner of Chrome or your Android browser.
                    </Step>
                    <Step n="2" iconName="download" primary={primary} title="Select 'Install App'">
                      Tap <Text style={{ fontWeight: '800', color: '#fff' }}>“Install app”</Text> or <Text style={{ fontWeight: '800', color: '#fff' }}>“Add to Home screen”</Text>.
                    </Step>
                    <Step n="3" iconName="check" primary={primary} title="Confirm Installation">
                      Tap <Text style={{ fontWeight: '800', color: '#fff' }}>“Install”</Text> on the confirmation prompt. The Gruvs installs as an official Android app!
                    </Step>
                  </View>
                )}

                <View style={styles.altButtonsRow}>
                  <TouchableOpacity onPress={() => handleOpenExternal(APP_DOWNLOAD_CONFIG.playStoreUrl)} style={[styles.storePill, { borderColor: 'rgba(255,255,255,0.2)' }]} activeOpacity={0.85}>
                    <Feather name="external-link" size={14} color="#fff" />
                    <Text style={styles.storePillText}>Google Play Store</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOpenExternal(APP_DOWNLOAD_CONFIG.apkUrl)} style={[styles.storePill, { borderColor: `${primary}55` }]} activeOpacity={0.85}>
                    <Feather name="download" size={14} color={primary} />
                    <Text style={[styles.storePillText, { color: primary }]}>Download APK Package</Text>
                  </TouchableOpacity>
                </View>

                {qrCodeUrl && env.isDesktop && (
                  <View style={styles.qrContainer}>
                    <Image source={{ uri: qrCodeUrl }} style={styles.qrImage} />
                    <Text style={styles.qrCaption}>Scan with your Android camera or Google Lens to install on your phone.</Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: DESKTOP & WEB */}
            {activeTab === 'desktop' && (
              <View style={styles.sectionWrap}>
                {effectivePrompt ? (
                  <View style={{ marginBottom: 16 }}>
                    <TouchableOpacity onPress={handleOneTapInstall} style={[styles.primaryCta, { backgroundColor: primary }]} activeOpacity={0.85}>
                      <Feather name="download" size={18} color="#000" />
                      <Text style={styles.primaryCtaText}>Install Desktop App</Text>
                    </TouchableOpacity>
                    <Text style={styles.ctaHint}>Runs in a standalone window with zero browser tab clutter.</Text>
                  </View>
                ) : (
                  <View style={styles.stepsList}>
                    <Step n="1" iconName="download" primary={primary} title="Browser Address Bar">
                      Click the <Feather name="download" size={13} color="#fff" /> <Text style={{ fontWeight: '800', color: '#fff' }}>Install</Text> icon in the right of your Chrome or Edge URL bar.
                    </Step>
                    <Step n="2" iconName="check" primary={primary} title="Confirm & Launch">
                      Click <Text style={{ fontWeight: '800', color: '#fff' }}>“Install”</Text> to launch The Gruvs Desktop app.
                    </Step>
                  </View>
                )}

                {qrCodeUrl && (
                  <View style={styles.qrContainer}>
                    <Image source={{ uri: qrCodeUrl }} style={styles.qrImage} />
                    <Text style={styles.qrCaption}>Point your phone camera here to jump straight to mobile installation.</Text>
                  </View>
                )}

                <TouchableOpacity onPress={handleCopyLink} style={[styles.storePill, { borderColor: `${primary}55`, marginTop: 12 }]} activeOpacity={0.85}>
                  <Feather name={copied ? 'check' : 'copy'} size={14} color={primary} />
                  <Text style={[styles.storePillText, { color: primary }]}>{copied ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Value Guarantees */}
            <View style={styles.guaranteeRow}>
              <View style={styles.guaranteeItem}><Feather name="shield" size={13} color={primary} /><Text style={styles.guaranteeText}>100% Free</Text></View>
              <Text style={styles.guaranteeDot}>•</Text>
              <View style={styles.guaranteeItem}><Feather name="zap" size={13} color={primary} /><Text style={styles.guaranteeText}>Zero Bloat (&lt;3MB)</Text></View>
              <Text style={styles.guaranteeDot}>•</Text>
              <View style={styles.guaranteeItem}><Feather name="check-circle" size={13} color={primary} /><Text style={styles.guaranteeText}>Offline Ready</Text></View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const DownloadAppModal = GetAppModal;
export default GetAppModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: '#0d1112', borderWidth: 1, borderRadius: 24, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  logoDot: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2, lineHeight: 16 },
  closeBtn: { padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  tabBar: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  tabBtnText: { fontSize: 12.5, fontWeight: '800' },
  devicePill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  devicePillText: { color: '#000', fontSize: 8, fontWeight: '900' },
  scrollContent: { paddingBottom: 6 },
  inAppWarn: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.03)' },
  inAppWarnTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 3 },
  inAppWarnText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17 },
  smallActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  smallActionBtnText: { color: '#000', fontSize: 12, fontWeight: '800' },
  smallGhostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  smallGhostBtnText: { fontSize: 12, fontWeight: '800' },
  sectionWrap: { marginTop: 2 },
  benefitCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#00f2ff' },
  benefitTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 3 },
  benefitDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 16 },
  stepsList: { gap: 14, marginBottom: 14 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { color: '#000', fontWeight: '900', fontSize: 13 },
  stepTitle: { color: '#fff', fontSize: 13.5, fontWeight: '800', marginBottom: 2 },
  stepText: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 18 },
  primaryCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  primaryCtaText: { color: '#000', fontWeight: '900', fontSize: 15 },
  ctaHint: { color: 'rgba(255,255,255,0.5)', fontSize: 11.5, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  altButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 14 },
  storePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)' },
  storePillText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  qrContainer: { alignItems: 'center', paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, marginVertical: 8 },
  qrImage: { width: 170, height: 170, borderRadius: 12, backgroundColor: '#fff' },
  qrCaption: { color: 'rgba(255,255,255,0.6)', fontSize: 11.5, textAlign: 'center', marginTop: 10, maxWidth: 260, lineHeight: 16 },
  guaranteeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 6 },
  guaranteeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guaranteeText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' },
  guaranteeDot: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
});
