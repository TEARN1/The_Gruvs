/**
 * useDraft — never-lose-your-work autosave for any form.
 *
 * Persists a snapshot of fields to AsyncStorage (debounced) while a form is open,
 * restores it the next time the form opens, and clears it once the work is
 * submitted. Drop into any composer (event creation, comments, DMs, profile…):
 *
 *   const { clearDraft } = useDraft(
 *     user ? `draft:event:${user.id}` : null,   // null = disabled (e.g. logged out)
 *     () => ({ title, body }),                  // snapshot()  — what to save
 *     (d) => { setTitle(d.title); setBody(d.body); }, // restore() — how to reload
 *     { enabled: visible },                     // only while the form is open
 *   );
 *   // call clearDraft() after a successful submit
 */
import { useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const hasContent = (obj) =>
  obj && typeof obj === 'object' && Object.values(obj).some((v) =>
    (typeof v === 'string' && v.trim() !== '') ||
    (Array.isArray(v) && v.length > 0) ||
    (typeof v === 'number' && v !== 0) ||
    (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0));

export function useDraft(storageKey, snapshot, restore, { enabled = true, debounceMs = 600 } = {}) {
  const hydrated = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  // Restore a saved draft when the form opens (enabled flips on).
  useEffect(() => {
    if (!enabled || !storageKey) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!cancelled && raw) {
          const obj = JSON.parse(raw);
          if (hasContent(obj)) restoreRef.current?.(obj);
        }
      } catch { /* ignore corrupt draft */ }
      finally { if (!cancelled) hydrated.current = true; }
    })();
    return () => { cancelled = true; };
  }, [enabled, storageKey]);

  // Autosave (debounced) once hydrated — write when there's content, else clear.
  const json = JSON.stringify(snapshot() || {});
  useEffect(() => {
    if (!enabled || !storageKey || !hydrated.current) return undefined;
    const t = setTimeout(() => {
      try {
        const obj = JSON.parse(json);
        if (hasContent(obj)) AsyncStorage.setItem(storageKey, json);
        else AsyncStorage.removeItem(storageKey);
      } catch { /* ignore */ }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [json, enabled, storageKey, debounceMs]);

  // Call after a successful submit: drop the draft and stop autosave from
  // immediately rewriting it as the form resets.
  const clearDraft = useCallback(() => {
    hydrated.current = false;
    if (storageKey) AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  return { clearDraft };
}

export default useDraft;