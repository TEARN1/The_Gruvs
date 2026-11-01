/**
 * appInstallService.js — Universal App Download & Installation Orchestrator.
 *
 * Provides a unified, resilient bridge for downloading and installing The Gruvs across:
 *   - Apple iOS / iPadOS (Safari Web Clip, Add to Home Screen, App Store, TestFlight)
 *   - Android (1-Tap Native PWA install via beforeinstallprompt, Google Play, APK package)
 *   - Desktop & Web (Chrome / Edge PWA install, Mobile QR Hand-off, Link Sharing)
 *   - In-App WebViews (WhatsApp, Instagram, TikTok, Facebook sandbox breakout)
 */
import { Platform } from 'react-native';

export const APP_DOWNLOAD_CONFIG = {
  siteUrl: 'https://thegruvs.com',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.thegruvs_tearn',
  appStoreUrl: 'https://apps.apple.com/app/the-gruvs',
  testFlightUrl: 'https://testflight.apple.com/join/thegruvs',
  apkUrl: 'https://thegruvs.com/download/thegruvs.apk',
  appName: 'The Gruvs',
  tagline: 'South Africa’s #1 Nightlife & Events App',
};

class AppInstallService {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.listeners = new Set();
    this.modalState = {
      isOpen: false,
      initialTab: null, // 'ios' | 'android' | 'desktop' | null
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this._initWebListeners();
    }
  }

  _initWebListeners() {
    try {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.navigator?.standalone === true;
      this.isInstalled = !!standalone;

      window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default mini-infobar so our custom prompt controls the UX
        e.preventDefault();
        this.deferredPrompt = e;
        this._notify();
      });

      window.addEventListener('appinstalled', () => {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.closeModal();
        this._notify();
      });
    } catch {}
  }

  /** Detect runtime platform, browser engine, and sandbox environment */
  detectEnvironment() {
    if (typeof window === 'undefined') {
      return {
        isIOS: Platform.OS === 'ios',
        isAndroid: Platform.OS === 'android',
        isDesktop: Platform.OS === 'web',
        isChrome: false,
        isSafari: false,
        isInApp: false,
        isStandalone: false,
        platformKey: Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'android' : 'desktop',
      };
    }

    const ua = window.navigator?.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/i.test(ua);
    const isDesktop = !isIOS && !isAndroid;
    const isInApp = /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|WeChat|TikTok|Snapchat|Pinterest|LinkedIn)/i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR/i.test(ua);
    const isStandalone =
      this.isInstalled ||
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator?.standalone === true;

    const platformKey = isIOS ? 'apple' : isAndroid ? 'android' : 'desktop';

    return {
      isIOS,
      isAndroid,
      isDesktop,
      isChrome,
      isSafari,
      isInApp,
      isStandalone,
      platformKey,
    };
  }

  /** Check if Chrome/Edge native 1-tap install prompt is primed */
  canInstallOneTap() {
    return !!this.deferredPrompt;
  }

  /** Trigger the 1-tap browser prompt */
  async promptOneTapInstall() {
    if (!this.deferredPrompt) return { outcome: 'dismissed', ready: false };
    try {
      this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        this.isInstalled = true;
        this.closeModal();
      }
      this.deferredPrompt = null;
      this._notify();
      return { outcome: choice?.outcome || 'accepted', ready: true };
    } catch (err) {
      return { outcome: 'error', error: err?.message };
    }
  }

  /** Open the universal download / install modal from any screen */
  openModal(targetPlatform = null) {
    this.modalState = {
      isOpen: true,
      initialTab: targetPlatform,
    };
    this._notify();
  }

  /** Close the modal */
  closeModal() {
    this.modalState = {
      isOpen: false,
      initialTab: null,
    };
    this._notify();
  }

  /** Get current modal state */
  getModalState() {
    return this.modalState;
  }

  /** Subscribe to state changes (prompts arriving, modal opens, installs) */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener({
          canOneTap: !!this.deferredPrompt,
          isInstalled: this.isInstalled,
          modalState: this.modalState,
        });
      } catch {}
    }
  }

  /** Copy download link to clipboard with native fallback */
  async copyDownloadLink(url = APP_DOWNLOAD_CONFIG.siteUrl) {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch {}
    }
    return false;
  }
}

export const appInstallService = new AppInstallService();
export default appInstallService;
