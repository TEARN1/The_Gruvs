// applyNeuralTheme must keep one identity and ignore a repeat of the current
// override. When it changed every render, App's Royal-glow effect (which
// depends on it and calls it) re-ran forever: the whole app re-rendered and
// hit the database on every pass, and the Vibe Card hubs stopped responding.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

test('applyNeuralTheme is stable and a repeated override does not re-render', async () => {
  let renders = 0;
  let api = null;
  const seen = new Set();
  const Probe = () => {
    renders += 1;
    api = useTheme();
    seen.add(api.applyNeuralTheme);
    return null;
  };
  render(<ThemeProvider><Probe /></ThemeProvider>);
  await act(async () => {});

  await act(async () => { api.applyNeuralTheme({ glowIntensity: 0.4 }); });
  const afterFirst = renders;
  await act(async () => { api.applyNeuralTheme({ glowIntensity: 0.4 }); });
  await act(async () => { api.applyNeuralTheme({ glowIntensity: 0.4 }); });

  expect(renders).toBe(afterFirst);
  expect(seen.size).toBe(1);
});
