/**
 * deferred — load a component's module the first time it's actually needed.
 *
 * The web build is a single bundle with no async-chunk loader (see
 * src/screens/lazyScreens.js), so React.lazy/import() can't split it. What we
 * CAN do is delay *executing* a module: its code is still downloaded, but its
 * top-level work (imports, StyleSheet.create, constants) runs on first use
 * instead of at app start.
 *
 * Modals stay unloaded until their `visible` prop is first true, so a panel
 * nobody opens costs nothing at startup. After that it stays loaded, so close
 * animations and state work exactly as before.
 */
import React from 'react';

export function deferred(load, name = 'Component') {
  let Real = null;
  const Deferred = React.forwardRef((props, ref) => {
    const hasVisible = Object.prototype.hasOwnProperty.call(props, 'visible');
    if (!Real) {
      if (hasVisible && !props.visible) return null;  // closed modal, never opened
      Real = load();
    }
    return <Real ref={ref} {...props} />;
  });
  Deferred.displayName = `Deferred(${name})`;
  return Deferred;
}
