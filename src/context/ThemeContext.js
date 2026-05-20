import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import { THEMES, GENDERS } from '../constants/Themes';

const ThemeContext = createContext();

const STORAGE_KEY = '@gruvs_theme';

// AsyncStorage is optional — if not installed, gracefully skip persistence
let AsyncStorage = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  // Not installed — theme won't persist between app restarts
}

export const ThemeProvider = ({ children }) => {
  const [gender, setGender] = useState(GENDERS.MALE);
  const [themeIndex, setThemeIndex] = useState(0);
  const [currentTheme, setCurrentTheme] = useState(THEMES[GENDERS.MALE][0]);
  const [neuralOverride, setNeuralOverride] = useState(null);
  const [ready, setReady] = useState(false);

  // Load persisted preference on mount
  useEffect(() => {
    (async () => {
      try {
        if (AsyncStorage) {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            const { gender: g, index: i } = JSON.parse(saved);
            if (THEMES[g]?.[i]) {
              setGender(g);
              setThemeIndex(i);
              setCurrentTheme(THEMES[g][i]);
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Sync currentTheme whenever gender/index/neuralOverride changes
  useEffect(() => {
    if (neuralOverride) {
      setCurrentTheme(prev => ({ ...prev, ...neuralOverride }));
      return;
    }
    const theme = THEMES[gender]?.[themeIndex] || THEMES[GENDERS.MALE][0];
    setCurrentTheme(theme);
  }, [gender, themeIndex, neuralOverride]);

  // Items 23-30: Inject CSS custom properties to :root on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !currentTheme) return;
    const root = document.documentElement;
    const set  = (name, val) => val != null && root.style.setProperty(name, val);

    set('--color-primary', currentTheme.primary);
    set('--color-bg',      currentTheme.background);
    set('--color-surface', currentTheme.surface);
    set('--color-text',    currentTheme.text);
    set('--color-muted',   currentTheme.textMuted);
    set('--color-glow',    currentTheme.glowColor || currentTheme.primary);
    set('--color-border',  currentTheme.borderColor || 'rgba(255,255,255,0.15)');
    set('--radius-glass',  `${currentTheme.borderRadius || 18}px`);
    root.setAttribute('data-theme', currentTheme.id || 'royal_obsidian');
    set('--color-accent',  currentTheme.accent);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', currentTheme.background || '#0d1112');
  }, [currentTheme]);

  const changeTheme = (newGender, newIndex) => {
    setNeuralOverride(null); // Clear AI override on manual change
    if (!THEMES[newGender]?.[newIndex]) return;
    setGender(newGender);
    setThemeIndex(newIndex);
    AsyncStorage?.setItem(STORAGE_KEY, JSON.stringify({ gender: newGender, index: newIndex })).catch(() => {});
  };

  const applyNeuralTheme = (override) => {
    setNeuralOverride(override);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, gender, themeIndex, changeTheme, applyNeuralTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
