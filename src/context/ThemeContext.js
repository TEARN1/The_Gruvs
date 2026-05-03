import React, { createContext, useState, useContext, useEffect } from 'react';
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

  // Sync currentTheme whenever gender/index changes
  useEffect(() => {
    const theme = THEMES[gender]?.[themeIndex];
    if (theme) setCurrentTheme(theme);
  }, [gender, themeIndex]);

  const changeTheme = (newGender, newIndex) => {
    if (!THEMES[newGender]?.[newIndex]) return;
    setGender(newGender);
    setThemeIndex(newIndex);
    // Persist
    AsyncStorage?.setItem(STORAGE_KEY, JSON.stringify({ gender: newGender, index: newIndex })).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, gender, themeIndex, changeTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
