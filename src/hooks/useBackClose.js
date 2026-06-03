import { useEffect, useRef } from 'react';
import { backStack } from '../utils/backStack';

/**
 * Register a layer with the global back stack while it is visible.
 *
 *   useBackClose(visible, onClose);
 *
 * While `active` is true, a back press (Android hardware / browser-web) closes
 * this layer via `onClose` instead of navigating away. The latest `onClose` is
 * always used, so passing an inline callback is fine — the effect only re-runs
 * when `active` flips, avoiding churn.
 */
export const useBackClose = (active, onClose) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    return backStack.push(() => { onCloseRef.current && onCloseRef.current(); });
  }, [active]);
};

export default useBackClose;