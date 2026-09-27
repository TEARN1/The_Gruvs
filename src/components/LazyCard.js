/**
 * LazyCard — defer mounting a heavy feed card (and its full-res image) until it
 * is near the viewport. The Drop renders every event so the list is complete,
 * but loading all ~20 full images at once was ~6MB up front (the "app is slow").
 *
 * Web: an IntersectionObserver mounts the real card ~600px before it scrolls
 * into view, so its image only downloads when you're about to see it. Until
 * then it's a cheap fixed-height placeholder (keeps scroll height sane).
 * Native: FlatList already virtualizes, so we render immediately.
 *
 * `eager` (the first few cards) render straight away to avoid a first-paint flash.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';

export const LazyCard = ({ children, eager = false, estimatedHeight = 480 }) => {
  const [shown, setShown] = useState(!IS_WEB || eager);
  const ref = useRef(null);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); } },
      { rootMargin: '600px 0px' } // wake up just before it enters view
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  if (shown) return children;
  return <View ref={ref} style={{ height: estimatedHeight }} />;
};

export default LazyCard;
