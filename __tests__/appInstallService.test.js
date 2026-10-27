import { appInstallService, APP_DOWNLOAD_CONFIG } from '../src/services/appInstallService';

describe('AppInstallService', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  afterEach(() => {
    global.navigator = originalNavigator;
    global.window = originalWindow;
    appInstallService.closeModal();
    appInstallService.deferredPrompt = null;
    appInstallService.isInstalled = false;
  });

  describe('Environment Detection', () => {
    it('detects Apple iOS devices accurately', () => {
      global.window = {
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        },
        matchMedia: () => ({ matches: false }),
      };

      const env = appInstallService.detectEnvironment();
      expect(env.isIOS).toBe(true);
      expect(env.isAndroid).toBe(false);
      expect(env.isDesktop).toBe(false);
      expect(env.platformKey).toBe('apple');
    });

    it('detects Android devices accurately', () => {
      global.window = {
        navigator: {
          userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        },
        matchMedia: () => ({ matches: false }),
      };

      const env = appInstallService.detectEnvironment();
      expect(env.isAndroid).toBe(true);
      expect(env.isIOS).toBe(false);
      expect(env.isDesktop).toBe(false);
      expect(env.platformKey).toBe('android');
    });

    it('detects Desktop Chrome/Edge accurately', () => {
      global.window = {
        navigator: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        matchMedia: () => ({ matches: false }),
      };

      const env = appInstallService.detectEnvironment();
      expect(env.isDesktop).toBe(true);
      expect(env.isIOS).toBe(false);
      expect(env.isAndroid).toBe(false);
      expect(env.platformKey).toBe('desktop');
    });

    it('detects in-app browsers (WhatsApp / Instagram / TikTok)', () => {
      global.window = {
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0',
        },
        matchMedia: () => ({ matches: false }),
      };

      const env = appInstallService.detectEnvironment();
      expect(env.isInApp).toBe(true);
      expect(env.isIOS).toBe(true);
    });

    it('detects standalone installed mode', () => {
      global.window = {
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          standalone: true,
        },
        matchMedia: (query) => ({ matches: query === '(display-mode: standalone)' }),
      };

      const env = appInstallService.detectEnvironment();
      expect(env.isStandalone).toBe(true);
    });
  });

  describe('Modal State & Subscriptions', () => {
    it('notifies subscribers on modal open and close', () => {
      const listener = jest.fn();
      const unsubscribe = appInstallService.subscribe(listener);

      appInstallService.openModal('android');
      expect(appInstallService.getModalState().isOpen).toBe(true);
      expect(appInstallService.getModalState().initialTab).toBe('android');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          modalState: { isOpen: true, initialTab: 'android' },
        })
      );

      appInstallService.closeModal();
      expect(appInstallService.getModalState().isOpen).toBe(false);

      unsubscribe();
    });
  });

  describe('1-Tap Install Flow', () => {
    it('handles successful prompt and installation', async () => {
      const mockPrompt = {
        prompt: jest.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      appInstallService.deferredPrompt = mockPrompt;
      expect(appInstallService.canInstallOneTap()).toBe(true);

      const result = await appInstallService.promptOneTapInstall();
      expect(mockPrompt.prompt).toHaveBeenCalled();
      expect(result.outcome).toBe('accepted');
      expect(appInstallService.isInstalled).toBe(true);
      expect(appInstallService.deferredPrompt).toBeNull();
    });

    it('returns dismissed outcome when no prompt is ready', async () => {
      appInstallService.deferredPrompt = null;
      const result = await appInstallService.promptOneTapInstall();
      expect(result.ready).toBe(false);
      expect(result.outcome).toBe('dismissed');
    });
  });

  describe('Link Copying', () => {
    it('copies download link to clipboard', async () => {
      const writeText = jest.fn().mockResolvedValue(true);
      global.navigator = { clipboard: { writeText } };

      const ok = await appInstallService.copyDownloadLink();
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith(APP_DOWNLOAD_CONFIG.siteUrl);
    });
  });
});
