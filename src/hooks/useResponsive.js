import { useWindowDimensions, Platform } from 'react-native';
import { BREAKPOINT } from '../constants/DesignTokens';

/**
 * useResponsive — Centralized reactive responsive layout hook for The Gruvs.
 * Dynamically re-evaluates on browser resize, tablet rotation, and foldable states.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isSmallMobile = width < 360; // iPhone SE, small Androids
  const isMobile = width < 640;      // Standard mobile
  const isTablet = width >= 640 && width < 1024; // iPad, foldables unfolded, tablet
  const isDesktop = width >= 1024;   // Laptops, desktop monitors
  const isWideDesktop = width >= 1440; // Ultrawide / large screens

  // Container max widths for single-column content (prevents distorted stretched cards)
  const feedMaxWidth = Math.min(width, isDesktop ? 680 : isTablet ? 600 : width);
  const detailMaxWidth = Math.min(width, isDesktop ? 740 : isTablet ? 660 : width);
  const modalMaxWidth = Math.min(width - 32, isDesktop ? 580 : isTablet ? 540 : width);
  const contentMaxWidth = Math.min(width, 1140);

  // Dynamic horizontal carousel card widths
  const trendCardWidth = Math.min(220, Math.max(150, (feedMaxWidth - 40) * 0.48));
  const trendCardHeight = Math.round(trendCardWidth * 0.65);

  // Dynamic grid column calculation helper
  const getGridColumns = (minItemWidth = 160) => {
    const usableWidth = isDesktop ? Math.min(width, 1140) : width - 32;
    return Math.max(1, Math.floor(usableWidth / minItemWidth));
  };

  // Clamped font scaling helper
  const scaleFont = (size, minScale = 0.88, maxScale = 1.12) => {
    const ratio = width / 390; // calibrated to standard iPhone 14/15/16 width
    const clampedRatio = Math.min(maxScale, Math.max(minScale, ratio));
    return Math.round(size * clampedRatio);
  };

  // Safe horizontal page margin
  const pageMargin = isSmallMobile ? 10 : isMobile ? 14 : isTablet ? 24 : 32;

  return {
    width,
    height,
    isSmallMobile,
    isMobile,
    isTablet,
    isDesktop,
    isWideDesktop,
    feedMaxWidth,
    detailMaxWidth,
    modalMaxWidth,
    contentMaxWidth,
    trendCardWidth,
    trendCardHeight,
    pageMargin,
    getGridColumns,
    scaleFont,
    isWeb: Platform.OS === 'web',
  };
}
