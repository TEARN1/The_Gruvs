/**
 * LazyCard — defer mounting a heavy feed card (and its full-res image) until it
 * is near the viewport, and release it again once it's well past. The Drop
 * renders every event so the list is complete (FlatList's own windowing is
 * disabled on web — react-native-web's VirtualizedList gets permanently stuck
 * at initialNumToRender when it's on, see 474bd28), but a card left mounted
 * forever keeps its own countdown timer ticking and its shadowed DOM subtree
 * alive indefinitely — on a long scroll session that's hundreds of live cards
 * accumulating with nothing ever released (the "app gets slower the longer
 * you scroll" complaint).
 *
 * Web: a single IntersectionObserver with a generous rootMargin mounts the
 * real card ~1000px before it scrolls into view and unmounts it back to a
 * placeholder ~1000px after it scrolls past — hiding is debounced so a quick
 * scroll-back-and-forth doesn't thrash images/timers off and on.
 * Native: FlatList already virtualizes, so we render immediately.
 *
 * `eager` (the first few cards) render straight away and stay mounted — avoids
 * a first-paint flash, and there are only ever a handful of them.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';
const HIDE_DELAY_MS = 800; // debounce unmount — avoid thrash near the boundary

const LazyCardWeb = ({ children, estimatedHeight }) => {
  const [shown, setShown] = useState(false);
  const ref = useRef(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
          setShown(true);
        } else if (!hideTimerRef.current) {
          hideTimerRef.current = setTimeout(() => { hideTimerRef.current = null; setShown(false); }, HIDE_DELAY_MS);
        }
      },
      { rootMargin: '1000px 0px' }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <View ref={ref}>
      {shown ? children : <View style={{ height: estimatedHeight }} />}
    </View>
  );
};

export const LazyCard = ({ children, eager = false, estimatedHeight = 480 }) => {
  if (!IS_WEB || eager) return children;
  return <LazyCardWeb estimatedHeight={estimatedHeight}>{children}</LazyCardWeb>;
};

export default LazyCard;
