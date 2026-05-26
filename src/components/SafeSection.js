import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * SafeSection — ErrorBoundary + Suspense in one wrapper.
 * One section crashing shows a tiny inline "unavailable / Retry" chip.
 * The rest of the screen stays fully functional.
 *
 * Usage:
 *   <SafeSection label="Polls" primary={primary}>
 *     <LazyComponent {...props} />
 *   </SafeSection>
 */
export const SafeSection = ({ children, label, primary, style }) => (
  <ErrorBoundary inline label={label} primary={primary} style={style}>
    <React.Suspense fallback={null}>
      {children}
    </React.Suspense>
  </ErrorBoundary>
);
