/**
 * DesktopService — Detects and handles native desktop environments (Electron/Tauri).
 * Manages window controls, tray icons, and deep linking on Windows/Linux.
 */
import { Platform } from 'react-native';

const isDesktop = Platform.OS === 'web' &&
  (typeof window !== 'undefined' &&
   (window.process?.type === 'renderer' || window.__TAURI__ !== undefined));

export const DesktopService = {
  isDesktop,

  // Set window title (useful for Electron/Tauri)
  setTitle(title) {
    if (Platform.OS === 'web') {
      document.title = `${title} — The Gruvs`;
    }
  },

  // Mock for native desktop notifications
  async showNotification(title, body) {
    if (!isDesktop) return;

    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    }
  },

  // Close or minimize logic (would interface with window.ipcRenderer in Electron)
  closeWindow() {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('window-close');
    }
  }
};
